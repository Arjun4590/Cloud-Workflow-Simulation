import type { ResourceRuntimeInfo, RoutingDecision } from "../SimulationTypes";
import type { IRoutingAlgorithm, RoutingContext } from "./RoutingAlgorithm";

export class LeastConnectionsAlgorithm implements IRoutingAlgorithm {
  readonly type = "least_connections" as const;
  readonly name = "Least Connections";

  public selectTarget(
    candidates: string[],
    resourceStates: Map<string, ResourceRuntimeInfo>,
    context: RoutingContext
  ): RoutingDecision | null {
    if (!candidates || candidates.length === 0) {
      return null;
    }

    const sortedCandidates = [...candidates].sort();

    // Filter to healthy, available backends
    const healthyCandidates = sortedCandidates.filter(id => {
      const state = resourceStates.get(id);
      return state && !state.isFailed && state.state !== "unavailable" && state.state !== "failed";
    });

    const activeConns: Record<string, number> = {};
    for (const c of sortedCandidates) {
      activeConns[c] = resourceStates.get(c)?.activeRequests || 0;
    }

    if (healthyCandidates.length === 0) {
      return null;
    }

    // Find candidate with minimum active connections
    let minActive = Infinity;
    const tiedCandidates: string[] = [];

    for (const id of healthyCandidates) {
      const active = activeConns[id] ?? 0;
      if (active < minActive) {
        minActive = active;
        tiedCandidates.length = 0;
        tiedCandidates.push(id);
      } else if (active === minActive) {
        tiedCandidates.push(id);
      }
    }

    // Deterministic tie-breaking: pick first sorted ID among ties
    const selectedTargetId = tiedCandidates[0];
    const selectedName = context.resourceNames[selectedTargetId] || selectedTargetId;

    let reason: string;
    if (tiedCandidates.length > 1) {
      reason = `${selectedName} was selected with the lowest active load (${minActive} in-flight request${minActive === 1 ? '' : 's'}), tied with ${tiedCandidates.length - 1} other instance(s) and selected via deterministic tie-breaker.`;
    } else {
      reason = `${selectedName} was selected because it has the lowest active load (${minActive} in-flight request${minActive === 1 ? '' : 's'}) among all ${healthyCandidates.length} healthy backends.`;
    }

    return {
      algorithm: this.type,
      selectedTargetId,
      candidateTargetIds: sortedCandidates,
      targetActiveConnections: activeConns,
      reason,
      timestampTick: context.tick
    };
  }

  public reset(): void {
    // Stateless per selection, relies on active connection counts in runtime state
  }
}
