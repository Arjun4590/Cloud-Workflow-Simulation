import type { CloudProject, CloudResource, WorkflowConnection } from "../../types/workflow";
import type { ExecutionPlan } from "../types";
import { WorkflowEngine } from "../workflow/WorkflowEngine";
import type {
  ResourceRuntimeInfo,
  RoutingAlgorithmType,
  SimulatedRequest,
  SimulationConfig,
  SimulationEvent,
  SimulationMetrics,
  SimulationSnapshot,
  SimulationStatus
} from "./SimulationTypes";
import { DEFAULT_SIMULATION_CONFIG } from "./SimulationTypes";
import type { IRoutingAlgorithm } from "./algorithms/RoutingAlgorithm";
import { LeastConnectionsAlgorithm } from "./algorithms/LeastConnections";
import { RoundRobinAlgorithm } from "./algorithms/RoundRobin";
import type { BaseBackendModel } from "./autoscaling/AutoscalingEngine";
import { AutoscalingEngine } from "./autoscaling/AutoscalingEngine";
import type { VirtualReplica } from "./autoscaling/AutoscalingTypes";

export class SimulationEngine {
  private projectSnapshot: CloudProject;
  private plan: ExecutionPlan;
  private config: SimulationConfig;

  private status: SimulationStatus = "idle";
  private currentTick: number = 0;
  private currentStageIndex: number = 0;

  private resourceStates: Map<string, ResourceRuntimeInfo> = new Map();
  private requests: SimulatedRequest[] = [];
  private events: SimulationEvent[] = [];

  private roundRobinAlgo: RoundRobinAlgorithm = new RoundRobinAlgorithm();
  private leastConnsAlgo: LeastConnectionsAlgorithm = new LeastConnectionsAlgorithm();
  private currentAlgorithm: IRoutingAlgorithm;

  private autoscalingEngine!: AutoscalingEngine;

  private failureCount: number = 0;
  private recoveryCount: number = 0;
  private nextEventCounter: number = 1;
  private nextRequestCounter: number = 1;

  // Active path and edge highlights for UI rendering
  private activeEdgeIds: Set<string> = new Set();
  private activeRequestPaths: string[][] = [];

  constructor(project: CloudProject, config: Partial<SimulationConfig> = {}) {
    // Snapshot project to avoid mutations
    this.projectSnapshot = JSON.parse(JSON.stringify(project));
    this.config = { ...DEFAULT_SIMULATION_CONFIG, ...config };

    this.currentAlgorithm = this.config.routingAlgorithm === "least_connections"
      ? this.leastConnsAlgo
      : this.roundRobinAlgo;

    // Validate and build plan
    this.plan = WorkflowEngine.buildExecutionPlan(this.projectSnapshot);
    this.initializeState();
  }

  /**
   * Discovers base backend instances participating in load balancing
   */
  private discoverBaseBackends(): BaseBackendModel[] {
    const lbNode = this.projectSnapshot.resources.find(r => r.type === "load_balancer");
    let backendNodes: CloudResource[] = [];

    if (lbNode) {
      const targetIds = this.projectSnapshot.connections
        .filter(c => c.source === lbNode.id && (c.type === "routes_to" || c.type === "dependency"))
        .map(c => c.target);
      backendNodes = this.projectSnapshot.resources.filter(r => targetIds.includes(r.id));
    }

    if (backendNodes.length === 0) {
      backendNodes = this.projectSnapshot.resources.filter(
        r => r.type === "backend" || r.type === "service" || r.type === "container" || r.type === "pod"
      );
    }

    if (backendNodes.length === 0) {
      backendNodes = this.projectSnapshot.resources.filter(
        r => r.type !== "frontend" && r.type !== "api" && r.type !== "load_balancer"
      );
    }

    return backendNodes.map(r => {
      const dbConn = this.projectSnapshot.connections.find(
        c => c.source === r.id && (c.type === "uses" || c.type === "dependency")
      );
      return {
        id: r.id,
        name: r.configuration?.name || r.name || r.id,
        type: r.type,
        databaseNodeId: dbConn?.target,
        loadBalancerId: lbNode?.id
      };
    });
  }

