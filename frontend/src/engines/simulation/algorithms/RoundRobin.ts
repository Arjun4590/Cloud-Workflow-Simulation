import type { ResourceRuntimeInfo, RoutingDecision } from "../SimulationTypes";
import type { IRoutingAlgorithm, RoutingContext } from "./RoutingAlgorithm";

export class RoundRobinAlgorithm implements IRoutingAlgorithm {
  readonly type = "round_robin" as const;
  readonly name = "Round Robin";

  private currentIndex: number = 0;

  public selectTarget(
    candidates: string[],
    resourceStates: Map<string, ResourceRuntimeInfo>,
    context: RoutingContext
  ): RoutingDecision | null {
    if (!candidates || candidates.length === 0) {
      return null;
    }

    // Sort candidates deterministically by ID so rotation order is stable
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

    // Pick according to round robin pointer across healthy candidates
    const selectedIndex = this.currentIndex % healthyCandidates.length;
    const selectedTargetId = healthyCandidates[selectedIndex];
    const selectedName = context.resourceNames[selectedTargetId] || selectedTargetId;

    // Advance pointer for next request
    this.currentIndex = (selectedIndex + 1) % healthyCandidates.length;

    const reason = healthyCandidates.length === sortedCandidates.length
      ? `${selectedName} was selected as the next eligible instance in the round-robin rotation (index ${selectedIndex + 1} of ${healthyCandidates.length}).`
      : `${selectedName} was selected as next eligible instance; ${sortedCandidates.length - healthyCandidates.length} unhealthy instance(s) were bypassed.`;

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
    this.currentIndex = 0;
  }
}
