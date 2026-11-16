import type { UsageBreakdown } from '../../../../shared/types/index.ts';

export type { UsageBreakdown };

export interface TokenUsageInput {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  textOutputTokens: number;
  imageOutputTokens: number;
}

export interface ModelRatesPerMillion {
  inputPerMillion: number;
  cachedInputPerMillion: number;
  textOutputPerMillion: number;
  imageOutputPerMillion: number;
  isFreeTier: boolean;
}

export interface CostEstimator {
  calculate(input: TokenUsageInput): UsageBreakdown;
}
