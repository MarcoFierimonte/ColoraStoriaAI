import type { PromptEvalUsage, PromptExecutionMode } from './types.ts';

export interface PromptEvalModelRateCard {
  inputPerMillion: number;
  cachedInputPerMillion: number;
  textOutputPerMillion: number;
  imageOutputPerMillion: number;
  batchDiscountRatio: number;
  isFreeTier: boolean;
}

export const DEFAULT_PROMPT_EVAL_RATE_CARD: Record<
  string,
  PromptEvalModelRateCard
> = {
  'gemini-4-hydrogen': {
    inputPerMillion: 0,
    cachedInputPerMillion: 0,
    textOutputPerMillion: 0,
    imageOutputPerMillion: 0,
    batchDiscountRatio: 0.5,
    isFreeTier: true,
  },
  'gemini-3.1-flash-lite': {
    inputPerMillion: 0,
    cachedInputPerMillion: 0,
    textOutputPerMillion: 0,
    imageOutputPerMillion: 0,
    batchDiscountRatio: 0.5,
    isFreeTier: true,
  },
  'gemini-3.1-flash-lite-image': {
    inputPerMillion: 0.25,
    cachedInputPerMillion: 0.025,
    textOutputPerMillion: 1.5,
    imageOutputPerMillion: 30,
    batchDiscountRatio: 0.5,
    isFreeTier: false,
  },
  'gemini-nano-banana-2.1': {
    inputPerMillion: 1.5,
    cachedInputPerMillion: 0.15,
    textOutputPerMillion: 7.5,
    imageOutputPerMillion: 30,
    batchDiscountRatio: 0.5,
    isFreeTier: false,
  },
  'gemini-3.1-flash-image': {
    inputPerMillion: 0.5,
    cachedInputPerMillion: 0.05,
    textOutputPerMillion: 3,
    imageOutputPerMillion: 60,
    batchDiscountRatio: 0.5,
    isFreeTier: false,
  },
  'gemini-3-pro-image': {
    inputPerMillion: 2,
    cachedInputPerMillion: 0.2,
    textOutputPerMillion: 12,
    imageOutputPerMillion: 120,
    batchDiscountRatio: 0.5,
    isFreeTier: false,
  },
  'gpt-image-1-mini': {
    inputPerMillion: 8,
    cachedInputPerMillion: 2,
    textOutputPerMillion: 5,
    imageOutputPerMillion: 30,
    batchDiscountRatio: 0.5,
    isFreeTier: false,
  },
  'gpt-image-1': {
    inputPerMillion: 8,
    cachedInputPerMillion: 2,
    textOutputPerMillion: 5,
    imageOutputPerMillion: 30,
    batchDiscountRatio: 0.5,
    isFreeTier: false,
  },
  'gpt-image-2.6-sunburst': {
    inputPerMillion: 8,
    cachedInputPerMillion: 2,
    textOutputPerMillion: 5,
    imageOutputPerMillion: 30,
    batchDiscountRatio: 1,
    isFreeTier: false,
  },
  'gpt-image-2.6-flare': {
    inputPerMillion: 8,
    cachedInputPerMillion: 2,
    textOutputPerMillion: 5,
    imageOutputPerMillion: 30,
    batchDiscountRatio: 1,
    isFreeTier: false,
  },
  'gpt-4.1-mini': {
    inputPerMillion: 0.4,
    cachedInputPerMillion: 0.1,
    textOutputPerMillion: 1.6,
    imageOutputPerMillion: 0,
    batchDiscountRatio: 0.5,
    isFreeTier: false,
  },
  'gpt-4o-mini': {
    inputPerMillion: 0.15,
    cachedInputPerMillion: 0.075,
    textOutputPerMillion: 0.6,
    imageOutputPerMillion: 0,
    batchDiscountRatio: 0.5,
    isFreeTier: false,
  },
};

export interface ComputePromptEvalUsageInput {
  model: string;
  executionMode: PromptExecutionMode;
  inputTokens: number;
  cachedInputTokens: number;
  textOutputTokens: number;
  imageOutputTokens: number;
  customRateCard?: Record<string, PromptEvalModelRateCard>;
}

export function computePromptEvalUsage(
  input: ComputePromptEvalUsageInput
): PromptEvalUsage {
  const rateCard = input.customRateCard ?? DEFAULT_PROMPT_EVAL_RATE_CARD;
  const rates = rateCard[input.model];

  const safeInput = Math.max(0, Math.round(input.inputTokens));
  const safeCached = Math.max(
    0,
    Math.min(safeInput, Math.round(input.cachedInputTokens))
  );
  const safeTextOut = Math.max(0, Math.round(input.textOutputTokens));
  const safeImageOut = Math.max(0, Math.round(input.imageOutputTokens));

  if (!rates) {
    return {
      inputTokens: safeInput,
      cachedInputTokens: safeCached,
      textOutputTokens: safeTextOut,
      imageOutputTokens: safeImageOut,
      estimatedCostUsd: 0,
      batchDiscountApplied: input.executionMode === 'batch',
    };
  }

  const billableInput = Math.max(0, safeInput - safeCached);
  const standardCost =
    (billableInput / 1_000_000) * rates.inputPerMillion +
    (safeCached / 1_000_000) * rates.cachedInputPerMillion +
    (safeTextOut / 1_000_000) * rates.textOutputPerMillion +
    (safeImageOut / 1_000_000) * rates.imageOutputPerMillion;

  const batchDiscountApplied =
    input.executionMode === 'batch' && rates.batchDiscountRatio < 1;
  const multiplier = batchDiscountApplied ? rates.batchDiscountRatio : 1;

  return {
    inputTokens: safeInput,
    cachedInputTokens: safeCached,
    textOutputTokens: safeTextOut,
    imageOutputTokens: safeImageOut,
    estimatedCostUsd: Number((standardCost * multiplier).toFixed(6)),
    batchDiscountApplied,
  };
}
