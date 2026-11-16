import { useState } from 'react';
import type { AdminTelemetry } from '../modules/coloring-api';

/**
 * TEMPORARY ISOLATED MODULE
 * Simulates per-image and 16-page book costs on paid Gemini & OpenAI image models
 * (both Standard real-time and Batch API -50% modes) using the actual input/cached
 * tokens measured from a `gemini-4-hydrogen` run and official rates/turnaround
 * documented in `pricing/ai/image-generation-costs.md`.
 * Remove this file and its single import in `AdminTelemetryPanel.tsx` once no longer needed.
 */

interface TempModelCostEstimatorPanelProps {
  telemetry: AdminTelemetry;
}

type TargetResolution = '1K' | '2K';
type ApiExecutionMode = 'standard' | 'batch';

interface SimulatedModelSpec {
  id: string;
  provider: 'Google' | 'OpenAI';
  label: string;
  tier: string;
  note: string;
  supportsBatch: boolean;
  standardLatencyLabel: string;
  batchLatencyLabel: string;
  estimateCostUsd: (params: {
    inputTokens: number;
    cachedInputTokens: number;
    resolution: TargetResolution;
    mode: ApiExecutionMode;
  }) => {
    costUsd: number;
    assumedOutputTokens: number;
    resolutionLabel: string;
    appliedBatchDiscount: boolean;
  };
}

const PROMPT_TEXT_TOKENS_ESTIMATE = 300;

function estimateGeminiCost(params: {
  inputTokens: number;
  cachedInputTokens: number;
  inputPerMillion: number;
  cachedInputPerMillion: number;
  imageOutputPerMillion: number;
  outputTokens1K: number;
  outputTokens2K: number | null;
  resolution: TargetResolution;
  mode: ApiExecutionMode;
}) {
  const billableInput = Math.max(0, params.inputTokens - params.cachedInputTokens);
  const inputCost =
    (billableInput / 1_000_000) * params.inputPerMillion +
    (params.cachedInputTokens / 1_000_000) * params.cachedInputPerMillion;

  const use2K = params.resolution === '2K' && params.outputTokens2K !== null;
  const assumedOutputTokens = use2K
    ? (params.outputTokens2K as number)
    : params.outputTokens1K;

  const outputCost =
    (assumedOutputTokens / 1_000_000) * params.imageOutputPerMillion;
  const discountMultiplier = params.mode === 'batch' ? 0.5 : 1;

  return {
    costUsd: Number(((inputCost + outputCost) * discountMultiplier).toFixed(5)),
    assumedOutputTokens,
    resolutionLabel:
      params.resolution === '2K' && params.outputTokens2K === null
        ? '1K (unico taglio)'
        : params.resolution,
    appliedBatchDiscount: params.mode === 'batch',
  };
}

function estimateOpenAiCost(params: {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  resolutionLabel: string;
  supportsBatch: boolean;
  mode: ApiExecutionMode;
}) {
  const totalIn = Math.max(0, params.inputTokens);
  const textIn = Math.min(totalIn, PROMPT_TEXT_TOKENS_ESTIMATE);
  const imageIn = Math.max(0, totalIn - textIn);
  const cacheRatio =
    totalIn > 0 ? Math.min(1, params.cachedInputTokens / totalIn) : 0;

  const textCached = textIn * cacheRatio;
  const textBillable = textIn - textCached;
  const imageCached = imageIn * cacheRatio;
  const imageBillable = imageIn - imageCached;

  const inputCost =
    (textBillable / 1_000_000) * 5 +
    (textCached / 1_000_000) * 1.25 +
    (imageBillable / 1_000_000) * 8 +
    (imageCached / 1_000_000) * 2;

  const outputCost = (params.outputTokens / 1_000_000) * 30;
  const appliedBatchDiscount = params.mode === 'batch' && params.supportsBatch;
  const discountMultiplier = appliedBatchDiscount ? 0.5 : 1;

  return {
    costUsd: Number(((inputCost + outputCost) * discountMultiplier).toFixed(5)),
    assumedOutputTokens: params.outputTokens,
    resolutionLabel: params.resolutionLabel,
    appliedBatchDiscount,
  };
}

