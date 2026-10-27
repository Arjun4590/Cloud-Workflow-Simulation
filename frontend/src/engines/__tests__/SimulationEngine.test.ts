import { describe, it, expect } from "vitest";
import { SimulationEngine } from "../simulation/SimulationEngine";
import type { CloudProject } from "../../types/workflow";

describe("SimulationEngine", () => {
  const createValidHaProject = (): CloudProject => ({
    id: "proj-ha",
    name: "HA Web App",
    resources: [
      { id: "fe1", name: "Frontend", type: "frontend", configuration: { name: "Client-App", framework: "react" } },
      { id: "lb1", name: "LoadBalancer", type: "load_balancer", configuration: { name: "Ingress-LB", algorithm: "round_robin" } },
      { id: "bk1", name: "Backend 1", type: "backend", configuration: { name: "API-Worker-1", runtime: "node" } },
      { id: "bk2", name: "Backend 2", type: "backend", configuration: { name: "API-Worker-2", runtime: "node" } },
      { id: "db1", name: "Database", type: "sql_database", configuration: { name: "Main-DB", type: "postgres", storage: "50GB" } }
    ],
    connections: [
      { id: "c1", source: "fe1", target: "lb1", type: "routes_to" },
      { id: "c2", source: "lb1", target: "bk1", type: "routes_to" },
      { id: "c3", source: "lb1", target: "bk2", type: "routes_to" },
      { id: "c4", source: "bk1", target: "db1", type: "uses" },
      { id: "c5", source: "bk2", target: "db1", type: "uses" }
    ]
  });

  it("should initialize in ready status for a valid project", () => {
    const project = createValidHaProject();
    const engine = new SimulationEngine(project);

    expect(engine.getStatus()).toBe("ready");
    const snapshot = engine.getSnapshot();
    expect(snapshot.resources["bk1"].state).toBe("pending");
    expect(snapshot.metrics.totalRequests).toBe(0);
    expect(snapshot.currentTick).toBe(0);
  });

  it("should reject an invalid circular dependency architecture", () => {
    const invalidProject: CloudProject = {
      id: "cycle-proj",
      name: "Cycle Project",
      resources: [
        { id: "n1", name: "Img", type: "image", configuration: { name: "img" } },
        { id: "n2", name: "Cnt", type: "container", configuration: { name: "cnt", image: "img" } }
      ],
      connections: [
        { id: "c1", source: "n1", target: "n2", type: "dependency" },
        { id: "c2", source: "n2", target: "n1", type: "dependency" } // cycle
      ]
    };

    const engine = new SimulationEngine(invalidProject);
    expect(engine.getStatus()).toBe("failed");
    const snapshot = engine.getSnapshot();
    expect(snapshot.errorMessage).toContain("circular");
  });

  it("should support step-by-step virtual clock progression", () => {
    const project = createValidHaProject();
    const engine = new SimulationEngine(project, { totalRequests: 2, requestIntervalTicks: 1 });

    expect(engine.getSnapshot().currentTick).toBe(0);

    const s1 = engine.step();
    expect(s1.currentTick).toBe(1);
    expect(s1.status).toBe("running");

    const s2 = engine.step();
    expect(s2.currentTick).toBe(2);
    expect(s2.events.length).toBeGreaterThan(0);
  });

  it("should correctly route requests using Round Robin", () => {
    const project = createValidHaProject();
    const engine = new SimulationEngine(project, {
      totalRequests: 4,
      requestIntervalTicks: 1,
      routingAlgorithm: "round_robin",
      processingTicksPerRequest: 2
    });

    // Run until completion or max 15 steps
    let steps = 0;
    while (engine.getStatus() !== "completed" && steps < 20) {
      engine.step();
      steps++;
    }

    const snapshot = engine.getSnapshot();
    expect(snapshot.status).toBe("completed");
    expect(snapshot.metrics.totalRequests).toBe(4);
    expect(snapshot.metrics.completedRequests).toBe(4);
    expect(snapshot.metrics.successRate).toBe(100);

    // Round Robin across 2 backends should balance 2 and 2
    const perBackend = snapshot.metrics.perBackendRequests;
    expect(perBackend["API-Worker-1"]).toBe(2);
    expect(perBackend["API-Worker-2"]).toBe(2);
  });

  it("should support dynamic failure injection and recovery", () => {
    const project = createValidHaProject();
    const engine = new SimulationEngine(project, {
      totalRequests: 6,
      requestIntervalTicks: 1,
      routingAlgorithm: "round_robin",
      processingTicksPerRequest: 3
    });

    // Step 2 ticks to start processing
    engine.step();
    engine.step();

    // Inject failure into Backend 1
    engine.injectFailure("bk1", "Hardware overheat fault");

    const sFailed = engine.getSnapshot();
    expect(sFailed.resources["bk1"].isFailed).toBe(true);
    expect(sFailed.resources["bk1"].state).toBe("unavailable");
    expect(sFailed.metrics.failureCount).toBe(1);

    // Step several more ticks: requests must be routed only to Backend 2
    for (let i = 0; i < 5; i++) {
      engine.step();
    }

    // Recover Backend 1
    engine.recoverResource("bk1");
    const sRecovered = engine.getSnapshot();
    expect(sRecovered.resources["bk1"].isFailed).toBe(false);
    expect(sRecovered.resources["bk1"].state).toBe("ready");
    expect(sRecovered.metrics.recoveryCount).toBe(1);

    // Run out remaining ticks
    for (let i = 0; i < 10; i++) {
      if (engine.getStatus() === "completed") break;
      engine.step();
    }

    const finalSnapshot = engine.getSnapshot();
    expect(finalSnapshot.events.some(e => e.type === "RESOURCE_FAILED")).toBe(true);
    expect(finalSnapshot.events.some(e => e.type === "RESOURCE_RECOVERED")).toBe(true);
  });

  it("should reset completely to initial state", () => {
    const project = createValidHaProject();
    const engine = new SimulationEngine(project, { totalRequests: 4 });

    // Step 5 times
    for (let i = 0; i < 5; i++) engine.step();
    expect(engine.getSnapshot().currentTick).toBe(5);

    // Reset
    const resetSnapshot = engine.reset();
    expect(resetSnapshot.status).toBe("ready");
    expect(resetSnapshot.currentTick).toBe(0);
    expect(resetSnapshot.metrics.totalRequests).toBe(0);
    expect(resetSnapshot.metrics.completedRequests).toBe(0);
    expect(resetSnapshot.resources["bk1"].activeRequests).toBe(0);
    expect(resetSnapshot.resources["bk1"].handledRequests).toBe(0);
  });

  it("should produce deterministic runs given identical inputs", () => {
    const project = createValidHaProject();
    const config = { totalRequests: 4, requestIntervalTicks: 1, routingAlgorithm: "round_robin" as const };

    const engineA = new SimulationEngine(project, config);
    const engineB = new SimulationEngine(project, config);

    for (let i = 0; i < 8; i++) {
      engineA.step();
      engineB.step();
    }

    const snapA = engineA.getSnapshot();
    const snapB = engineB.getSnapshot();

    expect(snapA.currentTick).toBe(snapB.currentTick);
    expect(snapA.metrics.totalRequests).toBe(snapB.metrics.totalRequests);
    expect(snapA.metrics.completedRequests).toBe(snapB.metrics.completedRequests);
    expect(snapA.events.map(e => e.type)).toEqual(snapB.events.map(e => e.type));
    expect(snapA.requests.map(r => r.targetNodeId)).toEqual(snapB.requests.map(r => r.targetNodeId));
  });

  describe("Autoscaling Integration", () => {
    it("should dynamically scale out when modeled utilization exceeds threshold", () => {
      const project = createValidHaProject();
      const engine = new SimulationEngine(project, {
        totalRequests: 12,
        requestIntervalTicks: 1,
        processingTicksPerRequest: 4,
        routingAlgorithm: "round_robin",
        autoscaling: {
          enabled: true,
          minReplicas: 2,
          initialReplicas: 2,
          maxReplicas: 5,
          scaleOutThreshold: 75,
          scaleInThreshold: 30,
          scaleOutCooldown: 2,
          scaleInCooldown: 4,
          modeledCapacityPerReplica: 2,
          startupDelayTicks: 0,
          scaleOutIncrement: 1,
          scaleInDecrement: 1
        }
      });

      // Step until scale out is triggered
      for (let i = 0; i < 6; i++) {
        engine.step();
      }

      const snap = engine.getSnapshot();
      expect(snap.autoscaling).toBeDefined();
      expect(snap.autoscaling?.scaleOutCount).toBeGreaterThan(0);
      expect(snap.autoscaling?.currentTotalReplicas).toBeGreaterThan(2);
      expect(snap.events.some(e => e.type === "SCALE_OUT_TRIGGERED")).toBe(true);

      // Check that virtual replicas exist and are routable
      const virtualReps = Object.values(snap.virtualReplicas || {});
      expect(virtualReps.length).toBeGreaterThan(2);
      expect(virtualReps.some(r => r.id.includes("-rep-"))).toBe(true);
    });

    it("should route traffic to newly ready virtual replicas", () => {
      const project = createValidHaProject();
      const engine = new SimulationEngine(project, {
        totalRequests: 16,
        requestIntervalTicks: 1,
        processingTicksPerRequest: 4,
        routingAlgorithm: "least_connections",
        autoscaling: {
          enabled: true,
          minReplicas: 2,
          initialReplicas: 2,
          maxReplicas: 4,
          scaleOutThreshold: 60,
          scaleInThreshold: 20,
          scaleOutCooldown: 1,
          scaleInCooldown: 4,
          modeledCapacityPerReplica: 2,
          startupDelayTicks: 0,
          scaleOutIncrement: 1,
          scaleInDecrement: 1
        }
      });

      // Run 10 ticks
      for (let i = 0; i < 10; i++) {
        engine.step();
      }

      const snap = engine.getSnapshot();
      // At least one request should have targeted a virtual replica (id with -rep-)
      const routedToVirtual = snap.requests.some(r => r.targetNodeId?.includes("-rep-"));
      expect(routedToVirtual).toBe(true);
    });

    it("should gracefully drain and remove replicas during scale-in", () => {
      const project = createValidHaProject();
      const engine = new SimulationEngine(project, {
        totalRequests: 4, // short workload
        requestIntervalTicks: 4, // slow arrival
        processingTicksPerRequest: 1,
        autoscaling: {
          enabled: true,
          minReplicas: 2,
          initialReplicas: 4, // starts with 4 replicas
          maxReplicas: 5,
          scaleOutThreshold: 80,
          scaleInThreshold: 35,
          scaleOutCooldown: 2,
          scaleInCooldown: 2,
          modeledCapacityPerReplica: 4,
          startupDelayTicks: 0,
          scaleOutIncrement: 1,
          scaleInDecrement: 1
        }
      });

      // Step multiple times under low load
      for (let i = 0; i < 10; i++) {
        engine.step();
      }

      const snap = engine.getSnapshot();
      expect(snap.autoscaling?.scaleInCount).toBeGreaterThan(0);
      expect(snap.autoscaling?.currentTotalReplicas).toBeLessThan(4);
      expect(snap.autoscaling?.currentTotalReplicas).toBeGreaterThanOrEqual(2);
      expect(snap.events.some(e => e.type === "SCALE_IN_TRIGGERED")).toBe(true);
    });

    it("should preserve fixed capacity when autoscaling is disabled", () => {
      const project = createValidHaProject();
      const engine = new SimulationEngine(project, {
        totalRequests: 16,
        requestIntervalTicks: 1,
        processingTicksPerRequest: 5,
        autoscaling: {
          enabled: false, // DISABLED
          minReplicas: 2,
          initialReplicas: 2,
          maxReplicas: 5,
          scaleOutThreshold: 50,
          scaleInThreshold: 20,
          scaleOutCooldown: 1,
          scaleInCooldown: 2,
          modeledCapacityPerReplica: 2,
          startupDelayTicks: 0,
          scaleOutIncrement: 1,
          scaleInDecrement: 1
        }
      });

      for (let i = 0; i < 10; i++) {
        engine.step();
      }

      const snap = engine.getSnapshot();
      expect(snap.autoscaling?.scaleOutCount).toBe(0);
      expect(snap.autoscaling?.currentTotalReplicas).toBe(2);
      expect(snap.events.some(e => e.type === "SCALE_OUT_TRIGGERED")).toBe(false);
    });

    it("should reset completely without mutating project snapshot or leaking replicas", () => {
      const project = createValidHaProject();
      const initialResourcesCount = project.resources.length;

      const engine = new SimulationEngine(project, {
        totalRequests: 10,
        requestIntervalTicks: 1,
        processingTicksPerRequest: 4,
        autoscaling: {
          enabled: true,
          minReplicas: 2,
          initialReplicas: 2,
          maxReplicas: 5,
          scaleOutThreshold: 60,
          scaleInThreshold: 20,
          scaleOutCooldown: 1,
          scaleInCooldown: 2,
          modeledCapacityPerReplica: 2,
          startupDelayTicks: 0,
          scaleOutIncrement: 1,
          scaleInDecrement: 1
        }
      });

      for (let i = 0; i < 6; i++) engine.step();
      expect(engine.getSnapshot().autoscaling?.scaleOutCount).toBeGreaterThan(0);

      // Reset
      const snap = engine.reset();
      expect(snap.currentTick).toBe(0);
      expect(snap.autoscaling?.currentTotalReplicas).toBe(2);
      expect(snap.autoscaling?.scaleOutCount).toBe(0);
      expect(snap.autoscaling?.scaleInCount).toBe(0);
      expect(project.resources.length).toBe(initialResourcesCount);
    });
  });
});