  /**
   * Builds combined runtime states for routing algorithm selection
   */
  private getRoutingResourceStates(): Map<string, ResourceRuntimeInfo> {
    const map = new Map<string, ResourceRuntimeInfo>(this.resourceStates);
    if (this.autoscalingEngine) {
      for (const replica of this.autoscalingEngine.getAllReplicas()) {
        map.set(replica.id, {
          resourceId: replica.id,
          name: replica.name,
          type: "backend",
          state: replica.state === "ready"
            ? "ready"
            : (replica.state === "provisioning" ? "pending" : (replica.state === "draining" ? "running" : "unavailable")),
          activeRequests: replica.activeRequests,
          handledRequests: replica.handledRequests,
          failedRequests: replica.failedRequests,
          isFailed: replica.isFailed,
          failureReason: replica.failureReason
        });
      }
    }
    return map;
  }

  /**
   * Initialize or re-initialize resource states, autoscaling, and metrics
   */
  private initializeState(): void {
    this.resourceStates.clear();
    this.requests = [];
    this.events = [];
    this.currentTick = 0;
    this.currentStageIndex = 0;
    this.failureCount = 0;
    this.recoveryCount = 0;
    this.nextEventCounter = 1;
    this.nextRequestCounter = 1;
    this.activeEdgeIds.clear();
    this.activeRequestPaths = [];

    this.roundRobinAlgo.reset();
    this.leastConnsAlgo.reset();

    for (const res of this.projectSnapshot.resources) {
      this.resourceStates.set(res.id, {
        resourceId: res.id,
        name: res.configuration?.name || res.name || res.id,
        type: res.type,
        state: "pending",
        activeRequests: 0,
        handledRequests: 0,
        failedRequests: 0,
        isFailed: false
      });
    }

    const baseBackends = this.discoverBaseBackends();
    this.autoscalingEngine = new AutoscalingEngine(baseBackends, this.config.autoscaling);

    if (!this.plan.valid) {
      this.status = "failed";
      this.emitEvent({
        category: "simulation",
        type: "SIMULATION_INIT_FAILED",
        severity: "ERROR",
        message: `Simulation cannot initialize: ${this.plan.errors[0]?.message || 'Architecture validation failed'}`
      });
    } else {
      this.status = "ready";
    }
  }

  public getStatus(): SimulationStatus {
    return this.status;
  }

  public getConfig(): SimulationConfig {
    return { ...this.config };
  }

  public getAutoscalingEngine(): AutoscalingEngine {
    return this.autoscalingEngine;
  }

  public setAlgorithm(algo: RoutingAlgorithmType): void {
    this.config.routingAlgorithm = algo;
    this.currentAlgorithm = algo === "least_connections"
      ? this.leastConnsAlgo
      : this.roundRobinAlgo;
  }

  public setConfig(config: Partial<SimulationConfig>): void {
    const prevAutoscalingEnabled = this.config.autoscaling?.enabled;
    this.config = { ...this.config, ...config };

    if (config.routingAlgorithm) {
      this.setAlgorithm(config.routingAlgorithm);
    }

    if (config.autoscaling && this.autoscalingEngine) {
      this.autoscalingEngine.setConfig(this.config.autoscaling);
      if (prevAutoscalingEnabled !== undefined && prevAutoscalingEnabled !== this.config.autoscaling.enabled) {
        this.emitEvent({
          category: "autoscaling",
          type: this.config.autoscaling.enabled ? "AUTOSCALING_ENABLED" : "AUTOSCALING_DISABLED",
          severity: "INFO",
          message: this.config.autoscaling.enabled
            ? `Autoscaling enabled: Min=${this.config.autoscaling.minReplicas}, Max=${this.config.autoscaling.maxReplicas}, Scale-Out>=${this.config.autoscaling.scaleOutThreshold}%, Scale-In<=${this.config.autoscaling.scaleInThreshold}%.`
            : "Autoscaling disabled. System operating in fixed capacity mode."
        });
      }
    }
  }

  /**
   * Start or resume simulation
   */
  public start(): SimulationSnapshot {
    if (this.status === "failed") {
      return this.getSnapshot();
    }

    if (this.status === "idle" || this.status === "ready") {
      this.status = "running";
      this.emitEvent({
        category: "simulation",
        type: "SIMULATION_STARTED",
        severity: "INFO",
        message: `Simulation started with ${this.projectSnapshot.resources.length} resources, ${this.plan.stages.length} execution stages, using ${this.currentAlgorithm.name} routing.`
      });
    } else if (this.status === "paused") {
      this.status = "running";
      this.emitEvent({
        category: "simulation",
        type: "SIMULATION_RESUMED",
        severity: "INFO",
        message: `Simulation resumed at tick ${this.currentTick}.`
      });
    }

    return this.getSnapshot();
  }

