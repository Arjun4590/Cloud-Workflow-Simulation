# CloudLens: An Interactive Cloud Execution Visualizer and Workflow Simulator

**CloudLens** is a local-first, interactive cloud architecture visualizer and conceptual simulation platform designed for cloud computing education, research demonstrations, and architectural evaluation.

It enables users to design multi-tier cloud architectures, validate connection semantics, compute topological deployment workflows, simulate discrete request routing across load-balanced backends, inspect live algorithmic decisions and latency metrics, and test fault tolerance via interactive chaos failure injection.

---

## 1. Product Mission & Educational Motivation

In modern cloud computing platforms (AWS, Azure, GCP, Kubernetes), core systems behavior—such as dependency order, traffic routing, health checks, queueing, and failover—is hidden behind high-level management consoles and managed service abstractions.

**Core Research Question:**
> *How can interactive workflow simulation and real-time visualization help users understand cloud operations, algorithms, data movement, and failure behavior that are otherwise obscured behind cloud abstractions?*

CloudLens acts as an educational cloud laboratory:
1. **Design**: Build architectures using 17 typed cloud resource specifications (Compute, Containers, Kubernetes, Applications, Data).
2. **Validate**: Perform multi-level semantic validation checking connection legality, missing dependencies, and cycles.
3. **Plan**: Compute topological execution stages using Kahn's algorithm over explicit dependency edges.
4. **Simulate**: Execute virtual workloads using a deterministic tick-based clock without requiring paid cloud infrastructure or credentials.
5. **Inspect**: Watch requests traverse the network in real time, view chronological event logs, and analyze load balancing decisions.
6. **Inject Chaos**: Simulate real-time hardware crashes and node outages to observe rerouting, in-flight abortion, and recovery.

---

## 2. Implemented Capabilities vs. Conceptual Assumptions

| Capability | Status | Implementation Details |
| :--- | :---: | :--- |
| **Interactive Graph Canvas** | Implemented | Built with `@xyflow/react`, supporting drag-and-drop, connection inference, and deletion |
| **Typed Cloud Schema** | Implemented | 17 typed definitions across Infrastructure, Containers, K8s, Application, and Data |
| **Semantic Validation Engine** | Implemented | Validates schema fields, connection compatibility, required prerequisites, and cycles |
| **Topological Execution Planner** | Implemented | Kahn's algorithm calculates parallel execution stages over `dependency` relationships |
| **Deterministic Simulation Engine**| Implemented | Pure TypeScript virtual clock engine independent of React rendering |
| **Round Robin Routing** | Implemented | Deterministic rotation with wrap-around, health filtering, and explanatory audit logs |
| **Least Connections Routing** | Implemented | Load-aware routing tracking active in-flight requests with deterministic tie-breaking |
| **Autoscaling Simulation Mode** | Implemented | Configurable horizontal elasticity, scale-out/in policy, cooldowns, and draining |
| **Runtime Replica Registry** | Implemented | Dynamic eligible candidate discovery for virtual replicas without mutating design project |
| **Event Timeline & Inspector** | Implemented | Categorized event stream with severity filtering and click-to-highlight node on canvas |
| **Live Metrics Dashboard** | Implemented | Real-time calculation of success/failure rate, latency, and per-backend distribution |
| **Fault Injection & Recovery** | Implemented | Live node crashing, in-flight request termination, automatic bypass, and revival |
| **Pre-built Demo Scenarios** | Implemented | One-click scenario loading for Scenarios A through I |
| **Local-First & Zero Paid Cloud** | Verified | Runs 100% locally in browser; no AWS/GCP bills or external backend server required |

### Simulation Assumptions & Boundaries
CloudLens is an educational conceptual model. Simulated virtual ticks, latency, and throughput values are derived from explicit deterministic models rather than proprietary hypervisor or hardware telemetry. Autoscaling utilization is defined explicitly as simulated concurrent-request utilization (`activeRequests / healthyCapacity * 100`).

---

## 3. System Architecture

