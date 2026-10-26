import { describe, it, expect, beforeEach } from "vitest";
import { RoundRobinAlgorithm } from "../simulation/algorithms/RoundRobin";
import { LeastConnectionsAlgorithm } from "../simulation/algorithms/LeastConnections";
import type { ResourceRuntimeInfo } from "../simulation/SimulationTypes";
import type { RoutingContext } from "../simulation/algorithms/RoutingAlgorithm";

describe("Routing Algorithms", () => {
  let resourceStates: Map<string, ResourceRuntimeInfo>;
  let context: RoutingContext;

  const createResourceInfo = (id: string, name: string, active: number = 0, isFailed: boolean = false): ResourceRuntimeInfo => ({
    resourceId: id,
    name,
    type: "backend",
    state: isFailed ? "unavailable" : "ready",
    activeRequests: active,
    handledRequests: active,
    failedRequests: 0,
    isFailed
  });

  beforeEach(() => {
    resourceStates = new Map();
    resourceStates.set("b1", createResourceInfo("b1", "Backend A", 0));
    resourceStates.set("b2", createResourceInfo("b2", "Backend B", 0));
    resourceStates.set("b3", createResourceInfo("b3", "Backend C", 0));

    context = {
      tick: 1,
      requestId: "REQ-001",
      loadBalancerId: "lb1",
      loadBalancerName: "Main-LB",
      resourceNames: { b1: "Backend A", b2: "Backend B", b3: "Backend C" }
    };
  });

  describe("Round Robin Algorithm", () => {
    it("should distribute requests evenly across healthy backends in rotation", () => {
      const rr = new RoundRobinAlgorithm();
      const candidates = ["b1", "b2", "b3"];

      const d1 = rr.selectTarget(candidates, resourceStates, { ...context, requestId: "REQ-1" });
      const d2 = rr.selectTarget(candidates, resourceStates, { ...context, requestId: "REQ-2" });
      const d3 = rr.selectTarget(candidates, resourceStates, { ...context, requestId: "REQ-3" });
      const d4 = rr.selectTarget(candidates, resourceStates, { ...context, requestId: "REQ-4" });

      expect(d1?.selectedTargetId).toBe("b1");
      expect(d2?.selectedTargetId).toBe("b2");
      expect(d3?.selectedTargetId).toBe("b3");
      // Wraps around to b1
      expect(d4?.selectedTargetId).toBe("b1");
      expect(d1?.reason).toContain("round-robin rotation");
    });

    it("should skip unavailable or failed backends cleanly", () => {
      const rr = new RoundRobinAlgorithm();
      const candidates = ["b1", "b2", "b3"];

      // Fail backend B
      resourceStates.get("b2")!.isFailed = true;
      resourceStates.get("b2")!.state = "unavailable";

      const d1 = rr.selectTarget(candidates, resourceStates, { ...context, requestId: "REQ-1" });
      const d2 = rr.selectTarget(candidates, resourceStates, { ...context, requestId: "REQ-2" });
      const d3 = rr.selectTarget(candidates, resourceStates, { ...context, requestId: "REQ-3" });

      expect(d1?.selectedTargetId).toBe("b1");
      expect(d2?.selectedTargetId).toBe("b3"); // b2 skipped!
      expect(d3?.selectedTargetId).toBe("b1"); // wraps back to b1
      expect(d1?.reason).toContain("unhealthy instance(s) were bypassed");
    });

    it("should return null if no healthy backends exist", () => {
      const rr = new RoundRobinAlgorithm();
      const candidates = ["b1"];
      resourceStates.get("b1")!.isFailed = true;
      resourceStates.get("b1")!.state = "unavailable";

      const decision = rr.selectTarget(candidates, resourceStates, context);
      expect(decision).toBeNull();
    });

    it("should reset rotation pointer when reset() is called", () => {
      const rr = new RoundRobinAlgorithm();
      const candidates = ["b1", "b2", "b3"];

      rr.selectTarget(candidates, resourceStates, context); // selects b1
      rr.selectTarget(candidates, resourceStates, context); // selects b2

      rr.reset();
      const dAfterReset = rr.selectTarget(candidates, resourceStates, context);
      expect(dAfterReset?.selectedTargetId).toBe("b1");
    });
  });

  describe("Least Connections Algorithm", () => {
    it("should pick the backend with fewest active connections", () => {
      const lc = new LeastConnectionsAlgorithm();
      const candidates = ["b1", "b2", "b3"];

      // b1 has 3 active, b2 has 1 active, b3 has 4 active
      resourceStates.get("b1")!.activeRequests = 3;
      resourceStates.get("b2")!.activeRequests = 1;
      resourceStates.get("b3")!.activeRequests = 4;

      const decision = lc.selectTarget(candidates, resourceStates, context);
      expect(decision?.selectedTargetId).toBe("b2");
      expect(decision?.reason).toContain("lowest active load (1 in-flight request)");
    });

    it("should deterministically break ties among backends with equal load", () => {
      const lc = new LeastConnectionsAlgorithm();
      const candidates = ["b2", "b1", "b3"];

      // All have 0 active connections
      const decision = lc.selectTarget(candidates, resourceStates, context);
      // Candidates sorted deterministically: b1 comes first
      expect(decision?.selectedTargetId).toBe("b1");
      expect(decision?.reason).toContain("deterministic tie-breaker");
    });

    it("should exclude failed instances even if they have zero active connections", () => {
      const lc = new LeastConnectionsAlgorithm();
      const candidates = ["b1", "b2", "b3"];

      resourceStates.get("b1")!.isFailed = true;
      resourceStates.get("b1")!.activeRequests = 0; // 0 active, but failed!

      resourceStates.get("b2")!.activeRequests = 2;
      resourceStates.get("b3")!.activeRequests = 5;

      const decision = lc.selectTarget(candidates, resourceStates, context);
      expect(decision?.selectedTargetId).toBe("b2");
    });

    it("should dynamically balance as active loads change", () => {
      const lc = new LeastConnectionsAlgorithm();
      const candidates = ["b1", "b2"];

      // Both start with 0
      const d1 = lc.selectTarget(candidates, resourceStates, context);
      expect(d1?.selectedTargetId).toBe("b1");
      resourceStates.get("b1")!.activeRequests = 1; // b1 now has 1 active

      // Now b2 has 0, b1 has 1
      const d2 = lc.selectTarget(candidates, resourceStates, context);
      expect(d2?.selectedTargetId).toBe("b2");
      resourceStates.get("b2")!.activeRequests = 1; // b2 now has 1 active

      // Tied at 1 active each: tie-breaker chooses b1
      const d3 = lc.selectTarget(candidates, resourceStates, context);
      expect(d3?.selectedTargetId).toBe("b1");
    });
  });
});