  /**
   * Pause simulation
   */
  public pause(): SimulationSnapshot {
    if (this.status === "running") {
      this.status = "paused";
      this.emitEvent({
        category: "simulation",
        type: "SIMULATION_PAUSED",
        severity: "INFO",
        message: `Simulation paused at tick ${this.currentTick}.`
      });
    }
    return this.getSnapshot();
  }

  /**
   * Reset simulation to pristine state
   */
  public reset(): SimulationSnapshot {
    this.initializeState();
    this.emitEvent({
      category: "simulation",
      type: "SIMULATION_RESET",
      severity: "INFO",
      message: `Simulation reset to initial state.`
    });
    return this.getSnapshot();
  }

  /**
   * Advance simulation by exactly one logical tick
   */
  public step(): SimulationSnapshot {
    if (this.status === "completed" || this.status === "failed") {
      return this.getSnapshot();
    }

    if (this.status === "idle" || this.status === "ready") {
      this.status = "running";
      this.emitEvent({
        category: "simulation",
        type: "SIMULATION_STARTED",
        severity: "INFO",
        message: `Simulation started (single step mode).`
      });
    }

    this.currentTick++;
    this.activeEdgeIds.clear();
    this.activeRequestPaths = [];

    // Phase 0: Advance virtual replica lifecycle (provisioning -> ready, draining -> terminated)
    const lifecycleResult = this.autoscalingEngine.advanceLifecycle(this.currentTick);
    for (const prov of lifecycleResult.provisioned) {
      this.emitEvent({
        category: "autoscaling",
        type: "REPLICA_READY",
        resourceId: prov.id,
        severity: "SUCCESS",
        message: `Replica "${prov.name}" (${prov.id}) finished startup delay and is now READY to receive traffic.`
      });
    }
    for (const term of lifecycleResult.terminated) {
      this.emitEvent({
        category: "autoscaling",
        type: "REPLICA_REMOVED",
        resourceId: term.id,
        severity: "INFO",
        message: `Replica "${term.name}" (${term.id}) finished draining all in-flight requests and was safely TERMINATED.`
      });
    }

    // Phase 1: Advance infrastructure / dependency execution stages
    this.processExecutionStages();

    // Phase 2: Process traffic routing
    this.processTrafficRouting();

    // Phase 3: Evaluate Autoscaling policy (if enabled)
    if (this.config.autoscaling?.enabled) {
      const scalingResult = this.autoscalingEngine.evaluateAndStep(this.currentTick);
      const dec = scalingResult.decision;

      if (dec.direction === "SCALE_OUT") {
        this.emitEvent({
          category: "autoscaling",
          type: "SCALE_OUT_TRIGGERED",
          severity: "INFO",
          message: `Scale-out triggered: modeled utilization reached ${dec.currentUtilization.toFixed(1)}% (threshold: ${this.config.autoscaling.scaleOutThreshold}%). Scaling from ${dec.currentReplicas} to ${dec.targetReplicas} replicas.`,
          details: { decision: dec }
        });
        for (const newRep of scalingResult.newReplicas) {
          if (newRep.state === "provisioning") {
            this.emitEvent({
              category: "autoscaling",
              type: "REPLICA_PROVISIONING",
              resourceId: newRep.id,
              severity: "INFO",
              message: `Provisioning virtual replica "${newRep.name}" (will become ready at tick ${newRep.readyTick}).`
            });
          } else {
            this.emitEvent({
              category: "autoscaling",
              type: "REPLICA_READY",
              resourceId: newRep.id,
              severity: "SUCCESS",
              message: `Virtual replica "${newRep.name}" provisioned and immediately READY for traffic.`
            });
          }
        }
      } else if (dec.direction === "SCALE_IN") {
        this.emitEvent({
          category: "autoscaling",
          type: "SCALE_IN_TRIGGERED",
          severity: "INFO",
          message: `Scale-in triggered: modeled utilization fell to ${dec.currentUtilization.toFixed(1)}% (threshold: ${this.config.autoscaling.scaleInThreshold}%). Scaling down from ${dec.currentReplicas} to ${dec.targetReplicas} replicas.`,
          details: { decision: dec }
        });
        for (const victim of scalingResult.drainingReplicas) {
          if (victim.state === "draining") {
            this.emitEvent({
              category: "autoscaling",
              type: "REPLICA_DRAINING",
              resourceId: victim.id,
              severity: "WARNING",
              message: `Replica "${victim.name}" entered DRAINING state (${victim.activeRequests} in-flight request(s) completing).`
            });
          } else if (victim.state === "terminated") {
            this.emitEvent({
              category: "autoscaling",
              type: "REPLICA_REMOVED",
              resourceId: victim.id,
              severity: "INFO",
              message: `Replica "${victim.name}" had no active requests and was immediately TERMINATED.`
            });
          }
        }
      } else if (dec.trigger === "BLOCKED_MAX_CAPACITY" && dec.currentUtilization >= this.config.autoscaling.scaleOutThreshold) {
        this.emitEvent({
          category: "autoscaling",
          type: "SCALING_BLOCKED_MAX_CAPACITY",
          severity: "WARNING",
          message: `Scale-out blocked: utilization is ${dec.currentUtilization.toFixed(1)}%, but maximum configured capacity (${this.config.autoscaling.maxReplicas} replicas) has been reached.`
        });
      }
    }

    // Check completion condition
    this.checkCompletion();

    return this.getSnapshot();
  }

