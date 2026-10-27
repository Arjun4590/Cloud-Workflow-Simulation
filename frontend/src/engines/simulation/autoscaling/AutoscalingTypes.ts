export type ReplicaLifecycleState = 
  | "provisioning"
  | "ready"
  | "draining"
  | "terminated";

export interface VirtualReplica {
  id: string;
  baseResourceId: string;
  name: string;
  state: ReplicaLifecycleState;
  isFailed: boolean;
  failureReason?: string;
  activeRequests: number;
  handledRequests: number;
  failedRequests: number;
  modeledCapacity: number;
  createdTick: number;
  readyTick?: number;
  drainStartedTick?: number;
  terminatedTick?: number;
  databaseNodeId?: string;
}

export interface AutoscalingConfig {
  enabled: boolean;
  minReplicas: number;
  initialReplicas: number;
  maxReplicas: number;
  scaleOutThreshold: number; // e.g. 80 (percentage)
  scaleInThreshold: number;  // e.g. 30 (percentage)
  scaleOutCooldown: number;  // ticks (e.g. 3)
  scaleInCooldown: number;   // ticks (e.g. 5)
  modeledCapacityPerReplica: number; // concurrent requests per replica (e.g. 3)
  scaleOutIncrement: number; // default 1
  scaleInDecrement: number; // default 1
  startupDelayTicks: number; // default 1 tick
}

export const DEFAULT_AUTOSCALING_CONFIG: AutoscalingConfig = {
  enabled: false,
  minReplicas: 2,
  initialReplicas: 2,
  maxReplicas: 5,
  scaleOutThreshold: 80,
  scaleInThreshold: 30,
  scaleOutCooldown: 3,
  scaleInCooldown: 5,
  modeledCapacityPerReplica: 3,
  scaleOutIncrement: 1,
  scaleInDecrement: 1,
  startupDelayTicks: 1
};

export type ScalingDirection = "SCALE_OUT" | "SCALE_IN" | "NONE";

export type ScalingTriggerReason =
  | "HIGH_UTILIZATION"
  | "LOW_UTILIZATION"
  | "BLOCKED_MAX_CAPACITY"
  | "BLOCKED_MIN_CAPACITY"
  | "BLOCKED_COOLDOWN"
  | "NO_ACTION_IN_HYSTERESIS"
  | "NO_HEALTHY_CAPACITY"
  | "DISABLED";

export interface ScalingDecision {
  direction: ScalingDirection;
  trigger: ScalingTriggerReason;
  tick: number;
  currentReplicas: number;
  targetReplicas: number;
  currentUtilization: number;
  threshold: number;
  reason: string;
  affectedReplicaIds?: string[];
}

export interface AutoscalingHistoryPoint {
  tick: number;
  utilization: number;
  totalReplicas: number;
  readyReplicas: number;
  activeRequests: number;
  healthyCapacity: number;
  decision?: ScalingDecision;
}

export interface AutoscalingMetrics {
  currentTotalReplicas: number;
  currentReadyReplicas: number;
  currentHealthyCapacity: number;
  currentActiveRequests: number;
  currentModeledUtilization: number; // 0 - 100 percentage
  scaleOutCount: number;
  scaleInCount: number;
  totalCreatedReplicas: number;
  totalRemovedReplicas: number;
  cooldownRemaining: {
    scaleOut: number;
    scaleIn: number;
  };
  history: AutoscalingHistoryPoint[];
  lastDecision?: ScalingDecision;
}

export interface AutoscalingValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateAutoscalingConfig(config: AutoscalingConfig): AutoscalingValidationResult {
  const errors: string[] = [];

  if (config.minReplicas < 1) {
    errors.push("Minimum replicas must be at least 1.");
  }
  if (config.maxReplicas < config.minReplicas) {
    errors.push("Maximum replicas must be greater than or equal to minimum replicas.");
  }
  if (config.initialReplicas < config.minReplicas || config.initialReplicas > config.maxReplicas) {
    errors.push(`Initial replicas (${config.initialReplicas}) must be between minimum (${config.minReplicas}) and maximum (${config.maxReplicas}).`);
  }
  if (config.scaleOutThreshold <= 0 || config.scaleOutThreshold > 100) {
    errors.push("Scale-out threshold must be between 1% and 100%.");
  }
  if (config.scaleInThreshold < 0 || config.scaleInThreshold >= 100) {
    errors.push("Scale-in threshold must be between 0% and 99%.");
  }
  if (config.scaleInThreshold >= config.scaleOutThreshold) {
    errors.push(`Scale-in threshold (${config.scaleInThreshold}%) must be strictly lower than scale-out threshold (${config.scaleOutThreshold}%) to prevent oscillation.`);
  }
  if (config.scaleOutCooldown < 0 || config.scaleInCooldown < 0) {
    errors.push("Cooldown periods must be non-negative integers.");
  }
  if (config.modeledCapacityPerReplica < 1) {
    errors.push("Modeled capacity per replica must be at least 1 concurrent request.");
  }
  if (config.scaleOutIncrement < 1 || config.scaleInDecrement < 1) {
    errors.push("Scale increments and decrements must be at least 1.");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
