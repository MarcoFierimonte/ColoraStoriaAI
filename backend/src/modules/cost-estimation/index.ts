import type {
  CostEstimator,
  TokenUsageInput,
  UsageBreakdown,
} from './costEstimation.interface.ts';
import { StaticRateCardCostEstimator } from './implementations/staticRateCardCostEstimator.ts';

export type {
  CostEstimator,
  ModelRatesPerMillion,
  TokenUsageInput,
  UsageBreakdown,
} from './costEstimation.interface.ts';
export { StaticRateCardCostEstimator } from './implementations/staticRateCardCostEstimator.ts';

export const costEstimator: CostEstimator = new StaticRateCardCostEstimator();

export function calculateGenerationCost(params: TokenUsageInput): UsageBreakdown {
  return costEstimator.calculate(params);
}
