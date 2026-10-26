export type SimulationStatus = 
  | "idle"
  | "ready"
  | "running"
  | "paused"
  | "completed"
  | "failed";

export type ResourceRuntimeState = 
  | "pending"
  | "ready"
  | "running"
  | "completed"
  | "failed"
  | "unavailable";

export type RequestRuntimeState = 
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "rejected";

export type RoutingAlgorithmType = 
  | "round_robin"
  | "least_connections";

export type SimulationEventCategory = 
  | "simulation"
  | "stage"
  | "resource"
  | "dependency"
  | "request"
  | "routing"
  | "failure"
  | "recovery"
  | "metrics";

export type SimulationEventSeverity = "INFO" | "SUCCESS" | "WARNING" | "ERROR";

export interface SimulationEvent {
  id: string;
  tick: number;
  timestamp: number;
  category: SimulationEventCategory;
  type: string;
  resourceId?: string;
  targetResourceId?: string;
  requestId?: string;
  severity: SimulationEventSeverity;
  message: string;
  details?: Record<string, any>;
}

export interface RoutingDecision {
  algorithm: RoutingAlgorithmType;
  selectedTargetId: string;
  candidateTargetIds: string[];
  targetActiveConnections: Record<string, number>;
  reason: string;
  timestampTick: number;
}

export interface SimulatedRequest {
  id: string;
  clientNodeId: string;
  lbNodeId?: string;
  targetNodeId?: string;
  databaseNodeId?: string;
  state: RequestRuntimeState;
  createdAtTick: number;
  startedAtTick?: number;
  completedAtTick?: number;
  latencyTicks?: number;
  routingDecision?: RoutingDecision;
  path: string[];
  error?: string;
}

export interface ResourceRuntimeInfo {
  resourceId: string;
  name: string;
  type: string;
  state: ResourceRuntimeState;
  activeRequests: number;
  handledRequests: number;
  failedRequests: number;
  isFailed: boolean;
  failureReason?: string;
  completedAtTick?: number;
}

export interface SimulationMetrics {
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  inProgressRequests: number;
  queuedRequests: number;
  successRate: number; // 0 - 100 percentage
  failureRate: number; // 0 - 100 percentage
  avgLatencyTicks: number;
  perBackendRequests: Record<string, number>;
  perBackendActive: Record<string, number>;
  failureCount: number;
  recoveryCount: number;
}

export interface SimulationConfig {
  totalRequests: number;
  requestIntervalTicks: number; // emit request every N ticks
  processingTicksPerRequest: number; // how many ticks a backend takes to process
  routingAlgorithm: RoutingAlgorithmType;
  failFastOnError: boolean;
  seed?: number;
}

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  totalRequests: 8,
  requestIntervalTicks: 2,
  processingTicksPerRequest: 3,
  routingAlgorithm: "round_robin",
  failFastOnError: false
};

export interface SimulationSnapshot {
  status: SimulationStatus;
  currentTick: number;
  currentStageIndex: number;
  totalStages: number;
  resources: Record<string, ResourceRuntimeInfo>;
  requests: SimulatedRequest[];
  events: SimulationEvent[];
  metrics: SimulationMetrics;
  activeEdgeIds: string[];
  activeRequestPaths: string[][];
  config: SimulationConfig;
  lastRoutingDecision?: RoutingDecision;
  errorMessage?: string;
}
