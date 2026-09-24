import type { CloudProject, WorkflowConnection } from "../../types/workflow";
import { RESOURCE_DEFINITIONS } from "../../config/resourceDefinitions";
import type { ValidationResult, ValidationIssue } from "../types";

export class ValidationEngine {
  public static validate(project: CloudProject): ValidationResult {
    const issues: ValidationIssue[] = [];

    this.validateStructure(project, issues);
    this.validateConfigurations(project, issues);
    this.validateConnections(project, issues);
    this.validateDependencies(project, issues);
    this.validateGraphCycles(project, issues);

    const errors = issues.filter(i => i.severity === "ERROR");
    const warnings = issues.filter(i => i.severity === "WARNING");
    const infos = issues.filter(i => i.severity === "INFO");

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      infos
    };
  }

  private static validateStructure(project: CloudProject, issues: ValidationIssue[]) {
    const ids = new Set<string>();
    
    if (project.resources.length === 0) {
      issues.push({
        code: "EMPTY_PROJECT",
        severity: "INFO",
        message: "The project is empty. Add resources to get started."
      });
      return;
    }

    for (const res of project.resources) {
      if (ids.has(res.id)) {
        issues.push({
          code: "DUPLICATE_RESOURCE_ID",
          severity: "ERROR",
          message: `Duplicate resource ID detected: ${res.id}`,
          resourceId: res.id
        });
      }
      ids.add(res.id);
    }

    for (const conn of project.connections) {
      if (!ids.has(conn.source)) {
        issues.push({
          code: "INVALID_CONNECTION_SOURCE",
          severity: "ERROR",
          message: `Connection source missing: ${conn.source}`,
          connectionId: conn.id
        });
      }
      if (!ids.has(conn.target)) {
        issues.push({
          code: "INVALID_CONNECTION_TARGET",
          severity: "ERROR",
          message: `Connection target missing: ${conn.target}`,
          connectionId: conn.id
        });
      }
      if (conn.source === conn.target) {
        issues.push({
          code: "SELF_CONNECTION",
          severity: "ERROR",
          message: `Resource cannot connect to itself`,
          connectionId: conn.id,
          resourceId: conn.source
        });
      }
    }
  }

  private static validateConfigurations(project: CloudProject, issues: ValidationIssue[]) {
    for (const res of project.resources) {
      const def = RESOURCE_DEFINITIONS[res.type];
      if (!def) continue;

      if (res.type === "container") {
        if (!res.configuration.image || (res.configuration.image as string).trim() === "") {
          issues.push({
            code: "MISSING_REQUIRED_FIELD",
            severity: "ERROR",
            message: `Container "${res.configuration.name}" requires an Image field.`,
            resourceId: res.id
          });
        }
      }

      if (res.type === "deployment") {
        const replicas = Number(res.configuration.replicas);
        if (isNaN(replicas) || replicas <= 0) {
          issues.push({
            code: "INVALID_REPLICAS",
            severity: "ERROR",
            message: `Deployment "${res.configuration.name}" replicas must be greater than 0.`,
            resourceId: res.id
          });
        }
      }

      if (res.type === "sql_database" || res.type === "nosql_database") {
        if (!res.configuration.type) {
          issues.push({
            code: "MISSING_REQUIRED_FIELD",
            severity: "ERROR",
            message: `Database "${res.configuration.name}" requires a database type.`,
            resourceId: res.id
          });
        }
      }
      
      // General required fields checking based on definitions if we added required flag
      // Assuming name is always required
      if (!res.configuration.name || (res.configuration.name as string).trim() === "") {
        issues.push({
          code: "MISSING_REQUIRED_FIELD",
          severity: "ERROR",
          message: `Resource is missing a name.`,
          resourceId: res.id
        });
      }
    }
  }

  private static validateConnections(project: CloudProject, issues: ValidationIssue[]) {
    const resourceMap = new Map(project.resources.map(r => [r.id, r]));

    for (const conn of project.connections) {
      const source = resourceMap.get(conn.source);
      const target = resourceMap.get(conn.target);

      if (!source || !target) continue;

      const sourceDef = RESOURCE_DEFINITIONS[source.type];
      const targetDef = RESOURCE_DEFINITIONS[target.type];

      // Check if source accepts outgoing connection of this type to target resource type
      const allowedOutgoing = sourceDef.acceptsOutgoing?.[conn.type];
      if (!allowedOutgoing || !allowedOutgoing.includes(target.type)) {
        issues.push({
          code: "INVALID_CONNECTION_TYPE",
          severity: "ERROR",
          message: `${sourceDef.label} "${source.configuration.name}" cannot have a "${conn.type}" connection to ${targetDef.label}.`,
          connectionId: conn.id,
          resourceId: source.id
        });
        continue;
      }

      // Check if target accepts incoming connection of this type from source resource type
      const allowedIncoming = targetDef.acceptsIncoming?.[conn.type];
      if (!allowedIncoming || !allowedIncoming.includes(source.type)) {
        issues.push({
          code: "INVALID_CONNECTION_TYPE",
          severity: "ERROR",
          message: `${targetDef.label} "${target.configuration.name}" cannot accept a "${conn.type}" connection from ${sourceDef.label}.`,
          connectionId: conn.id,
          resourceId: target.id
        });
      }
    }
  }

  private static validateDependencies(project: CloudProject, issues: ValidationIssue[]) {
    const resourceMap = new Map(project.resources.map(r => [r.id, r]));
    const incomingConnectionsByTarget = new Map<string, WorkflowConnection[]>();
    
    for (const res of project.resources) {
      incomingConnectionsByTarget.set(res.id, []);
    }
    
    for (const conn of project.connections) {
      const list = incomingConnectionsByTarget.get(conn.target);
      if (list) list.push(conn);
    }

    for (const res of project.resources) {
      const incoming = incomingConnectionsByTarget.get(res.id) || [];
      
      // Specifically check for dependency requirement (if target accepts incoming dependency, it might be required)
      // Here we implement semantic checks based on the rules.
      
      if (res.type === "container") {
        const hasImage = incoming.some(c => {
          const sourceRes = resourceMap.get(c.source);
          return sourceRes?.type === "image" && c.type === "dependency";
        });
        if (!hasImage) {
          issues.push({
            code: "MISSING_DEPENDENCY",
            severity: "ERROR",
            message: `Container "${res.configuration.name}" requires a Container Image dependency.`,
            resourceId: res.id
          });
        }
      }

      if (res.type === "service") {
        // Service should route to pod (or target workload)
        const outgoing = project.connections.filter(c => c.source === res.id && c.type === "routes_to");
        if (outgoing.length === 0) {
          issues.push({
            code: "MISSING_TARGET",
            severity: "ERROR",
            message: `Service "${res.configuration.name}" does not target any Pods or workloads.`,
            resourceId: res.id
          });
        }
      }
      
      if (res.type === "sql_database" || res.type === "nosql_database") {
        if (!res.configuration.storage) {
          issues.push({
            code: "MISSING_STORAGE",
            severity: "WARNING",
            message: `Database "${res.configuration.name}" has no explicit storage limit configured.`,
            resourceId: res.id
          });
        }
      }
    }
  }

  private static validateGraphCycles(project: CloudProject, issues: ValidationIssue[]) {
    // Only detect cycles in 'dependency' edges
    const dependencyEdges = project.connections.filter(c => c.type === "dependency");
    
    const adjacencyList = new Map<string, string[]>();
    for (const res of project.resources) {
      adjacencyList.set(res.id, []);
    }
    for (const edge of dependencyEdges) {
      const list = adjacencyList.get(edge.source);
      if (list) list.push(edge.target);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      if (recStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const next of neighbors) {
        if (dfs(next)) return true;
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const res of project.resources) {
      if (!visited.has(res.id)) {
        if (dfs(res.id)) {
          issues.push({
            code: "DEPENDENCY_CYCLE",
            severity: "ERROR",
            message: `A circular dependency was detected involving resource "${res.configuration.name || res.id}".`,
            resourceId: res.id
          });
          // We break after finding one cycle to avoid spamming the user
          break;
        }
      }
    }
  }
}
