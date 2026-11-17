import { PROJECTED_BOOK_PAGES } from '../../../../shared/config/index.ts';
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

export const MODEL_RATE_CARD: Record<string, ModelRatesPerMillion> = {
  'gemini-4-hydrogen': {
    inputPerMillion: 0,
    cachedInputPerMillion: 0,
    textOutputPerMillion: 0,
    imageOutputPerMillion: 0,
    isFreeTier: true,
  },
  'gemini-3.1-flash-lite': {
    inputPerMillion: 0,
    cachedInputPerMillion: 0,
    textOutputPerMillion: 0,
    imageOutputPerMillion: 0,
    isFreeTier: true,
  },
  'gemini-3.1-flash-lite-image': {
    inputPerMillion: 0.25,
    cachedInputPerMillion: 0.025,
    textOutputPerMillion: 1.5,
    imageOutputPerMillion: 30,
    isFreeTier: false,
  },
  'gemini-nano-banana-2.1': {
    inputPerMillion: 1.5,
    cachedInputPerMillion: 0.15,
    textOutputPerMillion: 7.5,
    imageOutputPerMillion: 30,
    isFreeTier: false,
  },
  'gemini-3.1-flash-image': {
    inputPerMillion: 0.5,
    cachedInputPerMillion: 0.05,
    textOutputPerMillion: 3,
    imageOutputPerMillion: 60,
    isFreeTier: false,
  },
  'gemini-3-pro-image': {
    inputPerMillion: 2,
    cachedInputPerMillion: 0.2,
    textOutputPerMillion: 12,
    imageOutputPerMillion: 120,
    isFreeTier: false,
  },
  'gpt-image-1': {
    inputPerMillion: 8,
    cachedInputPerMillion: 2,
    textOutputPerMillion: 5,
    imageOutputPerMillion: 30,
    isFreeTier: false,
  },
  'gpt-image-2.6-sunburst': {
    inputPerMillion: 8,
    cachedInputPerMillion: 2,
    textOutputPerMillion: 5,
    imageOutputPerMillion: 30,
    isFreeTier: false,
  },
  'gpt-image-2.6-flare': {
    inputPerMillion: 8,
    cachedInputPerMillion: 2,
    textOutputPerMillion: 5,
    imageOutputPerMillion: 30,
    isFreeTier: false,
  },
};

const ZERO_RATES: ModelRatesPerMillion = {
  inputPerMillion: 0,
  cachedInputPerMillion: 0,
  textOutputPerMillion: 0,
  imageOutputPerMillion: 0,
  isFreeTier: true,
};

export function calculateGenerationCost(
  params: TokenUsageInput,
  warn: (message: string) => void = console.warn
): UsageBreakdown {
  const knownRates = MODEL_RATE_CARD[params.model];
  if (!knownRates) {
    warn(
      `[COST_ESTIMATION] Unknown model "${params.model}" — no rate card entry found, defaulting estimated cost to $0.`
    );
  }
  const rates = knownRates ?? ZERO_RATES;

  const billableInputTokens = Math.max(
    0,
    params.inputTokens - params.cachedInputTokens
  );

  const rawCost =
    (billableInputTokens / 1_000_000) * rates.inputPerMillion +
    (params.cachedInputTokens / 1_000_000) * rates.cachedInputPerMillion +
    (params.textOutputTokens / 1_000_000) * rates.textOutputPerMillion +
    (params.imageOutputTokens / 1_000_000) * rates.imageOutputPerMillion;

  const estimatedCostUsd = Number(rawCost.toFixed(6));
  const projectedBook16CostUsd = Number(
    (estimatedCostUsd * PROJECTED_BOOK_PAGES).toFixed(4)
  );

  return {
    inputTokens: Math.max(0, Math.round(params.inputTokens)),
    cachedInputTokens: Math.max(0, Math.round(params.cachedInputTokens)),
    textOutputTokens: Math.max(0, Math.round(params.textOutputTokens)),
    imageOutputTokens: Math.max(0, Math.round(params.imageOutputTokens)),
    estimatedCostUsd,
    projectedBook16CostUsd,
    isFreeTier: rates.isFreeTier,
  };
}