  /**
   * Handles stage-by-stage deployment/boot of resources based on topological plan
   */
  private processExecutionStages(): void {
    if (this.plan.stages.length === 0) return;

    if (this.currentStageIndex >= this.plan.stages.length) {
      // All stages completed
      return;
    }

    const stage = this.plan.stages[this.currentStageIndex];
    let allStageResourcesCompleted = true;

    for (const resId of stage.resourceIds) {
      const state = this.resourceStates.get(resId);
      if (!state) continue;

      if (state.isFailed) {
        allStageResourcesCompleted = false;
        continue;
      }

      if (state.state === "pending") {
        // Transition to ready then running
        state.state = "running";
        this.emitEvent({
          category: "stage",
          type: "STAGE_RESOURCE_BOOTING",
          resourceId: resId,
          severity: "INFO",
          message: `Stage ${stage.index}: Resource "${state.name}" (${state.type}) has satisfied prerequisites and is booting.`
        });
        allStageResourcesCompleted = false;
      } else if (state.state === "running") {
        // Complete execution after 1 tick of running
        state.state = "completed";
        state.completedAtTick = this.currentTick;
        this.emitEvent({
          category: "stage",
          type: "STAGE_RESOURCE_COMPLETED",
          resourceId: resId,
          severity: "SUCCESS",
          message: `Stage ${stage.index}: Resource "${state.name}" successfully provisioned and ready for traffic.`
        });
      } else if (state.state !== "completed") {
        allStageResourcesCompleted = false;
      }
    }

    if (allStageResourcesCompleted) {
      this.currentStageIndex++;
      if (this.currentStageIndex < this.plan.stages.length) {
        this.emitEvent({
          category: "stage",
          type: "STAGE_ADVANCED",
          severity: "INFO",
          message: `Execution Stage ${stage.index} finished. Advancing to Stage ${this.currentStageIndex + 1}.`
        });
      }
    }
  }

  /**
   * Simulates application request routing and load balancing:
   * Client -> Load Balancer -> Selected Backend -> Database
   */
  private processTrafficRouting(): void {
    // 1. Advance in-flight requests
    this.advanceInFlightRequests();

    // 2. Generate new request if schedule dictates and limit not reached
    const shouldGenerate = 
      this.requests.length < this.config.totalRequests &&
      (this.currentTick % this.config.requestIntervalTicks === 0);

    if (shouldGenerate) {
      this.generateAndRouteRequest();
    }
  }

