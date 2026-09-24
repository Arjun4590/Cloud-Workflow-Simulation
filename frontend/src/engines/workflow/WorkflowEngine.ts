import type { CloudProject, WorkflowConnection } from "../../types/workflow";
import type { ExecutionPlan, ExecutionStage, ValidationIssue } from "../types";
import { ValidationEngine } from "../validation/ValidationEngine";

export class WorkflowEngine {
  public static buildExecutionPlan(project: CloudProject): ExecutionPlan {
    const validation = ValidationEngine.validate(project);
    
    // We only use "dependency" edges for determining the execution order
    const dependencyEdges = project.connections.filter(c => c.type === "dependency");

    const { stages, cycleError } = this.computeTopologicalStages(project, dependencyEdges);
    
    const allErrors = [...validation.errors];
    if (cycleError) {
      allErrors.push(cycleError);
    }

    return {
      valid: allErrors.length === 0,
      stages,
      errors: allErrors
    };
  }

  private static computeTopologicalStages(project: CloudProject, edges: WorkflowConnection[]): { stages: ExecutionStage[], cycleError?: ValidationIssue } {
    const inDegree = new Map<string, number>();
    const adjacencyList = new Map<string, string[]>();
    
    for (const res of project.resources) {
      inDegree.set(res.id, 0);
      adjacencyList.set(res.id, []);
    }

    for (const edge of edges) {
      if (!inDegree.has(edge.source) || !inDegree.has(edge.target)) continue;

      adjacencyList.get(edge.source)!.push(edge.target);
      inDegree.set(edge.target, inDegree.get(edge.target)! + 1);
    }

    // Nodes with 0 in-degree
    let queue: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    const stages: ExecutionStage[] = [];
    let processedCount = 0;
    let stageIndex = 1;

    while (queue.length > 0) {
      const currentLevelSize = queue.length;
      const nextQueue: string[] = [];
      const currentStageIds: string[] = [];

      for (let i = 0; i < currentLevelSize; i++) {
        const nodeId = queue[i];
        currentStageIds.push(nodeId);
        processedCount++;

        const neighbors = adjacencyList.get(nodeId) || [];
        for (const next of neighbors) {
          const currentDegree = inDegree.get(next)!;
          inDegree.set(next, currentDegree - 1);
          if (currentDegree - 1 === 0) {
            nextQueue.push(next);
          }
        }
      }

      stages.push({
        index: stageIndex++,
        resourceIds: currentStageIds
      });

      queue = nextQueue;
    }

    if (processedCount < project.resources.length) {
      // Cycle detected
      return {
        stages: [],
        cycleError: {
          code: "DEPENDENCY_CYCLE_EXECUTION",
          severity: "ERROR",
          message: "Cannot build execution plan due to circular dependencies."
        }
      };
    }

    return { stages };
  }
}
