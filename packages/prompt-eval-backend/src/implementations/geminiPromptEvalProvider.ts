import {
  GoogleGenAI,
  JobState,
  Type,
  type BatchJob,
  type GenerateContentResponse,
  type InlinedRequest,
} from '@google/genai';
import {
  computePromptEvalUsage,
  type PromptEvalModelInfo,
  type PromptEvalProviderInfo,
  type PromptExecutionMode,
} from '../../../prompt-eval-core/src/index.ts';
import {
  PromptEvalError,
  type PromptExecutionProvider,
  type ProviderBatchPollResult,
  type ProviderBatchSubmitRequest,
  type ProviderBatchSubmitResult,
  type ProviderItemResult,
  type ProviderStandardItemRequest,
} from '../promptEval.interface.ts';

const INLINE_BATCH_MAX_BYTES = 14 * 1024 * 1024;

const GEMINI_IMAGE_RASTER_MODELS = new Set([
  'gemini-3.1-flash-lite-image',
  'gemini-nano-banana-2.1',
  'gemini-3.1-flash-image',
  'gemini-3-pro-image',
]);

function isGeminiRasterModel(modelId: string): boolean {
  if (GEMINI_IMAGE_RASTER_MODELS.has(modelId)) return true;
  const lower = modelId.toLowerCase();
  return lower.includes('image') || lower.includes('nano-banana');
}

const DEFAULT_GEMINI_MODELS: PromptEvalModelInfo[] = [
  {
    id: 'gemini-nano-banana-2.1',
    label: 'gemini-nano-banana-2.1 (Balanced Raster)',
    modality: 'image',
    outputFormat: 'raster',
    supportsStandard: true,
    supportsBatch: true,
    batchDiscountRatio: 0.5,
    estimatedStandardCostPerItemUsd: 0.036,
    estimatedBatchCostPerItemUsd: 0.018,
    isFreeTier: false,
    standardTurnaroundLabel: '~5–15 sec',
    batchTurnaroundLabel: 'Fino a 24h (-50%)',
    notes: 'Ottimo equilibrio qualità/costo su immagini 1K',
  },
  {
    id: 'gemini-3.1-flash-lite-image',
    label: 'gemini-3.1-flash-lite-image (Lite Raster)',
    modality: 'image',
    outputFormat: 'raster',
    supportsStandard: true,
    supportsBatch: true,
    batchDiscountRatio: 0.5,
    estimatedStandardCostPerItemUsd: 0.034,
    estimatedBatchCostPerItemUsd: 0.017,
    isFreeTier: false,
    standardTurnaroundLabel: '~3–10 sec',
    batchTurnaroundLabel: 'Fino a 24h (-50%)',
    notes: 'Modello raster più economico',
  },
  {
    id: 'gemini-3.1-flash-image',
    label: 'gemini-3.1-flash-image (Mid Raster)',
    modality: 'image',
    outputFormat: 'raster',
    supportsStandard: true,
    supportsBatch: true,
    batchDiscountRatio: 0.5,
    estimatedStandardCostPerItemUsd: 0.068,
    estimatedBatchCostPerItemUsd: 0.034,
    isFreeTier: false,
    standardTurnaroundLabel: '~5–15 sec',
    batchTurnaroundLabel: 'Fino a 24h (-50%)',
    notes: 'Dettaglio medio-alto',
  },
  {
    id: 'gemini-3-pro-image',
    label: 'gemini-3-pro-image (Flagship Raster)',
    modality: 'image',
    outputFormat: 'raster',
    supportsStandard: true,
    supportsBatch: true,
    batchDiscountRatio: 0.5,
    estimatedStandardCostPerItemUsd: 0.137,
    estimatedBatchCostPerItemUsd: 0.069,
    isFreeTier: false,
    standardTurnaroundLabel: '~10–20 sec',
    batchTurnaroundLabel: 'Fino a 24h (-50%)',
    notes: 'Massima fedeltà su scene complesse',
  },
  {
    id: 'gemini-4-hydrogen',
    label: 'gemini-4-hydrogen (Free Tier SVG / Testo)',
    modality: 'image',
    outputFormat: 'svg',
    supportsStandard: true,
    supportsBatch: true,
    batchDiscountRatio: 0.5,
    estimatedStandardCostPerItemUsd: 0,
    estimatedBatchCostPerItemUsd: 0,
    isFreeTier: true,
    standardTurnaroundLabel: '~4–12 sec',
    batchTurnaroundLabel: 'Fino a 24h (Free Tier)',
    notes: 'Piano gratuito per test rapidi SVG',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'gemini-3.1-flash-lite (Free Tier Testo)',
    modality: 'text',
    outputFormat: 'text',
    supportsStandard: true,
    supportsBatch: true,
    batchDiscountRatio: 0.5,
    estimatedStandardCostPerItemUsd: 0,
    estimatedBatchCostPerItemUsd: 0,
    isFreeTier: true,
    standardTurnaroundLabel: '~1–3 sec',
    batchTurnaroundLabel: 'Fino a 24h (Free Tier)',
    notes: 'Test prompt puramente testuali (piano gratuito)',
  },
];