  /**
   * Generates a new request from client/frontend to load balancer and routes it
   */
  private generateAndRouteRequest(): void {
    const requestId = `REQ-${String(this.nextRequestCounter++).padStart(3, "0")}`;

    // Find client/frontend node
    const clientNode = this.projectSnapshot.resources.find(
      r => r.type === "frontend" || r.type === "api"
    ) || this.projectSnapshot.resources[0];

    if (!clientNode) return;

    // Find load balancer connected from client or existing in project
    const lbConn = this.projectSnapshot.connections.find(
      c => (c.source === clientNode.id || c.target === clientNode.id) &&
           (this.getResource(c.target)?.type === "load_balancer" || this.getResource(c.source)?.type === "load_balancer")
    );

    let lbNode = this.projectSnapshot.resources.find(r => r.type === "load_balancer");
    if (lbConn) {
      lbNode = this.getResource(lbConn.target)?.type === "load_balancer"
        ? this.getResource(lbConn.target)
        : this.getResource(lbConn.source);
    }

    // Backend discovery: prefer dynamic replica registry from AutoscalingEngine
    const allReplicas = this.autoscalingEngine ? this.autoscalingEngine.getAllReplicas() : [];
    let candidateIds: string[] = [];

    if (allReplicas.length > 0) {
      candidateIds = this.autoscalingEngine.getEligibleTargetIds();
    } else {
      if (lbNode) {
        candidateIds = this.projectSnapshot.connections
          .filter(c => c.source === lbNode!.id && c.type === "routes_to")
          .map(c => c.target);

        if (candidateIds.length === 0) {
          candidateIds = this.projectSnapshot.resources
            .filter(r => r.type === "backend" || r.type === "service" || r.type === "container" || r.type === "pod")
            .map(r => r.id);
        }
      } else {
        candidateIds = this.projectSnapshot.connections
          .filter(c => c.source === clientNode.id && (c.type === "routes_to" || c.type === "dependency"))
          .map(c => c.target);

        if (candidateIds.length === 0) {
          candidateIds = this.projectSnapshot.resources
            .filter(r => r.id !== clientNode.id)
            .map(r => r.id);
        }
      }
    }

    const req: SimulatedRequest = {
      id: requestId,
      clientNodeId: clientNode.id,
      lbNodeId: lbNode?.id,
      state: "queued",
      createdAtTick: this.currentTick,
      path: [clientNode.id]
    };

    this.requests.push(req);
    this.emitEvent({
      category: "request",
      type: "REQUEST_CREATED",
      requestId: req.id,
      resourceId: clientNode.id,
      severity: "INFO",
      message: `Client "${clientNode.configuration?.name || clientNode.id}" generated request ${req.id}.`
    });

    // If there is an LB, path includes LB
    if (lbNode) {
      req.path.push(lbNode.id);
      const edgeToLb = this.findConnection(clientNode.id, lbNode.id);
      if (edgeToLb) this.activeEdgeIds.add(edgeToLb.id);
    }

    // Build resource names dictionary including all dynamic replicas
    const resourceNames: Record<string, string> = {};
    for (const r of this.projectSnapshot.resources) {
      resourceNames[r.id] = r.configuration?.name || r.name || r.id;
    }
    for (const rep of allReplicas) {
      resourceNames[rep.id] = rep.name;
    }

    const routingStates = this.getRoutingResourceStates();

    const routingDecision = this.currentAlgorithm.selectTarget(
      candidateIds,
      routingStates,
      {
        tick: this.currentTick,
        requestId: req.id,
        loadBalancerId: lbNode?.id || clientNode.id,
        loadBalancerName: lbNode?.configuration?.name || "Ingress",
        resourceNames
      }
    );

    if (!routingDecision) {
      // No healthy backend available!
      req.state = "failed";
      req.error = "No healthy backend instances available to serve request";
      req.completedAtTick = this.currentTick;
      req.latencyTicks = 1;
      this.emitEvent({
        category: "failure",
        type: "REQUEST_ROUTING_REJECTED",
        requestId: req.id,
        severity: "ERROR",
        message: `Request ${req.id} rejected: no healthy backend targets available.`
      });
      return;
    }

    // Routing succeeded
    req.routingDecision = routingDecision;
    req.targetNodeId = routingDecision.selectedTargetId;
    req.state = "in_progress";
    req.startedAtTick = this.currentTick;
    req.path.push(routingDecision.selectedTargetId);

    // Active edge from LB (or client) to Target:
    // If target is a replica, map to its base resource for visual flow edge
    const rep = this.autoscalingEngine?.getReplica(routingDecision.selectedTargetId);
    const connectionTargetId = rep ? rep.baseResourceId : routingDecision.selectedTargetId;

    const sourceNodeId = lbNode ? lbNode.id : clientNode.id;
    const edgeToTarget = this.findConnection(sourceNodeId, connectionTargetId);
    if (edgeToTarget) this.activeEdgeIds.add(edgeToTarget.id);

    // Increment replica and backend active count
    if (this.autoscalingEngine) {
      this.autoscalingEngine.onReplicaRequestAssigned(routingDecision.selectedTargetId);
    }
    const backendState = this.resourceStates.get(connectionTargetId);
    if (backendState) {
      backendState.activeRequests++;
      backendState.handledRequests++;
      if (backendState.state !== "unavailable" && backendState.state !== "failed") {
        backendState.state = "running";
      }
    }

    this.activeRequestPaths.push([...req.path]);

    this.emitEvent({
      category: "routing",
      type: "REQUEST_ROUTED",
      requestId: req.id,
      resourceId: routingDecision.selectedTargetId,
      severity: "INFO",
      message: `Request ${req.id} routed to "${resourceNames[routingDecision.selectedTargetId] || routingDecision.selectedTargetId}" using ${this.currentAlgorithm.name}.`,
      details: {
        reason: routingDecision.reason,
        activeLoads: routingDecision.targetActiveConnections
      }
    });

    // Check if target backend has a database/cache connection
    const dbTargetId = rep?.databaseNodeId || this.projectSnapshot.connections.find(
      c => c.source === connectionTargetId && (c.type === "uses" || c.type === "dependency")
    )?.target;

    if (dbTargetId) {
      req.databaseNodeId = dbTargetId;
      req.path.push(dbTargetId);
      const dbEdge = this.findConnection(connectionTargetId, dbTargetId);
      if (dbEdge) this.activeEdgeIds.add(dbEdge.id);
    }
  }

