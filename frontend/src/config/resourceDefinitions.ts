import type { ResourceType } from "../types/workflow";
import { 
  Box, Server, Database, Cloud, Network, 
  Layers, Package, MonitorSmartphone, Settings, Code,
  Cpu, LayoutDashboard
} from "lucide-react";
import React from "react";

export interface ConfigField {
  name: string;
  label: string;
  type: "text" | "number" | "select";
  options?: string[]; // for select
  defaultValue: any;
}

export interface ResourceDefinition {
  type: ResourceType;
  label: string;
  category: "Infrastructure" | "Containers" | "Kubernetes" | "Application" | "Data";
  icon: React.ElementType; // Lucide icon component
  defaultConfiguration: Record<string, any>;
  configurationFields: ConfigField[];
  acceptsIncoming?: Partial<Record<import("../types/workflow").ConnectionType, ResourceType[]>>;
  acceptsOutgoing?: Partial<Record<import("../types/workflow").ConnectionType, ResourceType[]>>;
}

export const RESOURCE_DEFINITIONS: Record<ResourceType, ResourceDefinition> = {
  load_balancer: {
    type: "load_balancer",
    label: "Load Balancer",
    category: "Infrastructure",
    icon: Network,
    defaultConfiguration: {
      name: "load-balancer-1",
      algorithm: "round_robin"
    },
    configurationFields: [
      { name: "name", label: "Name", type: "text", defaultValue: "load-balancer-1" },
      { name: "algorithm", label: "Algorithm", type: "select", options: ["round_robin", "least_connections"], defaultValue: "round_robin" }
    ],
    acceptsIncoming: {
      routes_to: ["frontend", "api"]
    },
    acceptsOutgoing: {
      routes_to: ["service"]
    }
  },
  network: {
    type: "network",
    label: "Network",
    category: "Infrastructure",
    icon: Cloud,
    defaultConfiguration: { name: "vpc-1", cidr: "10.0.0.0/16" },
    configurationFields: [
      { name: "name", label: "Name", type: "text", defaultValue: "vpc-1" },
      { name: "cidr", label: "CIDR", type: "text", defaultValue: "10.0.0.0/16" }
    ],
    acceptsOutgoing: {
      contains: ["subnet"]
    }
  },
  subnet: {
    type: "subnet",
    label: "Subnet",
    category: "Infrastructure",
    icon: LayoutDashboard,
    defaultConfiguration: { name: "subnet-1", cidr: "10.0.1.0/24" },
    configurationFields: [
      { name: "name", label: "Name", type: "text", defaultValue: "subnet-1" },
      { name: "cidr", label: "CIDR", type: "text", defaultValue: "10.0.1.0/24" }
    ],
    acceptsIncoming: {
      contains: ["network"]
    },
    acceptsOutgoing: {
      contains: ["cluster", "sql_database", "nosql_database", "cache", "load_balancer"]
    }
  },
  registry: {
    type: "registry",
    label: "Container Registry",
    category: "Containers",
    icon: Package,
    defaultConfiguration: { name: "registry-1", url: "docker.io" },
    configurationFields: [
      { name: "name", label: "Name", type: "text", defaultValue: "registry-1" },
      { name: "url", label: "Registry URL", type: "text", defaultValue: "docker.io" }
    ],
    acceptsOutgoing: {
      contains: ["image"]
    }
  },
  image: {
    type: "image",
    label: "Container Image",
    category: "Containers",
    icon: Box,
    defaultConfiguration: { name: "image-1", tag: "latest" },
    configurationFields: [
      { name: "name", label: "Image Name", type: "text", defaultValue: "image-1" },
      { name: "tag", label: "Tag", type: "text", defaultValue: "latest" }
    ],
    acceptsIncoming: {
      contains: ["registry"]
    },
    acceptsOutgoing: {
      dependency: ["container"]
    }
  },
  container: {
    type: "container",
    label: "Container",
    category: "Containers",
    icon: Box,
    defaultConfiguration: { name: "container-1", image: "nginx:latest", cpu: "500m", memory: "512MB", port: 8080 },
    configurationFields: [
      { name: "name", label: "Name", type: "text", defaultValue: "container-1" },
      { name: "image", label: "Image", type: "text", defaultValue: "nginx:latest" },
      { name: "cpu", label: "CPU", type: "text", defaultValue: "500m" },
      { name: "memory", label: "Memory", type: "text", defaultValue: "512MB" },
      { name: "port", label: "Port", type: "number", defaultValue: 8080 }
    ],
    acceptsIncoming: {
      dependency: ["image"]
    },
    acceptsOutgoing: {
      dependency: ["pod"]
    }
  },
  cluster: {
    type: "cluster",
    label: "Kubernetes Cluster",
    category: "Kubernetes",
    icon: Server,
    defaultConfiguration: { name: "cluster-1", version: "1.28" },
    configurationFields: [
      { name: "name", label: "Name", type: "text", defaultValue: "cluster-1" },
      { name: "version", label: "Version", type: "text", defaultValue: "1.28" }
    ],
    acceptsIncoming: {
      contains: ["subnet"]
    },
    acceptsOutgoing: {
      contains: ["node", "deployment", "pod", "service"]
    }
  },
  node: {
    type: "node",
    label: "Node",
    category: "Kubernetes",
    icon: Cpu,
    defaultConfiguration: { name: "node-1", size: "t3.medium" },
    configurationFields: [
      { name: "name", label: "Name", type: "text", defaultValue: "node-1" },
      { name: "size", label: "Size", type: "text", defaultValue: "t3.medium" }
    ],
    acceptsIncoming: {
      contains: ["cluster"]
    },
    acceptsOutgoing: {
      contains: ["pod"]
    }
  },
  pod: {
    type: "pod",
    label: "Pod",
    category: "Kubernetes",
    icon: Layers,
    defaultConfiguration: { name: "pod-1", replicas: 1, cpu: "500m", memory: "512MB" },
    configurationFields: [
      { name: "name", label: "Name", type: "text", defaultValue: "pod-1" },
      { name: "replicas", label: "Replicas", type: "number", defaultValue: 1 },
      { name: "cpu", label: "CPU", type: "text", defaultValue: "500m" },
      { name: "memory", label: "Memory", type: "text", defaultValue: "512MB" }
    ],
    acceptsIncoming: {
      dependency: ["container"],
      manages: ["deployment"],
      routes_to: ["service"],
      contains: ["node", "cluster"]
    }
  },
  deployment: {
    type: "deployment",
    label: "Deployment",
    category: "Kubernetes",
    icon: Settings,
    defaultConfiguration: { name: "deployment-1", replicas: 1, image: "backend:v1", cpu: "500m", memory: "512MB" },
    configurationFields: [
      { name: "name", label: "Name", type: "text", defaultValue: "deployment-1" },
      { name: "image", label: "Image", type: "text", defaultValue: "backend:v1" },
      { name: "replicas", label: "Replicas", type: "number", defaultValue: 1 },
      { name: "cpu", label: "CPU", type: "text", defaultValue: "500m" },
      { name: "memory", label: "Memory", type: "text", defaultValue: "512MB" }
    ],
    acceptsIncoming: {
      contains: ["cluster"]
    },
    acceptsOutgoing: {
      manages: ["pod"]
    }
  },
  service: {
    type: "service",
    label: "Service",
    category: "Kubernetes",
    icon: Network,
    defaultConfiguration: { name: "service-1", port: 80, targetPort: 8080 },
    configurationFields: [
      { name: "name", label: "Name", type: "text", defaultValue: "service-1" },
      { name: "port", label: "Port", type: "number", defaultValue: 80 },
      { name: "targetPort", label: "Target Port", type: "number", defaultValue: 8080 }
    ],
    acceptsIncoming: {
      routes_to: ["load_balancer"],
      contains: ["cluster"]
    },
    acceptsOutgoing: {
      routes_to: ["pod"]
    }
  },
  frontend: {
    type: "frontend",
    label: "Frontend",
    category: "Application",
    icon: MonitorSmartphone,
    defaultConfiguration: { name: "frontend-1", framework: "react" },
    configurationFields: [
      { name: "name", label: "Name", type: "text", defaultValue: "frontend-1" },
      { name: "framework", label: "Framework", type: "text", defaultValue: "react" }
    ],
    acceptsOutgoing: {
      routes_to: ["api", "backend", "load_balancer"]
    }
  },
  backend: {
    type: "backend",
    label: "Backend",
    category: "Application",
    icon: Server,
    defaultConfiguration: { name: "backend-1", runtime: "node" },
    configurationFields: [
      { name: "name", label: "Name", type: "text", defaultValue: "backend-1" },
      { name: "runtime", label: "Runtime", type: "text", defaultValue: "node" }
    ],
    acceptsIncoming: {
      routes_to: ["frontend", "api"]
    },
    acceptsOutgoing: {
      uses: ["sql_database", "nosql_database", "cache"]
    }
  },
  api: {
    type: "api",
    label: "REST API",
    category: "Application",
    icon: Code,
    defaultConfiguration: { name: "api-1", path: "/api/v1" },
    configurationFields: [
      { name: "name", label: "Name", type: "text", defaultValue: "api-1" },
      { name: "path", label: "Path", type: "text", defaultValue: "/api/v1" }
    ],
    acceptsIncoming: {
      routes_to: ["frontend", "load_balancer"]
    },
    acceptsOutgoing: {
      routes_to: ["backend"]
    }
  },
  sql_database: {
    type: "sql_database",
    label: "SQL Database",
    category: "Data",
    icon: Database,
    defaultConfiguration: { name: "database-1", type: "SQL", port: 5432, storage: "10GB" },
    configurationFields: [
      { name: "name", label: "Name", type: "text", defaultValue: "database-1" },
      { name: "type", label: "Type", type: "text", defaultValue: "SQL" },
      { name: "port", label: "Port", type: "number", defaultValue: 5432 },
      { name: "storage", label: "Storage", type: "text", defaultValue: "10GB" }
    ],
    acceptsIncoming: {
      uses: ["backend"]
    }
  },
  nosql_database: {
    type: "nosql_database",
    label: "NoSQL Database",
    category: "Data",
    icon: Database,
    defaultConfiguration: { name: "nosql-1", type: "MongoDB", port: 27017, storage: "10GB" },
    configurationFields: [
      { name: "name", label: "Name", type: "text", defaultValue: "nosql-1" },
      { name: "type", label: "Type", type: "text", defaultValue: "MongoDB" },
      { name: "port", label: "Port", type: "number", defaultValue: 27017 },
      { name: "storage", label: "Storage", type: "text", defaultValue: "10GB" }
    ],
    acceptsIncoming: {
      uses: ["backend"]
    }
  },
  cache: {
    type: "cache",
    label: "Cache",
    category: "Data",
    icon: Database,
    defaultConfiguration: { name: "cache-1", engine: "redis", port: 6379 },
    configurationFields: [
      { name: "name", label: "Name", type: "text", defaultValue: "cache-1" },
      { name: "engine", label: "Engine", type: "text", defaultValue: "redis" },
      { name: "port", label: "Port", type: "number", defaultValue: 6379 }
    ],
    acceptsIncoming: {
      uses: ["backend"]
    }
  }
};
