import {
  computePromptEvalUsage,
  type PromptEvalModelInfo,
  type PromptEvalProviderInfo,
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

const DEFAULT_OPENAI_MODELS: PromptEvalModelInfo[] = [
  {
    id: 'gpt-image-1-mini',
    label: 'gpt-image-1-mini (Lite Raster)',
    modality: 'image',
    outputFormat: 'raster',
    supportsStandard: true,
    supportsBatch: true,
    batchDiscountRatio: 0.5,
    estimatedStandardCostPerItemUsd: 0.021,
    estimatedBatchCostPerItemUsd: 0.011,
    isFreeTier: false,
    standardTurnaroundLabel: '~10–20 sec',
    batchTurnaroundLabel: 'Entro 24h (-50%)',
    notes: '1024×1536 economico con supporto Batch',
  },
  {
    id: 'gpt-image-1',
    label: 'gpt-image-1 (Mid Raster)',
    modality: 'image',
    outputFormat: 'raster',
    supportsStandard: true,
    supportsBatch: true,
    batchDiscountRatio: 0.5,
    estimatedStandardCostPerItemUsd: 0.055,
    estimatedBatchCostPerItemUsd: 0.028,
    isFreeTier: false,
    standardTurnaroundLabel: '~15–35 sec',
    batchTurnaroundLabel: 'Entro 24h (-50%)',
    notes: '1024×1536 qualità media con Batch (-50%)',
  },
  {
    id: 'gpt-image-2.6-sunburst',
    label: 'gpt-image-2.6-sunburst (Solo Standard)',
    modality: 'image',
    outputFormat: 'raster',
    supportsStandard: true,
    supportsBatch: false,
    batchDiscountRatio: 1,
    estimatedStandardCostPerItemUsd: 0.06,
    estimatedBatchCostPerItemUsd: 0.06,
    isFreeTier: false,
    standardTurnaroundLabel: '~15–40 sec',
    batchTurnaroundLabel: 'Batch non supportato',
    notes: 'OpenAI non supporta Batch API su 2.6',
  },
  {
    id: 'gpt-image-2.6-flare',
    label: 'gpt-image-2.6-flare (Solo Standard)',
    modality: 'image',
    outputFormat: 'raster',
    supportsStandard: true,
    supportsBatch: false,
    batchDiscountRatio: 1,
    estimatedStandardCostPerItemUsd: 0.06,
    estimatedBatchCostPerItemUsd: 0.06,
    isFreeTier: false,
    standardTurnaroundLabel: '~15–40 sec',
    batchTurnaroundLabel: 'Batch non supportato',
    notes: 'OpenAI non supporta Batch API su 2.6',
  },
  {
    id: 'gpt-4.1-mini',
    label: 'gpt-4.1-mini (Testo)',
    modality: 'text',
    outputFormat: 'text',
    supportsStandard: true,
    supportsBatch: true,
    batchDiscountRatio: 0.5,
    estimatedStandardCostPerItemUsd: 0.001,
    estimatedBatchCostPerItemUsd: 0.0005,
    isFreeTier: false,
    standardTurnaroundLabel: '~1–3 sec',
    batchTurnaroundLabel: 'Entro 24h (-50%)',
    notes: 'Valutazione prompt testuali',
  },
];

export interface OpenAIPromptEvalProviderOptions {
  apiKey: string;
  defaultModel?: string;
  models?: PromptEvalModelInfo[];
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export class OpenAIPromptEvalProvider implements PromptExecutionProvider {
  readonly id = 'openai';
  readonly label = 'OpenAI';

  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly models: PromptEvalModelInfo[];
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(options: OpenAIPromptEvalProviderOptions) {
    this.apiKey = options.apiKey.trim();
    this.defaultModel = options.defaultModel?.trim() || 'gpt-image-1';
    this.models = options.models ?? [...DEFAULT_OPENAI_MODELS];
    if (!this.models.some((m) => m.id === this.defaultModel)) {
      this.models.unshift({
        id: this.defaultModel,
        label: `${this.defaultModel} (Configurato)`,
        modality: 'image',
        outputFormat: 'raster',
        supportsStandard: true,
        supportsBatch: !this.defaultModel.startsWith('gpt-image-2.6'),
        batchDiscountRatio: this.defaultModel.startsWith('gpt-image-2.6')
          ? 1
          : 0.5,
        estimatedStandardCostPerItemUsd: 0.055,
        estimatedBatchCostPerItemUsd: 0.028,
        isFreeTier: false,
        standardTurnaroundLabel: '~15–35 sec',
        batchTurnaroundLabel: 'Entro 24h (-50%)',
      });
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = (options.baseUrl ?? 'https://api.openai.com/v1').replace(
      /\/+$/,
      ''
    );
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

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new PromptEvalError(
        'OPENAI_API_KEY non configurata sul server.',
        503,
        'provider_not_configured'
      );
    }
  }

  async executeStandardItem(
    request: ProviderStandardItemRequest
  ): Promise<ProviderItemResult> {
    this.assertConfigured();
    const itemId = request.image?.id ?? request.textInput?.id ?? 'item-0';
    const index = request.image?.index ?? request.textInput?.index ?? 0;
    const startedAt = Date.now();

    if (request.modality === 'text') {
      const combined = request.textInput
        ? `${request.promptText}\n\n--- INPUT ---\n${request.textInput.text}`
        : request.promptText;
      let response: Response;
      try {
        response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: request.model,
            messages: [{ role: 'user', content: combined }],
          }),
        });
      } catch (err) {
        return {
          itemId,
          index,
          status: 'failed',
          outputFormat: 'text',
          errorMessage:
            err instanceof Error
              ? err.message.slice(0, 300)
              : 'Errore di rete verso OpenAI.',
          latencyMs: Math.max(0, Date.now() - startedAt),
        };
      }
      const latencyMs = Math.max(0, Date.now() - startedAt);
      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        return {
          itemId,
          index,
          status: 'failed',
          outputFormat: 'text',
          errorMessage: `OpenAI HTTP ${response.status}: ${errBody.slice(0, 300)}`,
          latencyMs,
        };
      }
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          prompt_tokens_details?: { cached_tokens?: number };
        };
      };
      const text = data.choices?.[0]?.message?.content?.trim() ?? '';
      const usage = computePromptEvalUsage({
        model: request.model,
        executionMode: 'standard',
        inputTokens: data.usage?.prompt_tokens ?? 0,
        cachedInputTokens: data.usage?.prompt_tokens_details?.cached_tokens ?? 0,
        textOutputTokens: data.usage?.completion_tokens ?? 0,
        imageOutputTokens: 0,
      });
      return text
        ? {
            itemId,
            index,
            status: 'completed',
            outputFormat: 'text',
            outputText: text,
            latencyMs,
            usage,
          }
        : {
            itemId,
            index,
            status: 'failed',
            outputFormat: 'text',
            errorMessage: 'Risposta vuota da OpenAI.',
            latencyMs,
            usage,
          };
    }

    if (!request.image) {
      return {
        itemId,
        index,
        status: 'failed',
        outputFormat: 'raster',
        errorMessage: 'Immagine mancante per la modalità image.',
      };
    }

    const formData = new FormData();
    const ext =
      request.image.mimeType === 'image/png'
        ? 'png'
        : request.image.mimeType === 'image/webp'
          ? 'webp'
          : 'jpg';
    const imageBytes = new Uint8Array(request.image.bytes);
    formData.append(
      'image',
      new Blob([imageBytes], { type: request.image.mimeType }),
      `photo.${ext}`
    );
    formData.append('model', request.model);
    formData.append('prompt', request.promptText);
    formData.append('size', '1024x1536');

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/images/edits`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
      });
    } catch (err) {
      return {
        itemId,
        index,
        status: 'failed',
        outputFormat: 'raster',
        errorMessage:
          err instanceof Error
            ? err.message.slice(0, 300)
            : 'Errore di rete verso OpenAI.',
        latencyMs: Math.max(0, Date.now() - startedAt),
      };
    }
    const latencyMs = Math.max(0, Date.now() - startedAt);

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      return {
        itemId,
        index,
        status: 'failed',
        outputFormat: 'raster',
        errorMessage: `OpenAI HTTP ${response.status}: ${errBody.slice(0, 300)}`,
        latencyMs,
      };
    }

    const payload = (await response.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        input_tokens_details?: { cached_tokens?: number };
        output_tokens_details?: { image_tokens?: number; text_tokens?: number };
      };
    };

    const imageOutputTokens =
      payload.usage?.output_tokens_details?.image_tokens ??
      payload.usage?.output_tokens ??
      0;
    const textOutputTokens =
      payload.usage?.output_tokens_details?.text_tokens ??
      Math.max(0, (payload.usage?.output_tokens ?? 0) - imageOutputTokens);

    const usage = computePromptEvalUsage({
      model: request.model,
      executionMode: 'standard',
      inputTokens: payload.usage?.input_tokens ?? 0,
      cachedInputTokens: payload.usage?.input_tokens_details?.cached_tokens ?? 0,
      textOutputTokens,
      imageOutputTokens,
    });

    const first = payload.data?.[0];
    if (first?.b64_json) {
      return {
        itemId,
        index,
        status: 'completed',
        outputFormat: 'raster',
        outputImageDataUrl: `data:image/png;base64,${first.b64_json}`,
        latencyMs,
        usage,
      };
    }
    if (first?.url) {
      let persistedUrl = first.url;
      try {
        const imgResp = await this.fetchImpl(first.url, { method: 'GET' });
        if (imgResp.ok) {
          const contentType =
            imgResp.headers.get('content-type')?.split(';')[0]?.trim() ||
            'image/png';
          const bytes = Buffer.from(await imgResp.arrayBuffer());
          persistedUrl = `data:${contentType};base64,${bytes.toString('base64')}`;
        }
      } catch {
        // Fall back to returned URL if fetching bytes fails
      }
      return {
        itemId,
        index,
        status: 'completed',
        outputFormat: 'raster',
        outputImageDataUrl: persistedUrl,
        latencyMs,
        usage,
      };
    }

    return {
      itemId,
      index,
      status: 'failed',
      outputFormat: 'raster',
      errorMessage: 'OpenAI non ha restituito alcuna immagine valida.',
      latencyMs,
      usage,
    };
  }

  async submitBatchJob(
    request: ProviderBatchSubmitRequest
  ): Promise<ProviderBatchSubmitResult> {
    this.assertConfigured();
    const modelInfo = this.getModelInfo(request.model);
    if (
      (modelInfo && !modelInfo.supportsBatch) ||
      request.model.startsWith('gpt-image-2.6')
    ) {
      throw new PromptEvalError(
        `Il modello OpenAI "${request.model}" non supporta la Batch API. Seleziona un modello compatibile (es. gpt-image-1 o gpt-image-1-mini) oppure usa l’API Standard.`,
        400,
        'batch_not_supported_for_model'
      );
    }

    const endpoint =
      request.modality === 'image' ? '/v1/responses' : '/v1/chat/completions';
    const lines: string[] = [];

    if (request.modality === 'image') {
      for (const img of request.images ?? []) {
        const dataUrl = `data:${img.mimeType};base64,${Buffer.from(
          img.bytes
        ).toString('base64')}`;
        lines.push(
          JSON.stringify({
            custom_id: img.id,
            method: 'POST',
            url: endpoint,
            body: {
              model: 'gpt-4.1-mini',
              input: [
                {
                  role: 'user',
                  content: [
                    { type: 'input_text', text: request.promptText },
                    { type: 'input_image', image_url: dataUrl },
                  ],
                },
              ],
              tools: [
                {
                  type: 'image_generation',
                  model: request.model,
                  size: '1024x1536',
                  quality: 'medium',
                },
              ],
              tool_choice: { type: 'image_generation' },
            },
          })
        );
      }
    } else {
      for (const item of request.textInputs ?? []) {
        lines.push(
          JSON.stringify({
            custom_id: item.id,
            method: 'POST',
            url: endpoint,
            body: {
              model: request.model,
              messages: [
                {
                  role: 'user',
                  content: `${request.promptText}\n\n--- INPUT ---\n${item.text}`,
                },
              ],
            },
          })
        );
      }
    }

    if (lines.length === 0) {
      throw new PromptEvalError(
        'Almeno un elemento è richiesto per avviare un job batch OpenAI.',
        400,
        'empty_batch'
      );
    }

    const fileForm = new FormData();
    fileForm.append('purpose', 'batch');
    fileForm.append(
      'file',
      new Blob([lines.join('\n')], { type: 'application/jsonl' }),
      `${request.runId}.jsonl`
    );

    const fileResp = await this.fetchImpl(`${this.baseUrl}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: fileForm,
    });
    if (!fileResp.ok) {
      const errBody = await fileResp.text().catch(() => '');
      throw new PromptEvalError(
        `Upload JSONL su OpenAI Batch fallito (HTTP ${fileResp.status}).`,
        502,
        'batch_upload_failed',
        errBody.slice(0, 500)
      );
    }
    const uploaded = (await fileResp.json()) as { id?: string };
    if (!uploaded.id) {
      throw new PromptEvalError(
        'OpenAI Files API non ha restituito un file ID.',
        502,
        'batch_upload_failed'
      );
    }

    const batchResp = await this.fetchImpl(`${this.baseUrl}/batches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input_file_id: uploaded.id,
        endpoint,
        completion_window: '24h',
        metadata: {
          runId: request.runId,
          displayName: request.displayName.slice(0, 120),
        },
      }),
    });
    if (!batchResp.ok) {
      const errBody = await batchResp.text().catch(() => '');
      throw new PromptEvalError(
        `Creazione job OpenAI Batch fallita (HTTP ${batchResp.status}).`,
        502,
        'batch_submit_failed',
        errBody.slice(0, 500)
      );
    }

    const created = (await batchResp.json()) as {
      id?: string;
      status?: string;
    };
    if (!created.id) {
      throw new PromptEvalError(
        'OpenAI Batch API non ha restituito un ID batch valido.',
        502,
        'batch_missing_name'
      );
    }

    return {
      externalBatchJobId: created.id,
      externalBatchState: created.status ?? 'validating',
    };
  }

  async pollBatchJob(params: {
    externalBatchJobId: string;
    model: string;
    modality: 'image' | 'text';
    outputFormatHint?: 'raster' | 'svg' | 'text';
    expectedItemIds: string[];
  }): Promise<ProviderBatchPollResult> {
    this.assertConfigured();
    const resp = await this.fetchImpl(
      `${this.baseUrl}/batches/${encodeURIComponent(params.externalBatchJobId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      }
    );
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      throw new PromptEvalError(
        `Verifica stato OpenAI Batch fallita (HTTP ${resp.status}).`,
        502,
        'batch_poll_failed',
        errBody.slice(0, 500)
      );
    }

    const job = (await resp.json()) as {
      status?: string;
      output_file_id?: string | null;
      error_file_id?: string | null;
    };
    const rawState = job.status ?? 'unknown';

    if (rawState === 'validating') {
      return { status: 'queued', externalBatchState: rawState };
    }
    if (rawState === 'in_progress' || rawState === 'finalizing') {
      return { status: 'running', externalBatchState: rawState };
    }
    if (rawState === 'cancelled' || rawState === 'cancelling') {
      return {
        status: 'cancelled',
        externalBatchState: rawState,
        errorMessage: 'Job OpenAI Batch annullato.',
      };
    }
    if (rawState === 'failed' || rawState === 'expired') {
      return {
        status: 'failed',
        externalBatchState: rawState,
        errorMessage: `Job OpenAI Batch terminato con stato ${rawState}.`,
      };
    }

    if (rawState !== 'completed') {
      return {
        status: 'running',
        externalBatchState: rawState,
      };
    }

    const expectedIndexById = new Map<string, number>();
    params.expectedItemIds.forEach((id, idx) => expectedIndexById.set(id, idx));
    const itemsById = new Map<string, ProviderItemResult>();

    if (job.output_file_id) {
      const outResp = await this.fetchImpl(
        `${this.baseUrl}/files/${encodeURIComponent(job.output_file_id)}/content`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );
      if (!outResp.ok) {
        const errBody = await outResp.text().catch(() => '');
        throw new PromptEvalError(
          `Download risultati OpenAI Batch fallito (HTTP ${outResp.status}).`,
          502,
          'batch_download_failed',
          errBody.slice(0, 500)
        );
      }

      const text = await outResp.text();
      const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      lines.forEach((line, idx) => {
        try {
          const parsed = JSON.parse(line) as {
            custom_id?: string;
            error?: { message?: string } | null;
            response?: {
              status_code?: number;
              body?: Record<string, unknown>;
            };
          };
          const itemId =
            parsed.custom_id ?? params.expectedItemIds[idx] ?? `item-${idx}`;
          const itemIndex = expectedIndexById.get(itemId) ?? idx;

          if (parsed.error || (parsed.response?.status_code ?? 500) >= 400) {
            const bodyError = (
              parsed.response?.body as
                | { error?: { message?: string } }
                | undefined
            )?.error?.message;
            itemsById.set(itemId, {
              itemId,
              index: itemIndex,
              status: 'failed',
              outputFormat: params.modality === 'image' ? 'raster' : 'text',
              errorMessage:
                parsed.error?.message ??
                bodyError ??
                `HTTP ${parsed.response?.status_code ?? 500} nel batch OpenAI.`,
            });
            return;
          }

          const body = parsed.response?.body ?? {};
          if (params.modality === 'image') {
            const outputs = Array.isArray(body.output)
              ? (body.output as Array<{
                  type?: string;
                  result?: string;
                }>)
              : [];
            const imgCall = outputs.find(
              (entry) =>
                entry.type === 'image_generation_call' &&
                typeof entry.result === 'string'
            );
            const rawUsage = body.usage as
              | {
                  input_tokens?: number;
                  output_tokens?: number;
                  input_tokens_details?: { cached_tokens?: number };
                  output_tokens_details?: {
                    image_tokens?: number;
                    text_tokens?: number;
                  };
                }
              | undefined;
            const imageOutputTokens =
              rawUsage?.output_tokens_details?.image_tokens ??
              rawUsage?.output_tokens ??
              1500;
            const textOutputTokens =
              rawUsage?.output_tokens_details?.text_tokens ?? 0;
            const usage = computePromptEvalUsage({
              model: params.model,
              executionMode: 'batch',
              inputTokens: rawUsage?.input_tokens ?? 0,
              cachedInputTokens:
                rawUsage?.input_tokens_details?.cached_tokens ?? 0,
              textOutputTokens,
              imageOutputTokens,
            });

            if (imgCall?.result) {
              itemsById.set(itemId, {
                itemId,
                index: itemIndex,
                status: 'completed',
                outputFormat: 'raster',
                outputImageDataUrl: `data:image/png;base64,${imgCall.result}`,
                usage,
              });
            } else {
              itemsById.set(itemId, {
                itemId,
                index: itemIndex,
                status: 'failed',
                outputFormat: 'raster',
                errorMessage:
                  'Nessuna immagine trovata nella risposta batch OpenAI.',
                usage,
              });
            }
          } else {
            const choices = Array.isArray(body.choices)
              ? (body.choices as Array<{ message?: { content?: string } }>)
              : [];
            const content = choices[0]?.message?.content?.trim() ?? '';
            const rawUsage = body.usage as
              | {
                  prompt_tokens?: number;
                  completion_tokens?: number;
                  prompt_tokens_details?: { cached_tokens?: number };
                }
              | undefined;
            const usage = computePromptEvalUsage({
              model: params.model,
              executionMode: 'batch',
              inputTokens: rawUsage?.prompt_tokens ?? 0,
              cachedInputTokens:
                rawUsage?.prompt_tokens_details?.cached_tokens ?? 0,
              textOutputTokens: rawUsage?.completion_tokens ?? 0,
              imageOutputTokens: 0,
            });
            itemsById.set(
              itemId,
              content
                ? {
                    itemId,
                    index: itemIndex,
                    status: 'completed',
                    outputFormat: 'text',
                    outputText: content,
                    usage,
                  }
                : {
                    itemId,
                    index: itemIndex,
                    status: 'failed',
                    outputFormat: 'text',
                    errorMessage: 'Risposta testuale vuota nel batch OpenAI.',
                    usage,
                  }
            );
          }
        } catch (err) {
          const itemId = params.expectedItemIds[idx] ?? `item-${idx}`;
          itemsById.set(itemId, {
            itemId,
            index: idx,
            status: 'failed',
            outputFormat: params.modality === 'image' ? 'raster' : 'text',
            errorMessage:
              err instanceof Error ? err.message : 'JSONL OpenAI non valido.',
          });
        }
      });
    }

    if (job.error_file_id) {
      const errResp = await this.fetchImpl(
        `${this.baseUrl}/files/${encodeURIComponent(job.error_file_id)}/content`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );
      if (errResp.ok) {
        const errText = await errResp.text();
        const errLines = errText
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        errLines.forEach((line, idx) => {
          try {
            const parsed = JSON.parse(line) as {
              custom_id?: string;
              error?: { message?: string } | null;
              response?: {
                status_code?: number;
                body?: { error?: { message?: string } };
              };
            };
            const itemId =
              parsed.custom_id ?? params.expectedItemIds[idx] ?? `item-${idx}`;
            if (itemsById.has(itemId)) return;
            const itemIndex = expectedIndexById.get(itemId) ?? idx;
            const errMsg =
              parsed.error?.message ??
              parsed.response?.body?.error?.message ??
              `Errore OpenAI Batch (HTTP ${parsed.response?.status_code ?? 500}).`;
            itemsById.set(itemId, {
              itemId,
              index: itemIndex,
              status: 'failed',
              outputFormat: params.modality === 'image' ? 'raster' : 'text',
              errorMessage: errMsg,
            });
          } catch {
            // Ignore malformed error line
          }
        });
      }
    }

    const items = [...itemsById.values()].sort((a, b) => a.index - b.index);

    return {
      status: 'completed',
      externalBatchState: rawState,
      items,
    };
  }

  async cancelBatchJob(externalBatchJobId: string): Promise<void> {
    this.assertConfigured();
    const resp = await this.fetchImpl(
      `${this.baseUrl}/batches/${encodeURIComponent(externalBatchJobId)}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      }
    );
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      throw new PromptEvalError(
        `Annullamento OpenAI Batch fallito (HTTP ${resp.status}).`,
        502,
        'batch_cancel_failed',
        errBody.slice(0, 500)
      );
    }
  }
}