  /**
   * Advances active in-flight requests and handles completion
   */
  private advanceInFlightRequests(): void {
    for (const req of this.requests) {
      if (req.state !== "in_progress") continue;

      const replica = req.targetNodeId && this.autoscalingEngine
        ? this.autoscalingEngine.getReplica(req.targetNodeId)
        : undefined;
      const baseId = replica ? replica.baseResourceId : req.targetNodeId;
      const backendState = baseId ? this.resourceStates.get(baseId) : undefined;

      // Check if backend or replica died while processing request
      const isFailed = (replica && replica.isFailed) ||
        (backendState && (backendState.isFailed || backendState.state === "unavailable" || backendState.state === "failed"));

      if (isFailed) {
        req.state = "failed";
        const targetName = replica?.name || backendState?.name || "Target Instance";
        req.error = `Backend instance "${targetName}" failed during request processing.`;
        req.completedAtTick = this.currentTick;
        req.latencyTicks = this.currentTick - req.createdAtTick;

        if (req.targetNodeId && this.autoscalingEngine) {
          this.autoscalingEngine.onReplicaRequestCompleted(req.targetNodeId, false);
        }
        if (backendState) {
          backendState.failedRequests++;
          backendState.activeRequests = Math.max(0, backendState.activeRequests - 1);
        }

        this.emitEvent({
          category: "failure",
          type: "REQUEST_FAILED_IN_FLIGHT",
          requestId: req.id,
          resourceId: req.targetNodeId,
          severity: "ERROR",
          message: `Request ${req.id} failed: target instance "${targetName}" became unavailable.`
        });
        continue;
      }

      // Check if request processing time has elapsed
      const processingTicks = this.currentTick - (req.startedAtTick ?? req.createdAtTick);
      if (processingTicks >= this.config.processingTicksPerRequest) {
        req.state = "completed";
        req.completedAtTick = this.currentTick;
        req.latencyTicks = this.currentTick - req.createdAtTick;

        if (req.targetNodeId && this.autoscalingEngine) {
          this.autoscalingEngine.onReplicaRequestCompleted(req.targetNodeId, true);
        }
        if (backendState) {
          backendState.activeRequests = Math.max(0, backendState.activeRequests - 1);
          if (backendState.activeRequests === 0 && !backendState.isFailed) {
            backendState.state = "ready";
          }
        }

        // Database/cache completion event if connected
        if (req.databaseNodeId) {
          const dbName = this.resourceStates.get(req.databaseNodeId)?.name || req.databaseNodeId;
          this.emitEvent({
            category: "resource",
            type: "DATABASE_OPERATION_COMPLETED",
            requestId: req.id,
            resourceId: req.databaseNodeId,
            severity: "SUCCESS",
            message: `Database operation on "${dbName}" for request ${req.id} committed successfully.`
          });
        }

        const targetName = replica?.name || backendState?.name || req.targetNodeId;
        this.emitEvent({
          category: "request",
          type: "REQUEST_COMPLETED",
          requestId: req.id,
          resourceId: req.targetNodeId,
          severity: "SUCCESS",
          message: `Request ${req.id} completed successfully by "${targetName}" in ${req.latencyTicks} ticks (${processingTicks} ticks processing).`
        });
      } else {
        // Still processing: keep active path visible
        this.activeRequestPaths.push([...req.path]);
        for (let i = 0; i < req.path.length - 1; i++) {
          const repFrom = this.autoscalingEngine?.getReplica(req.path[i]);
          const repTo = this.autoscalingEngine?.getReplica(req.path[i + 1]);
          const fromId = repFrom ? repFrom.baseResourceId : req.path[i];
          const toId = repTo ? repTo.baseResourceId : req.path[i + 1];
          const conn = this.findConnection(fromId, toId);
          if (conn) this.activeEdgeIds.add(conn.id);
        }
      }
    }
  }

