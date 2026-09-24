import { describe, it, expect } from "vitest";
import { WorkflowEngine } from "../workflow/WorkflowEngine";
import { ValidationEngine } from "../validation/ValidationEngine";
import type { CloudProject } from "../../types/workflow";

describe("Workflow and Validation Engines", () => {

  const createBaseProject = (): CloudProject => ({
    id: "test-proj",
    name: "Test Project",
    resources: [],
    connections: []
  });

  it("should validate a valid dependency chain", () => {
    const project = createBaseProject();
    project.resources = [
      { id: "img1", name: "img", type: "image", configuration: { name: "img" } },
      { id: "cnt1", name: "cnt", type: "container", configuration: { name: "cnt", image: "img" } },
      { id: "pod1", name: "pod", type: "pod", configuration: { name: "pod", replicas: 1 } },
      { id: "dep1", name: "dep", type: "deployment", configuration: { name: "dep", replicas: 1, image: "img" } },
      { id: "svc1", name: "svc", type: "service", configuration: { name: "svc", port: 80, targetPort: 8080 } },
      { id: "backend1", name: "bk", type: "backend", configuration: { name: "bk", runtime: "node" } },
      { id: "db1", name: "db", type: "sql_database", configuration: { name: "db", type: "SQL", storage: "10G" } }
    ];
    
    project.connections = [
      { id: "c1", source: "img1", target: "cnt1", type: "dependency" },
      { id: "c2", source: "cnt1", target: "pod1", type: "dependency" },
      { id: "c3", source: "dep1", target: "pod1", type: "manages" },
      { id: "c4", source: "svc1", target: "pod1", type: "routes_to" },
      { id: "c5", source: "backend1", target: "db1", type: "uses" }
    ];

    const validation = ValidationEngine.validate(project);
    if (!validation.valid) {
      console.log("TEST 1 ERRORS:", validation.errors);
    }
    expect(validation.valid).toBe(true);

    const plan = WorkflowEngine.buildExecutionPlan(project);
    expect(plan.valid).toBe(true);
    // stages: Stage 1: img1, dep1, svc1, backend1. Stage 2: cnt1. Stage 3: pod1. db1 is also independent? 
    // db1 has no dependency! wait, uses doesn't mean dependency order. backend1 depends on nothing. db1 depends on nothing.
    // wait, actually, backend uses db, so db must be ready before backend? The connection is backend1 -> db1 via "uses".
    // Is it a "dependency"? No, we said only "dependency" type connections determine execution plan order.
    // So db1 is independent.
  });

  it("should flag missing required dependency", () => {
    const project = createBaseProject();
    project.resources = [
      { id: "cnt1", name: "cnt", type: "container", configuration: { name: "cnt", image: "img" } }
    ];
    // container requires incoming image dependency
    const validation = ValidationEngine.validate(project);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.code === "MISSING_DEPENDENCY")).toBe(true);
  });

  it("should detect invalid connection type", () => {
    const project = createBaseProject();
    project.resources = [
      { id: "db1", name: "db", type: "sql_database", configuration: { name: "db", type: "SQL" } },
      { id: "dep1", name: "dep", type: "deployment", configuration: { name: "dep", replicas: 1, image: "a" } }
    ];
    // invalid connection: db -> dep via routes_to
    project.connections = [
      { id: "c1", source: "db1", target: "dep1", type: "routes_to" }
    ];

    const validation = ValidationEngine.validate(project);
    console.log("TEST 3 ERRORS:", validation.errors);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.code === "INVALID_CONNECTION_TYPE")).toBe(true);
  });

  it("should detect circular dependency", () => {
    const project = createBaseProject();
    project.resources = [
      { id: "n1", name: "n1", type: "image", configuration: { name: "n1" } },
      { id: "n2", name: "n2", type: "container", configuration: { name: "n2", image: "i" } },
      { id: "n3", name: "n3", type: "pod", configuration: { name: "n3" } }
    ];
    project.connections = [
      { id: "c1", source: "n1", target: "n2", type: "dependency" },
      { id: "c2", source: "n2", target: "n3", type: "dependency" },
      { id: "c3", source: "n3", target: "n1", type: "dependency" } // cycle
    ];

    const validation = ValidationEngine.validate(project);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.code === "DEPENDENCY_CYCLE")).toBe(true);
  });

  it("should group independent resources in same stage", () => {
    const project = createBaseProject();
    project.resources = [
      { id: "n1", name: "n1", type: "network", configuration: { name: "n1" } },
      { id: "db1", name: "db1", type: "sql_database", configuration: { name: "db1", type: "sql", storage: "10g" } },
      { id: "img1", name: "img1", type: "image", configuration: { name: "img1" } }
    ];

    const plan = WorkflowEngine.buildExecutionPlan(project);
    expect(plan.valid).toBe(true);
    expect(plan.stages.length).toBe(1);
    expect(plan.stages[0].resourceIds.length).toBe(3);
  });

  it("should flag invalid resource references (structural)", () => {
    const project = createBaseProject();
    project.resources = [
      { id: "img1", name: "img", type: "image", configuration: { name: "img" } }
    ];
    project.connections = [
      { id: "c1", source: "img1", target: "missing", type: "dependency" }
    ];

    const validation = ValidationEngine.validate(project);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.code === "INVALID_CONNECTION_TARGET")).toBe(true);
  });
});
