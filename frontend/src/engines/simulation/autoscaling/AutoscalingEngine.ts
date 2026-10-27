import type {
  AutoscalingConfig,
  AutoscalingHistoryPoint,
  AutoscalingMetrics,
  ScalingDecision,
  VirtualReplica
} from "./AutoscalingTypes";
import { AutoscalingPolicy } from "./AutoscalingPolicy";

export interface BaseBackendModel {
  id: string;
  name: string;
  type: string;
  databaseNodeId?: string;
  loadBalancerId?: string;
}

export class AutoscalingEngine {
  private config: AutoscalingConfig;
  private baseBackends: BaseBackendModel[] = [];
  private replicas: Map<string, VirtualReplica> = new Map();
  private history: AutoscalingHistoryPoint[] = [];

  private replicaCounter: number = 1;
  private lastScaleOutTick?: number;
  private lastScaleInTick?: number;
  private scaleOutCount: number = 0;
  private scaleInCount: number = 0;
  private totalCreatedCount: number = 0;
  private totalRemovedCount: number = 0;

  constructor(baseBackends: BaseBackendModel[], config: AutoscalingConfig) {
    this.baseBackends = [...baseBackends];
    this.config = { ...config };
    this.initializeReplicas();
  }

  public setConfig(config: AutoscalingConfig): void {
    this.config = { ...config };
  }

  public getConfig(): AutoscalingConfig {
    return { ...this.config };
  }

  /**
   * Initialize initial set of virtual replicas based on base backends and config.initialReplicas
   */
  public initializeReplicas(): void {
    this.replicas.clear();
    this.history = [];
    this.replicaCounter = 1;
    this.lastScaleOutTick = undefined;
    this.lastScaleInTick = undefined;
    this.scaleOutCount = 0;
    this.scaleInCount = 0;
    this.totalCreatedCount = 0;
    this.totalRemovedCount = 0;

    if (this.baseBackends.length === 0) return;

    // Determine initial count
    const initialCount = this.config.enabled
      ? Math.max(this.config.minReplicas, Math.min(this.config.maxReplicas, this.config.initialReplicas))
      : this.baseBackends.length;

    for (let i = 0; i < initialCount; i++) {
      const baseIndex = i % this.baseBackends.length;
      const base = this.baseBackends[baseIndex];
      const replicaId = i < this.baseBackends.length
        ? base.id // first replicas keep base IDs for 100% backward compatibility
        : `${base.id}-rep-${this.replicaCounter++}`;

      const replica: VirtualReplica = {
        id: replicaId,
        baseResourceId: base.id,
        name: i < this.baseBackends.length ? base.name : `${base.name} (Replica ${i + 1})`,
        state: "ready",
        isFailed: false,
        activeRequests: 0,
        handledRequests: 0,
        failedRequests: 0,
        modeledCapacity: this.config.modeledCapacityPerReplica,
        createdTick: 0,
        readyTick: 0,
        databaseNodeId: base.databaseNodeId
      };

      this.replicas.set(replicaId, replica);
      this.totalCreatedCount++;
    }
  }

  /**
   * Returns list of replica IDs currently healthy, ready, and accepting traffic
   */
  public getEligibleTargetIds(): string[] {
    return Array.from(this.replicas.values())
      .filter(r => r.state === "ready" && !r.isFailed)
      .map(r => r.id)
      .sort();
  }

  public getReplica(id: string): VirtualReplica | undefined {
    return this.replicas.get(id);
  }

  public getAllReplicas(): VirtualReplica[] {
    return Array.from(this.replicas.values());
  }

  public getReadyReplicas(): VirtualReplica[] {
    return Array.from(this.replicas.values()).filter(r => r.state === "ready" && !r.isFailed);
  }

  public onReplicaRequestAssigned(replicaId: string): void {
    const replica = this.replicas.get(replicaId);
    if (replica) {
      replica.activeRequests++;
      replica.handledRequests++;
    }
  }

