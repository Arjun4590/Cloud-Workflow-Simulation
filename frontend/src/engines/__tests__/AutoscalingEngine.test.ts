import { describe, it, expect, beforeEach } from "vitest";
import { AutoscalingPolicy } from "../simulation/autoscaling/AutoscalingPolicy";
import { AutoscalingEngine } from "../simulation/autoscaling/AutoscalingEngine";
import {
  DEFAULT_AUTOSCALING_CONFIG,
  validateAutoscalingConfig
} from "../simulation/autoscaling/AutoscalingTypes";
import type { AutoscalingConfig } from "../simulation/autoscaling/AutoscalingTypes";

describe("Autoscaling Policy and Engine", () => {
  let baseConfig: AutoscalingConfig;

  beforeEach(() => {
    baseConfig = {
      ...DEFAULT_AUTOSCALING_CONFIG,
      enabled: true,
      minReplicas: 2,
      initialReplicas: 2,
      maxReplicas: 5,
      scaleOutThreshold: 80,
      scaleInThreshold: 30,
      scaleOutCooldown: 3,
      scaleInCooldown: 5,
      modeledCapacityPerReplica: 5
    };
  });

  describe("Configuration Validation", () => {
    it("should accept valid configuration", () => {
      const res = validateAutoscalingConfig(baseConfig);
      expect(res.valid).toBe(true);
      expect(res.errors.length).toBe(0);
    });

    it("should reject minReplicas < 1", () => {
      const res = validateAutoscalingConfig({ ...baseConfig, minReplicas: 0 });
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes("Minimum replicas"))).toBe(true);
    });

    it("should reject maxReplicas < minReplicas", () => {
      const res = validateAutoscalingConfig({ ...baseConfig, minReplicas: 4, maxReplicas: 2 });
      expect(res.valid).toBe(false);
    });

    it("should reject scaleInThreshold >= scaleOutThreshold", () => {
      const res = validateAutoscalingConfig({ ...baseConfig, scaleInThreshold: 80, scaleOutThreshold: 80 });
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes("strictly lower"))).toBe(true);
    });
  });

  describe("Autoscaling Policy Decisions", () => {
    it("should not scale if disabled", () => {
      const decision = AutoscalingPolicy.evaluate({ ...baseConfig, enabled: false }, {
        currentTick: 1,
        currentReplicas: 2,
        readyHealthyReplicas: 2,
        healthyCapacity: 10,
        activeRequests: 9
      });
      expect(decision.direction).toBe("NONE");
      expect(decision.trigger).toBe("DISABLED");
    });

    it("should scale out when utilization >= scaleOutThreshold", () => {
      // 9 active requests with capacity 10 = 90% utilization >= 80%
      const decision = AutoscalingPolicy.evaluate(baseConfig, {
        currentTick: 1,
        currentReplicas: 2,
        readyHealthyReplicas: 2,
        healthyCapacity: 10,
        activeRequests: 9
      });
      expect(decision.direction).toBe("SCALE_OUT");
      expect(decision.trigger).toBe("HIGH_UTILIZATION");
      expect(decision.targetReplicas).toBe(3);
      expect(decision.currentUtilization).toBe(90);
    });

    it("should block scale-out when cooldown is active", () => {
      // Cooldown of 3 ticks, last scale-out at tick 1, current tick 2
      const decision = AutoscalingPolicy.evaluate(baseConfig, {
        currentTick: 2,
        currentReplicas: 3,
        readyHealthyReplicas: 3,
        healthyCapacity: 15,
        activeRequests: 14,
        lastScaleOutTick: 1
      });
      expect(decision.direction).toBe("NONE");
      expect(decision.trigger).toBe("BLOCKED_COOLDOWN");
      expect(decision.reason).toContain("blocked by cooldown");
    });

    it("should block scale-out when maxReplicas is reached", () => {
      const decision = AutoscalingPolicy.evaluate(baseConfig, {
        currentTick: 10,
        currentReplicas: 5,
        readyHealthyReplicas: 5,
        healthyCapacity: 25,
        activeRequests: 24,
        lastScaleOutTick: 1
      });
      expect(decision.direction).toBe("NONE");
      expect(decision.trigger).toBe("BLOCKED_MAX_CAPACITY");
      expect(decision.reason).toContain("maximum capacity");
    });

    it("should scale in when utilization <= scaleInThreshold", () => {
      // 2 active requests with capacity 15 = 13.3% utilization <= 30%
      const decision = AutoscalingPolicy.evaluate(baseConfig, {
        currentTick: 10,
        currentReplicas: 3,
        readyHealthyReplicas: 3,
        healthyCapacity: 15,
        activeRequests: 2
      });
      expect(decision.direction).toBe("SCALE_IN");
      expect(decision.trigger).toBe("LOW_UTILIZATION");
      expect(decision.targetReplicas).toBe(2);
    });

    it("should block scale-in when minReplicas is reached", () => {
      // At minReplicas (2)
      const decision = AutoscalingPolicy.evaluate(baseConfig, {
        currentTick: 10,
        currentReplicas: 2,
        readyHealthyReplicas: 2,
        healthyCapacity: 10,
        activeRequests: 1
      });
      expect(decision.direction).toBe("NONE");
      expect(decision.trigger).toBe("BLOCKED_MIN_CAPACITY");
      expect(decision.reason).toContain("minimum capacity");
    });

    it("should remain stable within hysteresis band", () => {
      // 5 active requests on capacity 10 = 50% utilization (between 30% and 80%)
      const decision = AutoscalingPolicy.evaluate(baseConfig, {
        currentTick: 5,
        currentReplicas: 2,
        readyHealthyReplicas: 2,
        healthyCapacity: 10,
        activeRequests: 5
      });
      expect(decision.direction).toBe("NONE");
      expect(decision.trigger).toBe("NO_ACTION_IN_HYSTERESIS");
    });
  });

  describe("Autoscaling Engine Lifecycle & Registry", () => {
    const baseBackends = [
      { id: "bk-1", name: "Worker 1", type: "backend" },
      { id: "bk-2", name: "Worker 2", type: "backend" }
    ];

    it("should initialize initial replicas", () => {
      const engine = new AutoscalingEngine(baseBackends, baseConfig);
      const eligible = engine.getEligibleTargetIds();
      expect(eligible.length).toBe(2);
      expect(eligible).toContain("bk-1");
      expect(eligible).toContain("bk-2");
    });

    it("should handle provisioning startup delay", () => {
      const engine = new AutoscalingEngine(baseBackends, { ...baseConfig, startupDelayTicks: 2 });
      
      // Simulate high load: 9 active requests on 10 capacity
      const replica1 = engine.getReplica("bk-1")!;
      replica1.activeRequests = 9;

      const { decision, newReplicas } = engine.evaluateAndStep(1);
      expect(decision.direction).toBe("SCALE_OUT");
      expect(newReplicas.length).toBe(1);
      expect(newReplicas[0].state).toBe("provisioning");

      // While provisioning, not yet in eligible pool!
      expect(engine.getEligibleTargetIds().length).toBe(2);

      // Advance clock by 1 tick (tick 2): still provisioning (ready at tick 1 + 2 = 3)
      engine.advanceLifecycle(2);
      expect(engine.getEligibleTargetIds().length).toBe(2);

      // Advance clock to tick 3: becomes ready!
      const { provisioned } = engine.advanceLifecycle(3);
      expect(provisioned.length).toBe(1);
      expect(engine.getEligibleTargetIds().length).toBe(3);
    });

    it("should drain replicas before removal on scale-in", () => {
      const engine = new AutoscalingEngine(baseBackends, { ...baseConfig, initialReplicas: 3, startupDelayTicks: 0 });
      expect(engine.getEligibleTargetIds().length).toBe(3);

      // Give the 3rd replica 1 active in-flight request
      const replicas = engine.getAllReplicas();
      const victim = replicas[2];
      victim.activeRequests = 1;

      // Evaluate scale-in at tick 5 with zero other load
      const { decision, drainingReplicas } = engine.evaluateAndStep(5);
      expect(decision.direction).toBe("SCALE_IN");
      expect(drainingReplicas.length).toBe(1);
      expect(drainingReplicas[0].state).toBe("draining");

      // Draining replica excluded from eligible pool immediately
      expect(engine.getEligibleTargetIds().length).toBe(2);

      // When in-flight request finishes, replica terminates
      engine.onReplicaRequestCompleted(victim.id, true);
      const { terminated } = engine.advanceLifecycle(6);
      expect(terminated.length).toBe(1);
      expect(engine.getAllReplicas().length).toBe(2);
    });

    it("should reset completely to initial replica count", () => {
      const engine = new AutoscalingEngine(baseBackends, { ...baseConfig, startupDelayTicks: 0 });
      // Scale out
      const r1 = engine.getReplica("bk-1")!;
      r1.activeRequests = 10;
      engine.evaluateAndStep(1);
      expect(engine.getAllReplicas().length).toBe(3);

      // Reset
      engine.reset();
      expect(engine.getAllReplicas().length).toBe(2);
      expect(engine.getMetrics(0).scaleOutCount).toBe(0);
    });
  });
});
