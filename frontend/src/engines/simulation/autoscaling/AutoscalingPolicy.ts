import type { AutoscalingConfig, ScalingDecision } from "./AutoscalingTypes";

export interface PolicyEvaluationContext {
  currentTick: number;
  currentReplicas: number;
  readyHealthyReplicas: number;
  healthyCapacity: number;
  activeRequests: number;
  lastScaleOutTick?: number;
  lastScaleInTick?: number;
}

export class AutoscalingPolicy {
  public static evaluate(
    config: AutoscalingConfig,
    context: PolicyEvaluationContext
  ): ScalingDecision {
    const {
      currentTick,
      currentReplicas,
      readyHealthyReplicas,
      healthyCapacity,
      activeRequests,
      lastScaleOutTick,
      lastScaleInTick
    } = context;

    if (!config.enabled) {
      return {
        direction: "NONE",
        trigger: "DISABLED",
        tick: currentTick,
        currentReplicas,
        targetReplicas: currentReplicas,
        currentUtilization: 0,
        threshold: 0,
        reason: "Autoscaling is disabled; capacity remains fixed."
      };
    }

    // Guard against zero healthy capacity (e.g. all backends failed or not yet booted)
    if (healthyCapacity <= 0) {
      // If we have capacity room and cooldown allows, scale-out can help recover capacity
      const scaleOutCooldownRemaining = lastScaleOutTick !== undefined
        ? Math.max(0, config.scaleOutCooldown - (currentTick - lastScaleOutTick))
        : 0;

      if (currentReplicas < config.maxReplicas && scaleOutCooldownRemaining === 0) {
        const targetReplicas = Math.min(config.maxReplicas, currentReplicas + config.scaleOutIncrement);
        return {
          direction: "SCALE_OUT",
          trigger: "HIGH_UTILIZATION",
          tick: currentTick,
          currentReplicas,
          targetReplicas,
          currentUtilization: 100,
          threshold: config.scaleOutThreshold,
          reason: `Zero healthy capacity detected (${readyHealthyReplicas} ready replicas). Scale-out triggered to provision recovery capacity.`
        };
      }

      return {
        direction: "NONE",
        trigger: "NO_HEALTHY_CAPACITY",
        tick: currentTick,
        currentReplicas,
        targetReplicas: currentReplicas,
        currentUtilization: 100,
        threshold: config.scaleOutThreshold,
        reason: `Zero healthy backend capacity available (${readyHealthyReplicas} ready replicas). Scale-out blocked by maximum capacity or cooldown.`
      };
    }

    // Authoritative modeled utilization formula: (Active Requests / Healthy Capacity) * 100
    const rawUtilization = (activeRequests / healthyCapacity) * 100;
    const currentUtilization = Number(rawUtilization.toFixed(1));

    const scaleOutCooldownRemaining = lastScaleOutTick !== undefined
      ? Math.max(0, config.scaleOutCooldown - (currentTick - lastScaleOutTick))
      : 0;

    const scaleInCooldownRemaining = lastScaleInTick !== undefined
      ? Math.max(0, config.scaleInCooldown - (currentTick - lastScaleInTick))
      : 0;

    // 1. Evaluate Scale-Out Condition
    if (currentUtilization >= config.scaleOutThreshold) {
      if (scaleOutCooldownRemaining > 0) {
        return {
          direction: "NONE",
          trigger: "BLOCKED_COOLDOWN",
          tick: currentTick,
          currentReplicas,
          targetReplicas: currentReplicas,
          currentUtilization,
          threshold: config.scaleOutThreshold,
          reason: `Scale-out threshold reached (${currentUtilization}% >= ${config.scaleOutThreshold}%), but blocked by cooldown (${scaleOutCooldownRemaining} tick(s) remaining).`
        };
      }

      if (currentReplicas >= config.maxReplicas) {
        return {
          direction: "NONE",
          trigger: "BLOCKED_MAX_CAPACITY",
          tick: currentTick,
          currentReplicas,
          targetReplicas: currentReplicas,
          currentUtilization,
          threshold: config.scaleOutThreshold,
          reason: `Scale-out threshold reached (${currentUtilization}% >= ${config.scaleOutThreshold}%), but cluster is already at maximum capacity (${config.maxReplicas} replicas).`
        };
      }

      const targetReplicas = Math.min(config.maxReplicas, currentReplicas + config.scaleOutIncrement);
      return {
        direction: "SCALE_OUT",
        trigger: "HIGH_UTILIZATION",
        tick: currentTick,
        currentReplicas,
        targetReplicas,
        currentUtilization,
        threshold: config.scaleOutThreshold,
        reason: `Modeled utilization reached ${currentUtilization}%, exceeding the ${config.scaleOutThreshold}% threshold. Scaling out from ${currentReplicas} to ${targetReplicas} replicas (+${config.scaleOutIncrement}).`
      };
    }

    // 2. Evaluate Scale-In Condition
    if (currentUtilization <= config.scaleInThreshold) {
      if (scaleInCooldownRemaining > 0) {
        return {
          direction: "NONE",
          trigger: "BLOCKED_COOLDOWN",
          tick: currentTick,
          currentReplicas,
          targetReplicas: currentReplicas,
          currentUtilization,
          threshold: config.scaleInThreshold,
          reason: `Low workload detected (${currentUtilization}% <= ${config.scaleInThreshold}%), but scale-in is blocked by cooldown (${scaleInCooldownRemaining} tick(s) remaining).`
        };
      }

      if (currentReplicas <= config.minReplicas) {
        return {
          direction: "NONE",
          trigger: "BLOCKED_MIN_CAPACITY",
          tick: currentTick,
          currentReplicas,
          targetReplicas: currentReplicas,
          currentUtilization,
          threshold: config.scaleInThreshold,
          reason: `Low workload detected (${currentUtilization}% <= ${config.scaleInThreshold}%), but cluster is at minimum capacity (${config.minReplicas} replicas).`
        };
      }

      const targetReplicas = Math.max(config.minReplicas, currentReplicas - config.scaleInDecrement);
      return {
        direction: "SCALE_IN",
        trigger: "LOW_UTILIZATION",
        tick: currentTick,
        currentReplicas,
        targetReplicas,
        currentUtilization,
        threshold: config.scaleInThreshold,
        reason: `Modeled utilization dropped to ${currentUtilization}%, falling below the ${config.scaleInThreshold}% threshold. Scaling in from ${currentReplicas} to ${targetReplicas} replicas (-${config.scaleInDecrement}).`
      };
    }

    // 3. In Hysteresis Band (Between Scale-In and Scale-Out thresholds)
    return {
      direction: "NONE",
      trigger: "NO_ACTION_IN_HYSTERESIS",
      tick: currentTick,
      currentReplicas,
      targetReplicas: currentReplicas,
      currentUtilization,
      threshold: config.scaleOutThreshold,
      reason: `Workload utilization (${currentUtilization}%) is stable within hysteresis band (${config.scaleInThreshold}% - ${config.scaleOutThreshold}%). Capacity maintained at ${currentReplicas} replicas.`
    };
  }
}