  /**
   * Failure Injection: marks a resource unavailable and interrupts in-flight requests
   */
  public injectFailure(resourceId: string, reason: string = "Simulated node crash / outage"): SimulationSnapshot {
    const res = this.resourceStates.get(resourceId);
    if (res) {
      res.isFailed = true;
      res.state = "unavailable";
      res.failureReason = reason;
      this.failureCount++;
    }

    if (this.autoscalingEngine) {
      this.autoscalingEngine.injectReplicaFailure(resourceId, reason);
      for (const rep of this.autoscalingEngine.getAllReplicas()) {
        if (rep.baseResourceId === resourceId) {
          this.autoscalingEngine.injectReplicaFailure(rep.id, reason);
        }
      }
    }

    this.emitEvent({
      category: "failure",
      type: "RESOURCE_FAILED",
      resourceId,
      severity: "ERROR",
      message: `FAILURE INJECTED: Resource "${res?.name || resourceId}" crashed or became unavailable. Reason: ${reason}`
    });

    // Terminate any active requests currently assigned to this failed instance or replica
    for (const req of this.requests) {
      const isTarget = req.targetNodeId === resourceId ||
        (req.targetNodeId && this.autoscalingEngine?.getReplica(req.targetNodeId)?.baseResourceId === resourceId);

      if (req.state === "in_progress" && isTarget) {
        req.state = "failed";
        req.error = `Interrupted by host failure: ${reason}`;
        req.completedAtTick = this.currentTick;
        req.latencyTicks = this.currentTick - req.createdAtTick;

        if (req.targetNodeId && this.autoscalingEngine) {
          this.autoscalingEngine.onReplicaRequestCompleted(req.targetNodeId, false);
        }
        if (res) {
          res.failedRequests++;
          res.activeRequests = Math.max(0, res.activeRequests - 1);
        }

        this.emitEvent({
          category: "failure",
          type: "REQUEST_INTERRUPTED_BY_CRASH",
          requestId: req.id,
          resourceId: req.targetNodeId,
          severity: "ERROR",
          message: `Request ${req.id} was aborted due to crash of instance "${res?.name || resourceId}".`
        });
      }
    }

    return this.getSnapshot();
  }

  /**
   * Failure Recovery: restores an unavailable resource back to health
   */
  public recoverResource(resourceId: string): SimulationSnapshot {
    const res = this.resourceStates.get(resourceId);
    if (res) {
      res.isFailed = false;
      res.state = "ready";
      res.failureReason = undefined;
      this.recoveryCount++;
    }

    if (this.autoscalingEngine) {
      this.autoscalingEngine.recoverReplica(resourceId);
      for (const rep of this.autoscalingEngine.getAllReplicas()) {
        if (rep.baseResourceId === resourceId) {
          this.autoscalingEngine.recoverReplica(rep.id);
        }
      }
    }

    this.emitEvent({
      category: "recovery",
      type: "RESOURCE_RECOVERED",
      resourceId,
      severity: "SUCCESS",
      message: `RECOVERY: Resource "${res?.name || resourceId}" has restored health and returned to eligible pool.`
    });

    return this.getSnapshot();
  }

  /**
   * Check if simulation run has completed all planned workload
   */
  private checkCompletion(): void {
    const allRequestsProcessed = 
      this.requests.length >= this.config.totalRequests &&
      this.requests.every(r => r.state === "completed" || r.state === "failed" || r.state === "rejected");

    const allStagesDone = this.currentStageIndex >= this.plan.stages.length;

    if (allRequestsProcessed && allStagesDone) {
      this.status = "completed";
      const metrics = this.computeMetrics();
      this.emitEvent({
        category: "simulation",
        type: "SIMULATION_COMPLETED",
        severity: "SUCCESS",
        message: `Simulation completed at tick ${this.currentTick}. Total requests: ${metrics.totalRequests}, Success: ${metrics.completedRequests}, Failed: ${metrics.failedRequests} (Success rate: ${metrics.successRate.toFixed(1)}%).`
      });
    }
  }