CloudLens adheres to strict separation of concerns:
```
┌────────────────────────────────────────────────────────┐
│                   React 19 / Vite UI                   │
│  WorkflowCanvas │ CloudNode │ AnalysisPanel │ Toolbar  │
└───────────────▲───────────────────────▲────────────────┘
                │                       │
      Zustand Store (Design)   Zustand Store (Simulation)
       `useWorkflowStore`        `useSimulationStore`
                │                       │
┌───────────────▼───────────────┐┌──────▼────────────────┐
│  Validation & Workflow Engine ││   Simulation Engine   │
│  - ValidationEngine.ts        ││   - SimulationEngine  │
│  - Kahn's Topological Sort    ││   - Virtual Clock     │
│  - Cycle Detection (DFS)      ││   - Event Stream      │
└───────────────────────────────┘└───────▲───────────────┘
                                         │
                        ┌────────────────┴───────────────┐
                        │                                │
            ┌───────────▼────────────┐       ┌───────────▼────────────┐
            │   Routing Algorithms   │       │   Autoscaling Engine   │
            │   - RoundRobin.ts      │       │   - Replica Registry   │
            │   - LeastConnections.ts│       │   - AutoscalingPolicy  │
            └────────────────────────┘       └────────────────────────┘
```

### Module Responsibilities
- `src/types/workflow.ts`: Fundamental types (`CloudProject`, `CloudResource`, `WorkflowConnection`, `ConnectionType`).
- `src/config/resourceDefinitions.ts`: Rules defining incoming/outgoing connection legality for all 17 resource types.
- `src/engines/validation/ValidationEngine.ts`: Real-time semantic validation engine.
- `src/engines/workflow/WorkflowEngine.ts`: Dependency analyzer and Kahn's algorithm execution stage calculator.
- `src/engines/simulation/SimulationEngine.ts`: Pure TypeScript simulation engine tracking ticks, stages, requests, and metrics.
- `src/engines/simulation/autoscaling/`: Autoscaling Engine, deterministic policy evaluation, lifecycle states (`provisioning`, `ready`, `draining`, `terminated`), and replica registry.
- `src/engines/simulation/algorithms/`: Implementations of load-balancing algorithms (`RoundRobin`, `LeastConnections`).
- `src/store/workflowStore.ts`: Design-time state management, undo/redo history, and persistence.
- `src/store/simulationStore.ts`: Runtime simulation state, playback timer, fault injection triggers, and autoscaling actions.
- `src/config/demoScenarios.ts`: Reproducible demonstration architectures (Scenarios A through I).

---

## 4. Autoscaling Policy & Mathematical Model

### Modeled Concurrent-Request Utilization Formula
Modeled utilization is calculated deterministically during simulation clock ticks:

$$\text{Healthy Capacity} = \sum_{r \in \text{Ready Healthy Replicas}} \text{modeledCapacity}(r)$$

$$\text{Modeled Utilization (\%)} = \left( \frac{\text{Total Active In-Flight Requests}}{\text{Healthy Capacity}} \right) \times 100$$

- If $\text{Healthy Capacity} = 0$, utilization defaults to $100\%$ to trigger emergency provisioning if replicas $< \text{maxReplicas}$.

### Scale-Out Policy
$$\text{Trigger Scale-Out if: } U \ge \text{threshold}_{\text{out}} \land (\text{tick} - \text{lastScaleOut} \ge \text{cooldown}_{\text{out}}) \land R < R_{\max}$$
- When triggered, provisions $+1$ virtual replica.
- Replicas transition through `provisioning` for configured startup delay ticks before entering `ready`.

### Scale-In & Graceful Draining Policy
$$\text{Trigger Scale-In if: } U \le \text{threshold}_{\text{in}} \land (\text{tick} - \text{lastScaleIn} \ge \text{cooldown}_{\text{in}}) \land R > R_{\min}$$
- To prevent oscillation, a hysteresis gap ($\text{threshold}_{\text{out}} - \text{threshold}_{\text{in}} \ge 40\%$) is enforced.
- Selected victim replicas enter `draining` state: load balancers stop assigning new requests to draining replicas while existing in-flight requests complete normally before termination. Zero requests are lost.