  public onReplicaRequestCompleted(replicaId: string, success: boolean): void {
    const replica = this.replicas.get(replicaId);
    if (replica) {
      replica.activeRequests = Math.max(0, replica.activeRequests - 1);
      if (!success) {
        replica.failedRequests++;
      }
    }
  }

  public injectReplicaFailure(replicaId: string, reason?: string): void {
    const replica = this.replicas.get(replicaId);
    if (replica) {
      replica.isFailed = true;
      replica.failureReason = reason || "Simulated node crash";
    }
  }

  public recoverReplica(replicaId: string): void {
    const replica = this.replicas.get(replicaId);
    if (replica) {
      replica.isFailed = false;
      replica.failureReason = undefined;
    }
  }

  /**
   * Advances replica provisioning and draining lifecycles
   */
  public advanceLifecycle(currentTick: number): { provisioned: VirtualReplica[]; terminated: VirtualReplica[] } {
    const provisioned: VirtualReplica[] = [];
    const terminated: VirtualReplica[] = [];

    for (const [id, replica] of this.replicas.entries()) {
      // 1. Provisioning -> Ready
      if (replica.state === "provisioning") {
        if (replica.readyTick !== undefined && currentTick >= replica.readyTick) {
          replica.state = "ready";
          provisioned.push(replica);
        }
      }

      // 2. Draining -> Terminated (when active requests reach 0)
      if (replica.state === "draining") {
        if (replica.activeRequests === 0) {
          replica.state = "terminated";
          replica.terminatedTick = currentTick;
          terminated.push(replica);
          this.replicas.delete(id);
          this.totalRemovedCount++;
        }
      }
    }

    return { provisioned, terminated };
  }

  /**
   * Evaluates scaling policy and executes scale-out or scale-in if needed
   */
  public evaluateAndStep(currentTick: number): {
    decision: ScalingDecision;
    newReplicas: VirtualReplica[];
    drainingReplicas: VirtualReplica[];
  } {
    // 1. Calculate active requests across all non-terminated replicas
    let totalActiveRequests = 0;
    for (const replica of this.replicas.values()) {
      totalActiveRequests += replica.activeRequests;
    }

    // 2. Calculate healthy capacity (only ready, non-failed, non-draining replicas)
    const readyHealthy = this.getReadyReplicas();
    const healthyCapacity = readyHealthy.reduce((acc, r) => acc + r.modeledCapacity, 0);

    // 3. Evaluate Policy
    const decision = AutoscalingPolicy.evaluate(this.config, {
      currentTick,
      currentReplicas: this.replicas.size,
      readyHealthyReplicas: readyHealthy.length,
      healthyCapacity,
      activeRequests: totalActiveRequests,
      lastScaleOutTick: this.lastScaleOutTick,
      lastScaleInTick: this.lastScaleInTick
    });

    const newReplicas: VirtualReplica[] = [];
    const drainingReplicas: VirtualReplica[] = [];

    // 4. Execute Scale-Out
    if (decision.direction === "SCALE_OUT") {
      this.lastScaleOutTick = currentTick;
      this.scaleOutCount++;
      const needed = decision.targetReplicas - this.replicas.size;

      for (let i = 0; i < needed; i++) {
        const base = this.baseBackends[i % this.baseBackends.length] || {
          id: "bk-default",
          name: "Backend",
          type: "backend"
        };
        const replicaId = `${base.id}-rep-${this.replicaCounter++}`;
        const isImmediate = this.config.startupDelayTicks <= 0;

        const newReplica: VirtualReplica = {
          id: replicaId,
          baseResourceId: base.id,
          name: `${base.name} (Replica ${this.replicas.size + 1})`,
          state: isImmediate ? "ready" : "provisioning",
          isFailed: false,
          activeRequests: 0,
          handledRequests: 0,
          failedRequests: 0,
          modeledCapacity: this.config.modeledCapacityPerReplica,
          createdTick: currentTick,
          readyTick: currentTick + this.config.startupDelayTicks,
          databaseNodeId: base.databaseNodeId
        };

        this.replicas.set(replicaId, newReplica);
        this.totalCreatedCount++;
        newReplicas.push(newReplica);
      }

      decision.affectedReplicaIds = newReplicas.map(r => r.id);
    }

    // 5. Execute Scale-In
    if (decision.direction === "SCALE_IN") {
      this.lastScaleInTick = currentTick;
      this.scaleInCount++;
      const toRemoveCount = this.replicas.size - decision.targetReplicas;

      // Select victim replicas deterministically:
      // Prefer virtual replicas with lowest active load, keeping base backends if possible
      const candidates = Array.from(this.replicas.values())
        .filter(r => r.state === "ready" && !r.isFailed)
        .sort((a, b) => {
          // Virtual replicas first (those containing '-rep-')
          const aIsVirtual = a.id.includes("-rep-");
          const bIsVirtual = b.id.includes("-rep-");
          if (aIsVirtual !== bIsVirtual) return aIsVirtual ? -1 : 1;
          // Then least active requests
          if (a.activeRequests !== b.activeRequests) return a.activeRequests - b.activeRequests;
          // Then newest first
          return b.createdTick - a.createdTick;
        });

      const victims = candidates.slice(0, toRemoveCount);
      for (const victim of victims) {
        victim.state = "draining";
        victim.drainStartedTick = currentTick;
        drainingReplicas.push(victim);

        // If no active requests, terminate immediately
        if (victim.activeRequests === 0) {
          victim.state = "terminated";
          victim.terminatedTick = currentTick;
          this.replicas.delete(victim.id);
          this.totalRemovedCount++;
        }
      }

      decision.affectedReplicaIds = drainingReplicas.map(r => r.id);
    }

    // 6. Record History Point
    this.history.push({
      tick: currentTick,
      utilization: decision.currentUtilization,
      totalReplicas: this.replicas.size,
      readyReplicas: this.getReadyReplicas().length,
      activeRequests: totalActiveRequests,
      healthyCapacity,
      decision: decision.direction !== "NONE" ? decision : undefined
    });

    return {
      decision,
      newReplicas,
      drainingReplicas
    };
  }