interface RawGeminiUsageMetadata {
  promptTokenCount?: number;
  prompt_token_count?: number;
  cachedContentTokenCount?: number;
  cached_content_token_count?: number;
  candidatesTokenCount?: number;
  candidates_token_count?: number;
  thoughtsTokenCount?: number;
  thoughts_token_count?: number;
  candidatesTokensDetails?: Array<{
    modality?: string;
    tokenCount?: number;
    token_count?: number;
  }>;
  candidates_tokens_details?: Array<{
    modality?: string;
    tokenCount?: number;
    token_count?: number;
  }>;
}

export interface GeminiClientLike {
  models: {
    generateContent: GoogleGenAI['models']['generateContent'];
  };
  batches: {
    create: GoogleGenAI['batches']['create'];
    get: GoogleGenAI['batches']['get'];
    cancel: GoogleGenAI['batches']['cancel'];
  };
  files: {
    upload: GoogleGenAI['files']['upload'];
  };
}

function sanitizeSvgMarkup(rawSvg: string): string {
  let svg = rawSvg.trim();
  const svgStart = svg.indexOf('<svg');
  const svgEnd = svg.lastIndexOf('</svg>');
  if (svgStart === -1 || svgEnd === -1) {
    throw new PromptEvalError(
      'Il modello non ha restituito un markup SVG valido.',
      502,
      'invalid_svg'
    );
  }
  svg = svg.slice(svgStart, svgEnd + 6);
  svg = svg.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  svg = svg.replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '');
  if (!svg.includes('xmlns=')) {
    svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return svg;
}

function extractGeminiTokenCounts(
  metadata: RawGeminiUsageMetadata | undefined,
  outputFormat: 'raster' | 'svg' | 'text'
) {
  const inputTokens =
    metadata?.promptTokenCount ?? metadata?.prompt_token_count ?? 0;
  const cachedInputTokens =
    metadata?.cachedContentTokenCount ??
    metadata?.cached_content_token_count ??
    0;
  const thoughtsTokens =
    metadata?.thoughtsTokenCount ?? metadata?.thoughts_token_count ?? 0;
  const candidatesTokens =
    metadata?.candidatesTokenCount ?? metadata?.candidates_token_count ?? 0;

  if (outputFormat !== 'raster') {
    const textOutputTokens = candidatesTokens + thoughtsTokens;
    return {
      inputTokens,
      cachedInputTokens,
      textOutputTokens,
      imageOutputTokens: 0,
    };
  }

  const details =
    metadata?.candidatesTokensDetails ??
    metadata?.candidates_tokens_details ??
    [];
  let imageFromDetails = 0;
  let textFromDetails = 0;
  for (const item of details) {
    const count = item.tokenCount ?? item.token_count ?? 0;
    if (String(item.modality ?? '').toUpperCase() === 'IMAGE') {
      imageFromDetails += count;
    } else {
      textFromDetails += count;
    }
  }

  const imageOutputTokens =
    imageFromDetails > 0 ? imageFromDetails : candidatesTokens;
  const textOutputTokens =
    thoughtsTokens + (imageFromDetails > 0 ? textFromDetails : 0);

  return {
    inputTokens,
    cachedInputTokens,
    textOutputTokens,
    imageOutputTokens,
  };
}