---

## 5. Demonstration Scenarios (A through I)

- **Scenario A**: Sequential Container Workflow (Kahn's topological staging)
- **Scenario B**: Independent Microservices (Parallel staging)
- **Scenario C**: High-Availability Load Balancer (Round Robin vs Least Connections)
- **Scenario D**: Fault Tolerance & Failure Injection (Node crashing, request interruption, recovery)
- **Scenario E**: Invalid Dependency Cycle Rejection (Kahn's cycle detection)
- **Scenario F**: Autoscaling under Increasing Workload (Dynamic scale-out from 2 to 4+ replicas under load)
- **Scenario G**: Autoscaling under Decreasing Workload (Low load triggers graceful scale-in and draining to minReplicas)
- **Scenario H**: Autoscaling with Backend Failure (Node crash drops capacity, triggering automatic replacement provisioning)
- **Scenario I**: Fixed Capacity Baseline (Same workload as F with autoscaling disabled to observe saturation)

---

## 6. Installation & Verification

```bash
cd frontend
npm install
npm test          # 41 passed across 4 test suites
npm run lint      # oxlint: 0 warnings, 0 errors
npm run build     # tsc -b && vite build: 0 errors
npm run dev       # Start local visualizer at http://localhost:5173
```

---

## 4. How the Engines Work

### 4.1 Validation Engine
Validates:
1. **Structural Integrity**: Rejects duplicate IDs, dangling connection references, and self-loops.
2. **Configuration Compliance**: Validates required configuration keys (e.g., container image names, database storage, positive replicas).
3. **Connection Semantics**: Differentiates between `dependency`, `routes_to`, `manages`, `contains`, and `uses`.
4. **Dependency Cycles**: Executes depth-first search (DFS) recursion stack cycle detection over `dependency` edges.

### 4.2 Workflow Execution Planner (Kahn's Algorithm)
Calculates execution stages:
1. Calculates in-degree for all resources based solely on `dependency` edges.
2. Queues all zero in-degree nodes into Stage 1.
3. Successively removes processed nodes, decrements neighbor in-degrees, and places newly unblocked nodes into subsequent stages.
4. If total processed nodes is less than project size, flags execution-blocking circular dependency.

### 4.3 Simulation Engine & Virtual Clock
1. **Snapshot Isolation**: When initialized, the engine creates an immutable deep clone of the project, ensuring canvas edits do not corrupt active simulations.
2. **Virtual Clock**: Advances discrete logical ticks (`currentTick`). Execution is deterministic and independent of JavaScript event-loop jitter.
3. **Stage Execution**: Prior stages must boot and report `completed` before dependent stages begin provisioning.
4. **Traffic Generation**: Emits virtual requests (`REQ-001`, `REQ-002`, etc.) at configured intervals from client resources to ingress load balancers.
5. **Algorithmic Routing**:
   - **Round Robin**: Maintains a cyclic index across healthy instances:
     $$\text{Target} = \text{Candidates}[\text{index} \pmod N]$$
     Unavailable/failed backends are dynamically bypassed without pointer corruption.
   - **Least Connections**: Evaluates active in-flight request counts:
     $$\text{Target} = \arg\min_{c \in \text{Healthy}} (\text{ActiveRequests}_c)$$
     Ties are resolved deterministically using lexicographical identifier ordering.
6. **Decision Explainability**: Each routing event generates a factual explanation (e.g., *"Backend B was selected because it has the lowest active load (1 in-flight request) among all 3 healthy backends"*).
7. **Downstream Operations**: Routes dependent queries to downstream SQL/NoSQL databases and caches.

### 4.4 Failure Injection & Recovery
- **Chaos Injection**: User can crash any resource via the toolbar or directly on the node card (`Fail Node`).
- **In-Flight Handling**: Active requests assigned to the crashed instance are terminated with status `failed` (`REQUEST_INTERRUPTED_BY_CRASH`), preventing phantom active loads.
- **Routing Avoidance**: The load balancer immediately excludes the failed instance from candidate pools.
- **Recovery**: Clicking `Revive` returns the node to `ready` status, emitting `RESOURCE_RECOVERED` and re-incorporating it into the routing pool.

---

## 5. Demonstration Scenarios

CloudLens includes 5 pre-configured demonstration scenarios selectable directly from the top toolbar:

### Scenario A — Sequential Dependency Workflow
- **Topology**: `Container Image → Container → Pod` with connected `Service`.
- **Educational Concept**: Demonstrates multi-stage sequential dependency planning. Prerequisites must boot before dependents.

### Scenario B — Independent Microservices
- **Topology**: VPC network with public and private subnets, SQL database, and NoSQL database.
- **Educational Concept**: Demonstrates that independent resources share the same execution stage.

### Scenario C — High-Availability Load Balancer (Primary Demo)
- **Topology**: `Client → Load Balancer → Backend A, Backend B, Backend C → Primary SQL Database`.
- **Educational Concept**:
  - Run with **Round Robin** to observe balanced cyclic assignment (e.g., 3, 3, 2).
  - Reset and run with **Least Connections** to observe dynamic load-balancing based on in-flight processing times.

### Scenario D — Fault Tolerance & Recovery
- **Topology**: High-availability load-balanced cluster with Redis Cache.
- **Educational Concept**: Crash Backend B during active request generation. Observe in-flight termination, zero routing to Backend B, and seamless recovery when revived.

### Scenario E — Invalid Dependency Cycle
- **Topology**: Circular loop (`Image A → Container B → Pod C → Image A`).
- **Educational Concept**: Proves that the Validation Engine and Kahn's algorithm identify circular logic and safely block execution.

### Scenario F — Autoscaling under Increasing Workload
- **Topology**: Elastic load-balanced cluster (`Client → Ingress-ALB → Workers → Shared-Postgres`).
- **Educational Concept**: Demonstrates dynamic scale-out from 2 to 4+ replicas as concurrent request load exceeds 70%.

### Scenario G — Autoscaling under Decreasing Workload
- **Topology**: Elastic load-balanced cluster starting with 4 replicas.
- **Educational Concept**: Demonstrates graceful scale-in and draining as request arrival rate drops, terminating down to minimum capacity (2) without losing in-flight requests.

### Scenario H — Autoscaling with Backend Failure
- **Topology**: Load-balanced cluster with failure injection.
- **Educational Concept**: Crashing a worker drops healthy capacity, raising utilization and triggering the autoscaler to provision replacement capacity.

### Scenario I — Fixed Capacity Baseline
- **Topology**: Identical high-burst workload as Scenario F with autoscaling disabled.
- **Educational Concept**: Demonstrates queue saturation, elevated utilization, and lack of dynamic relief in fixed-capacity architectures.

---

## 6. Installation & Local Execution

### Prerequisites
- Node.js (v18 or higher recommended)
- npm (v9 or higher)

### Setup & Run
1. Clone the repository and enter the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:5173/` in your browser.

### Automated Testing
Run the complete Vitest test suite (41 tests across 4 suites):
```bash
npm test
```
To run tests in watch mode:
```bash
npm run test:watch
```

### Static Analysis & Production Build
```bash
npm run lint      # oxlint: 0 warnings, 0 errors
npm run build     # tsc -b && vite build: 0 errors
```

---

## 7. Research Evaluation & Viva Presentation

### Evaluation Framework
For academic evaluation, student understanding can be compared across two groups:
1. **Control Group**: Evaluates cloud architecture diagrams using static documentation.
2. **Experimental Group**: Explores architectures, injects faults, toggles autoscaling, and inspects routing decisions using CloudLens.
Metrics: Time to identify bottlenecks, diagnostic accuracy during node outages, and comprehension of load balancing and elasticity algorithms.

### Next Milestone Enhancements
- Predictive autoscaling models (ARIMA / Holt-Winters forecasting).
- Multi-region geo-distributed routing and latency-based steering.
- Stochastic latency jitter distributions with configurable seeds.

