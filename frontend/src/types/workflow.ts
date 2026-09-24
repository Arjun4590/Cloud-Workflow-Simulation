export type ResourceType =
  | "image"
  | "container"
  | "registry"
  | "cluster"
  | "node"
  | "pod"
  | "deployment"
  | "service"
  | "load_balancer"
  | "network"
  | "subnet"
  | "frontend"
  | "backend"
  | "api"
  | "sql_database"
  | "nosql_database"
  | "cache";

export interface CloudResource {
  id: string;
  type: ResourceType;
  name: string;
  configuration: Record<string, any>;
  metadata?: Record<string, any>;
}

export type ConnectionType = 
  | "dependency"
  | "manages"
  | "routes_to"
  | "uses"
  | "contains"
  | "exposes";

export interface WorkflowConnection {
  id: string;
  source: string;
  target: string;
  type: ConnectionType;
  metadata?: Record<string, any>;
}

export interface CloudProject {
  id: string;
  name: string;
  resources: CloudResource[];
  connections: WorkflowConnection[];
  metadata?: Record<string, any>;
}

// UI state models for the workflow designer
export interface NodePosition {
  x: number;
  y: number;
}

export interface NodePositions {
  [nodeId: string]: NodePosition;
}

export interface ProjectState {
  project: CloudProject;
  positions: NodePositions;
}