const SIMULATED_MODELS: SimulatedModelSpec[] = [
  {
    id: 'gemini-3.1-flash-lite-image',
    provider: 'Google',
    label: 'gemini-3.1-flash-lite-image',
    tier: 'Lite',
    note: 'Nano Banana 2 Lite',
    supportsBatch: true,
    standardLatencyLabel: '~3–10 sec (sincrono)',
    batchLatencyLabel: 'Fino a 24h (SLO ufficiale)',
    estimateCostUsd: ({ inputTokens, cachedInputTokens, resolution, mode }) =>
      estimateGeminiCost({
        inputTokens,
        cachedInputTokens,
        inputPerMillion: 0.25,
        cachedInputPerMillion: 0.025,
        imageOutputPerMillion: 30,
        outputTokens1K: 1120,
        outputTokens2K: null,
        resolution,
        mode,
      }),
  },
  {
    id: 'gemini-nano-banana-2.1',
    provider: 'Google',
    label: 'gemini-nano-banana-2.1',
    tier: 'Balanced',
    note: 'Ottimo qualità/costo (no Flex)',
    supportsBatch: true,
    standardLatencyLabel: '~5–15 sec (sincrono)',
    batchLatencyLabel: 'Fino a 24h (SLO ufficiale)',
    estimateCostUsd: ({ inputTokens, cachedInputTokens, resolution, mode }) =>
      estimateGeminiCost({
        inputTokens,
        cachedInputTokens,
        inputPerMillion: 1.5,
        cachedInputPerMillion: 0.15,
        imageOutputPerMillion: 30,
        outputTokens1K: 1120,
        outputTokens2K: 1680,
        resolution,
        mode,
      }),
  },
  {
    id: 'gemini-3.1-flash-image',
    provider: 'Google',
    label: 'gemini-3.1-flash-image',
    tier: 'Mid',
    note: 'Nano Banana 2',
    supportsBatch: true,
    standardLatencyLabel: '~5–15 sec (sincrono)',
    batchLatencyLabel: 'Fino a 24h (SLO ufficiale)',
    estimateCostUsd: ({ inputTokens, cachedInputTokens, resolution, mode }) =>
      estimateGeminiCost({
        inputTokens,
        cachedInputTokens,
        inputPerMillion: 0.5,
        cachedInputPerMillion: 0.05,
        imageOutputPerMillion: 60,
        outputTokens1K: 1120,
        outputTokens2K: 1680,
        resolution,
        mode,
      }),
  },
  {
    id: 'gemini-3-pro-image',
    provider: 'Google',
    label: 'gemini-3-pro-image',
    tier: 'Flagship',
    note: 'Nano Banana Pro (1K/2K uguale)',
    supportsBatch: true,
    standardLatencyLabel: '~10–20 sec (sincrono)',
    batchLatencyLabel: 'Fino a 24h (SLO ufficiale)',
    estimateCostUsd: ({ inputTokens, cachedInputTokens, resolution, mode }) =>
      estimateGeminiCost({
        inputTokens,
        cachedInputTokens,
        inputPerMillion: 2,
        cachedInputPerMillion: 0.2,
        imageOutputPerMillion: 120,
        outputTokens1K: 1120,
        outputTokens2K: 1120,
        resolution,
        mode,
      }),
  },
  {
    id: 'gpt-image-1-mini',
    provider: 'OpenAI',
    label: 'gpt-image-1-mini',
    tier: 'Lite',
    note: '1024×1536 standard',
    supportsBatch: true,
    standardLatencyLabel: '~10–20 sec (sincrono)',
    batchLatencyLabel: 'Entro 24h (SLA ufficiale)',
    estimateCostUsd: ({ inputTokens, cachedInputTokens, mode }) =>
      estimateOpenAiCost({
        inputTokens,
        cachedInputTokens,
        outputTokens: 350,
        resolutionLabel: '1024×1536',
        supportsBatch: true,
        mode,
      }),
  },
  {
    id: 'gpt-image-1',
    provider: 'OpenAI',
    label: 'gpt-image-1 (medium)',
    tier: 'Mid',
    note: '1024×1536 quality medium',
    supportsBatch: true,
    standardLatencyLabel: '~15–35 sec (sincrono)',
    batchLatencyLabel: 'Entro 24h (SLA ufficiale)',
    estimateCostUsd: ({ inputTokens, cachedInputTokens, mode }) =>
      estimateOpenAiCost({
        inputTokens,
        cachedInputTokens,
        outputTokens: 1500,
        resolutionLabel: '1024×1536',
        supportsBatch: true,
        mode,
      }),
  },
  {
    id: 'gpt-image-2.6-sunburst',
    provider: 'OpenAI',
    label: 'gpt-image-2.6-sunburst / flare',
    tier: 'Balanced',
    note: '1024×1536 low effort',
    supportsBatch: false,
    standardLatencyLabel: '~15–40 sec (sincrono)',
    batchLatencyLabel: 'Batch non supportato (solo Std)',
    estimateCostUsd: ({ inputTokens, cachedInputTokens, mode }) =>
      estimateOpenAiCost({
        inputTokens,
        cachedInputTokens,
        outputTokens: 1333,
        resolutionLabel: '1024×1536',
        supportsBatch: false,
        mode,
      }),
  },
];