function extractTextFromGenerateContentResponse(
  response: GenerateContentResponse | Record<string, unknown>
): string {
  const maybeResponse = response as {
    text?: string;
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };
  if (typeof maybeResponse.text === 'string' && maybeResponse.text.length > 0) {
    return maybeResponse.text;
  }
  const parts = maybeResponse.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('');
}

function parseGenerateContentResult(params: {
  itemId: string;
  index: number;
  model: string;
  executionMode: PromptExecutionMode;
  outputFormat: 'raster' | 'svg' | 'text';
  response: GenerateContentResponse | Record<string, unknown>;
  latencyMs?: number;
}): ProviderItemResult {
  const resp = params.response as {
    candidates?: Array<{
      finishReason?: string;
      finish_reason?: string;
      content?: {
        parts?: Array<{
          text?: string;
          inlineData?: { data?: string; mimeType?: string };
          inline_data?: { data?: string; mime_type?: string };
        }>;
      };
    }>;
    promptFeedback?: { blockReason?: string };
    prompt_feedback?: { block_reason?: string };
    usageMetadata?: RawGeminiUsageMetadata;
    usage_metadata?: RawGeminiUsageMetadata;
  };

  const counts = extractGeminiTokenCounts(
    resp.usageMetadata ?? resp.usage_metadata,
    params.outputFormat
  );
  const usage = computePromptEvalUsage({
    model: params.model,
    executionMode: params.executionMode,
    ...counts,
  });

  if (params.outputFormat === 'raster') {
    for (const part of resp.candidates?.[0]?.content?.parts ?? []) {
      const inline = part.inlineData ?? part.inline_data;
      if (inline?.data) {
        const mime =
          ('mimeType' in inline ? inline.mimeType : undefined) ??
          ('mime_type' in inline ? inline.mime_type : undefined) ??
          'image/png';
        return {
          itemId: params.itemId,
          index: params.index,
          status: 'completed',
          outputFormat: 'raster',
          outputImageDataUrl: `data:${mime};base64,${inline.data}`,
          latencyMs: params.latencyMs,
          usage,
        };
      }
    }
    const finishReason =
      resp.candidates?.[0]?.finishReason ??
      resp.candidates?.[0]?.finish_reason ??
      'UNKNOWN';
    const blockReason =
      resp.promptFeedback?.blockReason ??
      resp.prompt_feedback?.block_reason ??
      'NONE';
    return {
      itemId: params.itemId,
      index: params.index,
      status: 'failed',
      outputFormat: 'raster',
      errorMessage: `Nessuna immagine restituita (finishReason=${finishReason}, blockReason=${blockReason}).`,
      latencyMs: params.latencyMs,
      usage,
    };
  }

  if (params.outputFormat === 'svg') {
    const rawText = extractTextFromGenerateContentResponse(params.response).trim();
    if (!rawText) {
      return {
        itemId: params.itemId,
        index: params.index,
        status: 'failed',
        outputFormat: 'svg',
        errorMessage: 'Risposta SVG vuota dal modello Gemini.',
        latencyMs: params.latencyMs,
        usage,
      };
    }

    try {
      const unfenced = rawText
        .replace(/^```(?:json|svg|xml)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      let sceneSummary: string | undefined;
      let svgSource = unfenced;
      if (!unfenced.startsWith('<svg')) {
        try {
          const parsed = JSON.parse(unfenced) as {
            sceneSummary?: string;
            svgMarkup?: string;
          };
          sceneSummary = parsed.sceneSummary?.trim();
          svgSource = parsed.svgMarkup ?? unfenced;
        } catch {
          // Fall back to direct <svg>...</svg> extraction if the model returned raw SVG markup
          svgSource = unfenced;
        }
      }

      const cleanSvg = sanitizeSvgMarkup(svgSource);
      const svgBase64 = Buffer.from(cleanSvg, 'utf8').toString('base64');
      return {
        itemId: params.itemId,
        index: params.index,
        status: 'completed',
        outputFormat: 'svg',
        outputImageDataUrl: `data:image/svg+xml;base64,${svgBase64}`,
        outputText: sceneSummary,
        latencyMs: params.latencyMs,
        usage,
      };
    } catch (err) {
      return {
        itemId: params.itemId,
        index: params.index,
        status: 'failed',
        outputFormat: 'svg',
        errorMessage:
          err instanceof Error
            ? `Output SVG non valido: ${err.message}`
            : 'Output SVG non valido.',
        latencyMs: params.latencyMs,
        usage,
      };
    }
  }

  const textOutput = extractTextFromGenerateContentResponse(
    params.response
  ).trim();
  if (!textOutput) {
    return {
      itemId: params.itemId,
      index: params.index,
      status: 'failed',
      outputFormat: 'text',
      errorMessage: 'Risposta testuale vuota dal modello Gemini.',
      latencyMs: params.latencyMs,
      usage,
    };
  }
  return {
    itemId: params.itemId,
    index: params.index,
    status: 'completed',
    outputFormat: 'text',
    outputText: textOutput,
    latencyMs: params.latencyMs,
    usage,
  };
}

function buildSvgResponseSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      sceneSummary: {
        type: Type.STRING,
        description: 'Breve descrizione della scena creata.',
      },
      svgMarkup: {
        type: Type.STRING,
        description: 'Codice SVG completo (<svg ...>...</svg>).',
      },
    },
    required: ['sceneSummary', 'svgMarkup'],
  };
}

export interface GeminiPromptEvalProviderOptions {
  apiKey: string;
  defaultModel?: string;
  models?: PromptEvalModelInfo[];
  clientFactory?: (apiKey: string) => GeminiClientLike;
  fetchImpl?: typeof fetch;
}

export class GeminiPromptEvalProvider implements PromptExecutionProvider {
  readonly id = 'gemini';
  readonly label = 'Google Gemini';

  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly models: PromptEvalModelInfo[];
  private readonly clientFactory: (apiKey: string) => GeminiClientLike;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GeminiPromptEvalProviderOptions) {
    this.apiKey = options.apiKey.trim();
    this.defaultModel =
      options.defaultModel?.trim() || 'gemini-nano-banana-2.1';
    const baseModels = options.models ?? [...DEFAULT_GEMINI_MODELS];
    if (!baseModels.some((m) => m.id === this.defaultModel)) {
      const isRaster = isGeminiRasterModel(this.defaultModel);
      baseModels.unshift({
        id: this.defaultModel,
        label: `${this.defaultModel} (Configurato)`,
        modality: 'image',
        outputFormat: isRaster ? 'raster' : 'svg',
        supportsStandard: true,
        supportsBatch: true,
        batchDiscountRatio: 0.5,
        estimatedStandardCostPerItemUsd: 0,
        estimatedBatchCostPerItemUsd: 0,
        isFreeTier: !isRaster,
        standardTurnaroundLabel: '~5–15 sec',
        batchTurnaroundLabel: 'Fino a 24h (-50%)',
      });
    }
    this.models = baseModels;
    this.clientFactory =
      options.clientFactory ??
      ((apiKey) =>
        new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        }));
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  getInfo(isDefault: boolean): PromptEvalProviderInfo {
    return {
      id: this.id,
      label: this.label,
      configured: this.isConfigured(),
      isDefault,
      supportedModalities: ['image', 'text'],
      supportsBatch: true,
      defaultModel: this.defaultModel,
      models: this.models,
    };
  }

  getModelInfo(modelId: string): PromptEvalModelInfo | undefined {
    return this.models.find((m) => m.id === modelId);
  }

  private resolveOutputFormat(
    model: string,
    modality: 'image' | 'text',
    outputFormatHint?: 'raster' | 'svg' | 'text'
  ): 'raster' | 'svg' | 'text' {
    if (modality === 'text') return 'text';
    if (isGeminiRasterModel(model)) return 'raster';
    if (outputFormatHint === 'raster') {
      return isGeminiRasterModel(model) ? 'raster' : 'svg';
    }
    return this.getModelInfo(model)?.outputFormat ?? 'svg';
  }

  private getClient(): GeminiClientLike {
    if (!this.isConfigured()) {
      throw new PromptEvalError(
        'GEMINI_API_KEY non configurata sul server.',
        503,
        'provider_not_configured'
      );
    }
    return this.clientFactory(this.apiKey);
  }

  async executeStandardItem(
    request: ProviderStandardItemRequest
  ): Promise<ProviderItemResult> {
    const ai = this.getClient();
    const outputFormat = this.resolveOutputFormat(
      request.model,
      request.modality,
      request.outputFormatHint
    );
    const itemId = request.image?.id ?? request.textInput?.id ?? 'item-0';
    const index = request.image?.index ?? request.textInput?.index ?? 0;

    const parts: Array<
      { inlineData: { data: string; mimeType: string } } | { text: string }
    > = [];
    if (request.modality === 'image' && request.image) {
      parts.push({
        inlineData: {
          data: Buffer.from(request.image.bytes).toString('base64'),
          mimeType: request.image.mimeType,
        },
      });
      parts.push({ text: request.promptText });
    } else if (request.textInput) {
      parts.push({
        text: `${request.promptText}\n\n--- INPUT ---\n${request.textInput.text}`,
      });
    } else {
      parts.push({ text: request.promptText });
    }

    const config =
      outputFormat === 'raster'
        ? {
            imageConfig: {
              aspectRatio: '3:4',
            },
          }
        : outputFormat === 'svg'
          ? {
              responseMimeType: 'application/json',
              responseSchema: buildSvgResponseSchema(),
            }
          : undefined;

    const startedAt = Date.now();
    try {
      const response = await ai.models.generateContent({
        model: request.model,
        contents: { parts },
        ...(config ? { config } : {}),
      });
      const latencyMs = Math.max(0, Date.now() - startedAt);
      return parseGenerateContentResult({
        itemId,
        index,
        model: request.model,
        executionMode: 'standard',
        outputFormat,
        response,
        latencyMs,
      });
    } catch (error) {
      const latencyMs = Math.max(0, Date.now() - startedAt);
      const message =
        error instanceof Error ? error.message : String(error);
      return {
        itemId,
        index,
        status: 'failed',
        outputFormat,
        errorMessage: message.slice(0, 400),
        latencyMs,
      };
    }
  }

  async submitBatchJob(
    request: ProviderBatchSubmitRequest
  ): Promise<ProviderBatchSubmitResult> {
    const ai = this.getClient();
    const outputFormat = this.resolveOutputFormat(
      request.model,
      request.modality,
      request.outputFormatHint
    );

    const inlinedRequests: InlinedRequest[] = [];
    const jsonlLines: string[] = [];

    if (request.modality === 'image') {
      const images = request.images ?? [];
      for (const img of images) {
        const base64Data = Buffer.from(img.bytes).toString('base64');
        const config =
          outputFormat === 'raster'
            ? { imageConfig: { aspectRatio: '3:4' } }
            : {
                responseMimeType: 'application/json',
                responseSchema: buildSvgResponseSchema(),
              };

        inlinedRequests.push({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    data: base64Data,
                    mimeType: img.mimeType,
                  },
                },
                { text: request.promptText },
              ],
            },
          ],
          metadata: {
            itemId: img.id,
            index: String(img.index),
          },
          config,
        });

        jsonlLines.push(
          JSON.stringify({
            key: img.id,
            request: {
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      inlineData: {
                        mimeType: img.mimeType,
                        data: base64Data,
                      },
                    },
                    { text: request.promptText },
                  ],
                },
              ],
              generationConfig:
                outputFormat === 'raster'
                  ? { imageConfig: { aspectRatio: '3:4' } }
                  : {
                      responseMimeType: 'application/json',
                      responseSchema: buildSvgResponseSchema(),
                    },
            },
          })
        );
      }
    } else {
      const texts = request.textInputs ?? [];
      for (const item of texts) {
        const combinedText = `${request.promptText}\n\n--- INPUT ---\n${item.text}`;
        inlinedRequests.push({
          contents: [
            {
              role: 'user',
              parts: [{ text: combinedText }],
            },
          ],
          metadata: {
            itemId: item.id,
            index: String(item.index),
          },
        });
        jsonlLines.push(
          JSON.stringify({
            key: item.id,
            request: {
              contents: [
                {
                  role: 'user',
                  parts: [{ text: combinedText }],
                },
              ],
            },
          })
        );
      }
    }

    if (inlinedRequests.length === 0) {
      throw new PromptEvalError(
        'Almeno un elemento è richiesto per avviare un job batch.',
        400,
        'empty_batch'
      );
    }

    const estimatedInlineBytes = Buffer.byteLength(
      JSON.stringify(inlinedRequests),
      'utf8'
    );

    try {
      let batchJob: BatchJob;
      if (estimatedInlineBytes <= INLINE_BATCH_MAX_BYTES) {
        batchJob = await ai.batches.create({
          model: request.model,
          src: inlinedRequests,
          config: {
            displayName: request.displayName.slice(0, 120),
          },
        });
      } else {
        const jsonlContent = jsonlLines.join('\n');
        const uploaded = await ai.files.upload({
          file: new Blob([jsonlContent], { type: 'application/jsonl' }),
          config: {
            mimeType: 'application/jsonl',
            displayName: `${request.runId}.jsonl`,
          },
        });
        if (!uploaded.name) {
          throw new PromptEvalError(
            'Upload del file JSONL su Gemini Files API non riuscito.',
            502,
            'batch_upload_failed'
          );
        }
        batchJob = await ai.batches.create({
          model: request.model,
          src: { fileName: uploaded.name },
          config: {
            displayName: request.displayName.slice(0, 120),
          },
        });
      }

      if (!batchJob.name) {
        throw new PromptEvalError(
          'Gemini Batch API non ha restituito un identificativo job valido.',
          502,
          'batch_missing_name'
        );
      }

      return {
        externalBatchJobId: batchJob.name,
        externalBatchState: String(batchJob.state ?? JobState.JOB_STATE_PENDING),
      };
    } catch (error) {
      if (error instanceof PromptEvalError) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      throw new PromptEvalError(
        'Impossibile creare il job su Gemini Batch API.',
        502,
        'batch_submit_failed',
        msg
      );
    }
  }

  private async downloadGeminiFileText(fileName: string): Promise<string> {
    const normalized = fileName.startsWith('files/')
      ? fileName
      : `files/${fileName}`;
    const url = `https://generativelanguage.googleapis.com/download/v1beta/${normalized}:download?alt=media`;
    const response = await this.fetchImpl(url, {
      method: 'GET',
      headers: {
        'x-goog-api-key': this.apiKey,
      },
    });
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new PromptEvalError(
        `Impossibile scaricare il file risultati batch Gemini (HTTP ${response.status}).`,
        502,
        'batch_download_failed',
        errBody.slice(0, 500)
      );
    }
    return response.text();
  }

  async pollBatchJob(params: {
    externalBatchJobId: string;
    model: string;
    modality: 'image' | 'text';
    outputFormatHint?: 'raster' | 'svg' | 'text';
    expectedItemIds: string[];
  }): Promise<ProviderBatchPollResult> {
    const ai = this.getClient();
    const outputFormat = this.resolveOutputFormat(
      params.model,
      params.modality,
      params.outputFormatHint
    );

    let job: BatchJob;
    try {
      job = await ai.batches.get({ name: params.externalBatchJobId });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new PromptEvalError(
        'Impossibile verificare lo stato del job Gemini Batch.',
        502,
        'batch_poll_failed',
        msg
      );
    }

    const rawState = String(job.state ?? JobState.JOB_STATE_UNSPECIFIED);

    if (
      rawState === JobState.JOB_STATE_QUEUED ||
      rawState === JobState.JOB_STATE_PENDING ||
      rawState === JobState.JOB_STATE_UNSPECIFIED
    ) {
      return {
        status: 'queued',
        externalBatchState: rawState,
      };
    }

    if (
      rawState === JobState.JOB_STATE_RUNNING ||
      rawState === JobState.JOB_STATE_UPDATING ||
      rawState === JobState.JOB_STATE_PAUSED
    ) {
      return {
        status: 'running',
        externalBatchState: rawState,
      };
    }

    if (
      rawState === JobState.JOB_STATE_CANCELLED ||
      rawState === JobState.JOB_STATE_CANCELLING
    ) {
      return {
        status: 'cancelled',
        externalBatchState: rawState,
        errorMessage: job.error?.message ?? 'Job batch annullato.',
      };
    }

    if (
      rawState === JobState.JOB_STATE_FAILED ||
      rawState === JobState.JOB_STATE_EXPIRED
    ) {
      return {
        status: 'failed',
        externalBatchState: rawState,
        errorMessage:
          job.error?.message ?? `Job batch terminato con stato ${rawState}.`,
      };
    }

    if (
      rawState !== JobState.JOB_STATE_SUCCEEDED &&
      rawState !== JobState.JOB_STATE_PARTIALLY_SUCCEEDED
    ) {
      return {
        status: 'running',
        externalBatchState: rawState,
      };
    }

    // SUCCEEDED or PARTIALLY_SUCCEEDED
    const parsedItems: ProviderItemResult[] = [];
    const expectedIndexById = new Map<string, number>();
    params.expectedItemIds.forEach((id, idx) => expectedIndexById.set(id, idx));

    const inlinedResponses = job.dest?.inlinedResponses;
    if (Array.isArray(inlinedResponses) && inlinedResponses.length > 0) {
      inlinedResponses.forEach((entry, idx) => {
        const metaItemId = entry.metadata?.itemId;
        const itemId =
          metaItemId ?? params.expectedItemIds[idx] ?? `item-${idx}`;
        const itemIndex = expectedIndexById.get(itemId) ?? idx;

        if (entry.error) {
          parsedItems.push({
            itemId,
            index: itemIndex,
            status: 'failed',
            outputFormat,
            errorMessage:
              entry.error.message ??
              `Errore batch Gemini (code=${entry.error.code ?? 'unknown'}).`,
          });
          return;
        }

        if (!entry.response) {
          parsedItems.push({
            itemId,
            index: itemIndex,
            status: 'failed',
            outputFormat,
            errorMessage: 'Risposta mancante nel risultato batch Gemini.',
          });
          return;
        }

        parsedItems.push(
          parseGenerateContentResult({
            itemId,
            index: itemIndex,
            model: params.model,
            executionMode: 'batch',
            outputFormat,
            response: entry.response,
          })
        );
      });
    } else if (job.dest?.fileName) {
      const jsonlText = await this.downloadGeminiFileText(job.dest.fileName);
      const lines = jsonlText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      lines.forEach((line, idx) => {
        try {
          const parsedLine = JSON.parse(line) as {
            key?: string;
            response?: GenerateContentResponse;
            error?: { message?: string; code?: number };
          };
          const itemId =
            parsedLine.key ?? params.expectedItemIds[idx] ?? `item-${idx}`;
          const itemIndex = expectedIndexById.get(itemId) ?? idx;

          if (parsedLine.error) {
            parsedItems.push({
              itemId,
              index: itemIndex,
              status: 'failed',
              outputFormat,
              errorMessage:
                parsedLine.error.message ?? 'Errore elemento nel file batch.',
            });
            return;
          }

          if (!parsedLine.response) {
            parsedItems.push({
              itemId,
              index: itemIndex,
              status: 'failed',
              outputFormat,
              errorMessage: 'Risposta vuota nel file JSONL batch.',
            });
            return;
          }

          parsedItems.push(
            parseGenerateContentResult({
              itemId,
              index: itemIndex,
              model: params.model,
              executionMode: 'batch',
              outputFormat,
              response: parsedLine.response,
            })
          );
        } catch (parseErr) {
          const itemId = params.expectedItemIds[idx] ?? `item-${idx}`;
          parsedItems.push({
            itemId,
            index: idx,
            status: 'failed',
            outputFormat,
            errorMessage: `Riga JSONL non interpretabile: ${
              parseErr instanceof Error ? parseErr.message : String(parseErr)
            }`,
          });
        }
      });
    }

    return {
      status: 'completed',
      externalBatchState: rawState,
      items: parsedItems,
    };
  }

  async cancelBatchJob(externalBatchJobId: string): Promise<void> {
    const ai = this.getClient();
    try {
      await ai.batches.cancel({ name: externalBatchJobId });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new PromptEvalError(
        'Impossibile annullare il job Gemini Batch.',
        502,
        'batch_cancel_failed',
        msg
      );
    }
  }
}