  public computeMetrics(): SimulationMetrics {
    const totalRequests = this.requests.length;
    const completedRequests = this.requests.filter(r => r.state === "completed").length;
    const failedRequests = this.requests.filter(r => r.state === "failed" || r.state === "rejected").length;
    const inProgressRequests = this.requests.filter(r => r.state === "in_progress").length;
    const queuedRequests = this.requests.filter(r => r.state === "queued").length;

    const successRate = totalRequests > 0 ? (completedRequests / totalRequests) * 100 : 0;
    const failureRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

    const completedWithLatency = this.requests.filter(r => r.latencyTicks !== undefined);
    const avgLatencyTicks = completedWithLatency.length > 0
      ? completedWithLatency.reduce((acc, r) => acc + (r.latencyTicks || 0), 0) / completedWithLatency.length
      : 0;

    const perBackendRequests: Record<string, number> = {};
    const perBackendActive: Record<string, number> = {};

    if (this.autoscalingEngine && this.autoscalingEngine.getAllReplicas().length > 0) {
      for (const rep of this.autoscalingEngine.getAllReplicas()) {
        perBackendRequests[rep.name] = rep.handledRequests;
        perBackendActive[rep.name] = rep.activeRequests;
      }
    } else {
      for (const [id, res] of this.resourceStates.entries()) {
        if (res.handledRequests > 0 || res.activeRequests > 0 || res.type === "backend") {
          perBackendRequests[res.name || id] = res.handledRequests;
          perBackendActive[res.name || id] = res.activeRequests;
        }
      }
    }

    return {
      totalRequests,
      completedRequests,
      failedRequests,
      inProgressRequests,
      queuedRequests,
      successRate,
      failureRate,
      avgLatencyTicks: Number(avgLatencyTicks.toFixed(2)),
      perBackendRequests,
      perBackendActive,
      failureCount: this.failureCount,
      recoveryCount: this.recoveryCount
    };
  }

  public getSnapshot(): SimulationSnapshot {
    const resourcesRecord: Record<string, ResourceRuntimeInfo> = {};
    for (const [id, info] of this.resourceStates.entries()) {
      resourcesRecord[id] = { ...info };
    }

    const lastDecision = [...this.requests]
      .reverse()
      .find(r => r.routingDecision)?.routingDecision;

    const replicasRecord: Record<string, VirtualReplica> = {};
    if (this.autoscalingEngine) {
      for (const rep of this.autoscalingEngine.getAllReplicas()) {
        replicasRecord[rep.id] = { ...rep };
      }
    }

    return {
      status: this.status,
      currentTick: this.currentTick,
      currentStageIndex: this.currentStageIndex,
      totalStages: this.plan.stages.length,
      resources: resourcesRecord,
      virtualReplicas: replicasRecord,
      requests: [...this.requests],
      events: [...this.events],
      metrics: this.computeMetrics(),
      autoscaling: this.autoscalingEngine ? this.autoscalingEngine.getMetrics(this.currentTick) : undefined,
      activeEdgeIds: Array.from(this.activeEdgeIds),
      activeRequestPaths: [...this.activeRequestPaths],
      config: { ...this.config },
      lastRoutingDecision: lastDecision,
      errorMessage: this.status === "failed" ? this.plan.errors.map(e => e.message).join("; ") : undefined
    };
  }

  private emitEvent(params: Omit<SimulationEvent, "id" | "tick" | "timestamp">): void {
    const event: SimulationEvent = {
      id: `EVT-${String(this.nextEventCounter++).padStart(4, "0")}`,
      tick: this.currentTick,
      timestamp: Date.now(),
      ...params
    };
    this.events.push(event);
  }

  private getResource(id: string) {
    return this.projectSnapshot.resources.find(r => r.id === id);
  }

  private findConnection(sourceId: string, targetId: string): WorkflowConnection | undefined {
    const repSource = this.autoscalingEngine?.getReplica(sourceId);
    const repTarget = this.autoscalingEngine?.getReplica(targetId);
    const sId = repSource ? repSource.baseResourceId : sourceId;
    const tId = repTarget ? repTarget.baseResourceId : targetId;

    return this.projectSnapshot.connections.find(
      c => (c.source === sId && c.target === tId) ||
           (c.source === tId && c.target === sId)
    );
  }
}