export function TempModelCostEstimatorPanel({
  telemetry,
}: TempModelCostEstimatorPanelProps) {
  const [resolution, setResolution] = useState<TargetResolution>('1K');
  const [apiMode, setApiMode] = useState<ApiExecutionMode>('standard');

  if (telemetry.model !== 'gemini-4-hydrogen') {
    return null;
  }

  return (
    <section
      aria-label="Stima comparativa temporanea su altri modelli"
      className="rounded-2xl border border-dashed border-zinc-300 bg-[#FBFBF9] p-5 sm:p-6 space-y-4"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
              Stima temporanea
            </span>
            <p className="text-xs font-medium text-zinc-600">
              Proiezione sui{' '}
              <span className="font-mono-num text-zinc-900">
                {telemetry.inputTokens}
              </span>{' '}
              token input reali di questa richiesta
              {telemetry.cachedInputTokens > 0
                ? ` (${telemetry.cachedInputTokens} in cache)`
                : ''}
            </p>
          </div>
          <h4 className="text-base font-semibold text-zinc-900">
            Confronto costi e tempi stimati sui modelli immagine a pagamento
          </h4>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto shrink-0">
          <div
            role="group"
            aria-label="Modalità API Standard o Batch"
            className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5"
          >
            <button
              type="button"
              onClick={() => setApiMode('standard')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                apiMode === 'standard'
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Standard API
            </button>
            <button
              type="button"
              onClick={() => setApiMode('batch')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                apiMode === 'batch'
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Batch API (-50%)
            </button>
          </div>

          <div
            role="group"
            aria-label="Risoluzione target Gemini"
            className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5"
          >
            {(['1K', '2K'] as const).map((res) => (
              <button
                key={res}
                type="button"
                onClick={() => setResolution(res)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  resolution === res
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Gemini {res}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#FBFBF9] text-zinc-600 border-b border-zinc-200">
            <tr>
              <th className="py-2.5 px-4 font-medium">Modello</th>
              <th className="py-2.5 px-3 font-medium">Fascia</th>
              <th className="py-2.5 px-3 font-medium">Taglio / Output</th>
              <th className="py-2.5 px-3 font-medium">Tempo medio / SLA</th>
              <th className="py-2.5 px-3 font-medium">Stima 1 pagina</th>
              <th className="py-2.5 px-4 font-medium text-right">
                Stima libro (16 pag.)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {SIMULATED_MODELS.map((spec) => {
              const estimate = spec.estimateCostUsd({
                inputTokens: telemetry.inputTokens,
                cachedInputTokens: telemetry.cachedInputTokens,
                resolution,
                mode: apiMode,
              });
              const bookCost = estimate.costUsd * 16;
              const turnaroundText =
                apiMode === 'batch'
                  ? spec.batchLatencyLabel
                  : spec.standardLatencyLabel;
              const batchUnavailable = apiMode === 'batch' && !spec.supportsBatch;

              return (
                <tr key={spec.id} className="hover:bg-[#FBFBF9]/70">
                  <td className="py-2.5 px-4">
                    <div className="font-mono-num font-medium text-zinc-900">
                      {spec.label}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {spec.provider} · {spec.note}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-zinc-700 whitespace-nowrap">
                    {spec.tier}
                  </td>
                  <td className="py-2.5 px-3 font-mono-num text-zinc-600 whitespace-nowrap">
                    {estimate.resolutionLabel} · {estimate.assumedOutputTokens} tok
                  </td>
                  <td
                    className={`py-2.5 px-3 whitespace-nowrap ${
                      batchUnavailable ? 'text-amber-800 font-medium' : 'text-zinc-700'
                    }`}
                  >
                    {turnaroundText}
                  </td>
                  <td className="py-2.5 px-3 font-mono-num font-semibold text-zinc-900 whitespace-nowrap">
                    ${estimate.costUsd.toFixed(4)}
                    {estimate.appliedBatchDiscount && (
                      <span className="ml-1.5 text-[10px] font-medium text-emerald-700">
                        (-50%)
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 font-mono-num font-semibold text-zinc-900 text-right whitespace-nowrap">
                    ${bookCost.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-zinc-500 leading-relaxed">
        Nota: i token SVG di output ({telemetry.textOutputTokens}) di{' '}
        <span className="font-mono-num">gemini-4-hydrogen</span> non sono sommati perché i modelli raster fatturano token immagine fissi per risoluzione. La Batch API ufficiale Google/OpenAI applica uno sconto del 50% con completamento asincrono entro 24 ore (non supportata su{' '}
        <span className="font-mono-num">gpt-image-2.6</span>; per la consegna MVP in 15–30 min serve la modalità Standard).
      </p>
    </section>
  );
}
