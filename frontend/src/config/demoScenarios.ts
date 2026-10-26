import type { CloudProject, NodePositions } from "../types/workflow";

export interface DemoScenario {
  id: string;
  name: string;
  category: string;
  description: string;
  expectedBehavior: string;
  project: CloudProject;
  positions: NodePositions;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "scenario-c",
    name: "Scenario C — High-Availability Load Balancer",
    category: "Traffic Routing & Algorithms",
    description: "Client (Frontend) sends traffic through an Ingress Load Balancer distributing to 3 Backend workers connected to a central SQL Database.",
    expectedBehavior: "Demonstrates Round Robin rotation vs Least Connections load distribution across Backend A, B, and C.",
    project: {
      id: "demo-scenario-c",
      name: "HA Load-Balanced Architecture",
      resources: [
        {
          id: "fe-client",
          name: "Web Client",
          type: "frontend",
          configuration: { name: "Web-Frontend", framework: "react" }
        },
        {
          id: "lb-ingress",
          name: "Ingress Load Balancer",
          type: "load_balancer",
          configuration: { name: "Ingress-LB", algorithm: "round_robin" }
        },
        {
          id: "bk-worker-a",
          name: "Backend A",
          type: "backend",
          configuration: { name: "Backend-A", runtime: "node" }
        },
        {
          id: "bk-worker-b",
          name: "Backend B",
          type: "backend",
          configuration: { name: "Backend-B", runtime: "node" }
        },
        {
          id: "bk-worker-c",
          name: "Backend C",
          type: "backend",
          configuration: { name: "Backend-C", runtime: "node" }
        },
        {
          id: "db-postgres",
          name: "PostgreSQL Database",
          type: "sql_database",
          configuration: { name: "Primary-DB", type: "Postgres", port: 5432, storage: "100GB" }
        }
      ],
      connections: [
        { id: "c-fe-lb", source: "fe-client", target: "lb-ingress", type: "routes_to" },
        { id: "c-lb-bka", source: "lb-ingress", target: "bk-worker-a", type: "routes_to" },
        { id: "c-lb-bkb", source: "lb-ingress", target: "bk-worker-b", type: "routes_to" },
        { id: "c-lb-bkc", source: "lb-ingress", target: "bk-worker-c", type: "routes_to" },
        { id: "c-bka-db", source: "bk-worker-a", target: "db-postgres", type: "uses" },
        { id: "c-bkb-db", source: "bk-worker-b", target: "db-postgres", type: "uses" },
        { id: "c-bkc-db", source: "bk-worker-c", target: "db-postgres", type: "uses" }
      ]
    },
    positions: {
      "fe-client": { x: 380, y: 50 },
      "lb-ingress": { x: 380, y: 180 },
      "bk-worker-a": { x: 140, y: 320 },
      "bk-worker-b": { x: 380, y: 320 },
      "bk-worker-c": { x: 620, y: 320 },
      "db-postgres": { x: 380, y: 470 }
    }
  },
  {
    id: "scenario-d",
    name: "Scenario D — Fault Tolerance & Failure Injection",
    category: "Resilience & Recovery",
    description: "Load balancer distributes requests across 3 workers. Test failing Backend B mid-simulation to observe automatic rerouting, zero leaked connections, and recovery.",
    expectedBehavior: "When Backend B is failed, in-flight requests abort gracefully and new requests are distributed only to healthy Backends A & C. When restored, B rejoins rotation.",
    project: {
      id: "demo-scenario-d",
      name: "Fault Tolerance Demo Architecture",
      resources: [
        {
          id: "fe-client",
          name: "Mobile Client",
          type: "frontend",
          configuration: { name: "Client-App", framework: "react" }
        },
        {
          id: "lb-ingress",
          name: "Ingress Load Balancer",
          type: "load_balancer",
          configuration: { name: "Ingress-LB", algorithm: "round_robin" }
        },
        {
          id: "bk-worker-a",
          name: "Backend Node 1",
          type: "backend",
          configuration: { name: "Node-1", runtime: "node" }
        },
        {
          id: "bk-worker-b",
          name: "Backend Node 2",
          type: "backend",
          configuration: { name: "Node-2 (Failure Target)", runtime: "node" }
        },
        {
          id: "bk-worker-c",
          name: "Backend Node 3",
          type: "backend",
          configuration: { name: "Node-3", runtime: "node" }
        },
        {
          id: "db-cluster",
          name: "Database Cache",
          type: "cache",
          configuration: { name: "Redis-Cache", engine: "redis", port: 6379 }
        }
      ],
      connections: [
        { id: "c-d-fe-lb", source: "fe-client", target: "lb-ingress", type: "routes_to" },
        { id: "c-d-lb-a", source: "lb-ingress", target: "bk-worker-a", type: "routes_to" },
        { id: "c-d-lb-b", source: "lb-ingress", target: "bk-worker-b", type: "routes_to" },
        { id: "c-d-lb-c", source: "lb-ingress", target: "bk-worker-c", type: "routes_to" },
        { id: "c-d-a-cache", source: "bk-worker-a", target: "db-cluster", type: "uses" },
        { id: "c-d-b-cache", source: "bk-worker-b", target: "db-cluster", type: "uses" },
        { id: "c-d-c-cache", source: "bk-worker-c", target: "db-cluster", type: "uses" }
      ]
    },
    positions: {
      "fe-client": { x: 380, y: 50 },
      "lb-ingress": { x: 380, y: 170 },
      "bk-worker-a": { x: 140, y: 310 },
      "bk-worker-b": { x: 380, y: 310 },
      "bk-worker-c": { x: 620, y: 310 },
      "db-cluster": { x: 380, y: 460 }
    }
  },
  {
    id: "scenario-a",
    name: "Scenario A — Sequential Dependency Workflow",
    category: "Workflow & Planning",
    description: "Multi-stage dependency chain: Container Image must be built, Container instantiated, Pod deployed, and Service exposed.",
    expectedBehavior: "Workflow planner creates 4 distinct topological execution stages and executes prerequisites before dependents.",
    project: {
      id: "demo-scenario-a",
      name: "Sequential Container Workflow",
      resources: [
        {
          id: "img-base",
          name: "Web Image",
          type: "image",
          configuration: { name: "webapp-image", tag: "v1.2" }
        },
        {
          id: "cnt-app",
          name: "Web Container",
          type: "container",
          configuration: { name: "webapp-container", image: "webapp-image:v1.2", port: 8080 }
        },
        {
          id: "pod-app",
          name: "Web Pod",
          type: "pod",
          configuration: { name: "webapp-pod", replicas: 2 }
        },
        {
          id: "svc-app",
          name: "Web Service",
          type: "service",
          configuration: { name: "webapp-svc", port: 80, targetPort: 8080 }
        }
      ],
      connections: [
        { id: "c-a-1", source: "img-base", target: "cnt-app", type: "dependency" },
        { id: "c-a-2", source: "cnt-app", target: "pod-app", type: "dependency" },
        { id: "c-a-3", source: "svc-app", target: "pod-app", type: "routes_to" }
      ]
    },
    positions: {
      "img-base": { x: 380, y: 50 },
      "cnt-app": { x: 380, y: 180 },
      "pod-app": { x: 380, y: 310 },
      "svc-app": { x: 600, y: 310 }
    }
  },
  {
    id: "scenario-b",
    name: "Scenario B — Independent Microservices",
    category: "Concurrency & Stages",
    description: "Multiple decoupled microservices deployed within the same cluster sharing an execution stage without cross-dependencies.",
    expectedBehavior: "Proves that Kahn's topological sort groups independent resources into the same execution stage.",
    project: {
      id: "demo-scenario-b",
      name: "Independent Microservices",
      resources: [
        {
          id: "net-vpc",
          name: "Cloud VPC",
          type: "network",
          configuration: { name: "production-vpc", cidr: "10.0.0.0/16" }
        },
        {
          id: "sub-public",
          name: "Public Subnet",
          type: "subnet",
          configuration: { name: "public-subnet", cidr: "10.0.1.0/24" }
        },
        {
          id: "sub-private",
          name: "Private Subnet",
          type: "subnet",
          configuration: { name: "private-subnet", cidr: "10.0.2.0/24" }
        },
        {
          id: "db-sql",
          name: "SQL Warehouse",
          type: "sql_database",
          configuration: { name: "finance-db", type: "Postgres", storage: "200GB" }
        },
        {
          id: "db-nosql",
          name: "Document Store",
          type: "nosql_database",
          configuration: { name: "analytics-nosql", type: "MongoDB", storage: "500GB" }
        }
      ],
      connections: [
        { id: "c-b-1", source: "net-vpc", target: "sub-public", type: "contains" },
        { id: "c-b-2", source: "net-vpc", target: "sub-private", type: "contains" },
        { id: "c-b-3", source: "sub-private", target: "db-sql", type: "contains" },
        { id: "c-b-4", source: "sub-private", target: "db-nosql", type: "contains" }
      ]
    },
    positions: {
      "net-vpc": { x: 380, y: 50 },
      "sub-public": { x: 180, y: 190 },
      "sub-private": { x: 550, y: 190 },
      "db-sql": { x: 420, y: 340 },
      "db-nosql": { x: 680, y: 340 }
    }
  },
  {
    id: "scenario-e",
    name: "Scenario E — Invalid Dependency Cycle",
    category: "Validation & Error Handling",
    description: "Circular dependency loop (Image A -> Container B -> Pod C -> Image A).",
    expectedBehavior: "Validation Engine rejects architecture, Kahn's algorithm reports cycle, and Simulation Engine safely blocks execution.",
    project: {
      id: "demo-scenario-e",
      name: "Circular Dependency Cycle",
      resources: [
        {
          id: "res-a",
          name: "Image A",
          type: "image",
          configuration: { name: "image-a", tag: "latest" }
        },
        {
          id: "res-b",
          name: "Container B",
          type: "container",
          configuration: { name: "container-b", image: "image-a" }
        },
        {
          id: "res-c",
          name: "Pod C",
          type: "pod",
          configuration: { name: "pod-c", replicas: 1 }
        }
      ],
      connections: [
        { id: "c-cycle-1", source: "res-a", target: "res-b", type: "dependency" },
        { id: "c-cycle-2", source: "res-b", target: "res-c", type: "dependency" },
        { id: "c-cycle-3", source: "res-c", target: "res-a", type: "dependency" }
      ]
    },
    positions: {
      "res-a": { x: 380, y: 80 },
      "res-b": { x: 550, y: 250 },
      "res-c": { x: 210, y: 250 }
    }
  }
];
