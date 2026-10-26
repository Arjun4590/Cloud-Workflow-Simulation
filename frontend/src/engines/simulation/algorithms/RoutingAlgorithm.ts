import type { ResourceRuntimeInfo, RoutingAlgorithmType, RoutingDecision } from "../SimulationTypes";

export interface RoutingContext {
  tick: number;
  requestId: string;
  loadBalancerId: string;
  loadBalancerName: string;
  resourceNames: Record<string, string>;
}

export interface IRoutingAlgorithm {
  readonly type: RoutingAlgorithmType;
  readonly name: string;
  selectTarget(
    candidates: string[],
    resourceStates: Map<string, ResourceRuntimeInfo>,
    context: RoutingContext
  ): RoutingDecision | null;
  reset(): void;
}