  public getMetrics(currentTick: number): AutoscalingMetrics {
    const readyHealthy = this.getReadyReplicas();
    const healthyCapacity = readyHealthy.reduce((acc, r) => acc + r.modeledCapacity, 0);

    let totalActive = 0;
    for (const r of this.replicas.values()) {
      totalActive += r.activeRequests;
    }

    const utilization = healthyCapacity > 0
      ? Number(((totalActive / healthyCapacity) * 100).toFixed(1))
      : 100;

    const scaleOutCooldownRemaining = this.lastScaleOutTick !== undefined
      ? Math.max(0, this.config.scaleOutCooldown - (currentTick - this.lastScaleOutTick))
      : 0;

    const scaleInCooldownRemaining = this.lastScaleInTick !== undefined
      ? Math.max(0, this.config.scaleInCooldown - (currentTick - this.lastScaleInTick))
      : 0;

    const lastDecision = [...this.history]
      .reverse()
      .find(h => h.decision)?.decision;

    return {
      currentTotalReplicas: this.replicas.size,
      currentReadyReplicas: readyHealthy.length,
      currentHealthyCapacity: healthyCapacity,
      currentActiveRequests: totalActive,
      currentModeledUtilization: utilization,
      scaleOutCount: this.scaleOutCount,
      scaleInCount: this.scaleInCount,
      totalCreatedReplicas: this.totalCreatedCount,
      totalRemovedReplicas: this.totalRemovedCount,
      cooldownRemaining: {
        scaleOut: scaleOutCooldownRemaining,
        scaleIn: scaleInCooldownRemaining
      },
      history: [...this.history],
      lastDecision
    };
  }

  public reset(): void {
    this.initializeReplicas();
  }
}
