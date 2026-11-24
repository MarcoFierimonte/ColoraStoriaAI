import crypto from 'node:crypto';
import {
  isPromptEvalModality,
  isPromptEvalVerdict,
  isPromptExecutionMode,
  isTerminalRunStatus,
  type PollPendingRunsResponse,
  type PromptEvalConfigResponse,
  type PromptEvalItem,
  type PromptEvalItemEvaluation,
  type PromptEvalLimits,
  type PromptEvalRunDetail,
  type PromptEvalRunEvaluation,
  type PromptEvalRunStatus,
  type PromptEvalRunSummary,
  type ResolvedPromptPreview,
  type UpdateItemEvaluationRequest,
  type UpdateRunEvaluationRequest,
} from '../../../prompt-eval-core/src/index.ts';
import {
  PromptEvalError,
  type CreatePromptEvalRunInput,
  type EmailNotificationSender,
  type PromptCatalogResolver,
  type PromptEvalImageInput,
  type PromptEvalMediaPreparer,
  type PromptEvalService,
  type PromptEvalStore,
  type PromptEvalTextInput,
  type PromptProviderRegistry,
  type ProviderItemResult,
} from '../promptEval.interface.ts';
import { buildRunResultEmailMessage, NoopEmailSender } from './emailSenders.ts';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAFE_DOC_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

function assertValidEntityId(id: string, label: string): string {
  const trimmed = id.trim();
  if (!SAFE_DOC_ID_PATTERN.test(trimmed)) {
    throw new PromptEvalError(
      `Identificativo ${label} non valido.`,
      400,
      'invalid_id'
    );
  }
  return trimmed;
}

const DEFAULT_LIMITS: PromptEvalLimits = {
  maxImagesPerRun: 20,
  maxTextInputsPerRun: 50,
  maxFileSizeMb: 12,
  acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  acceptedExtensionsLabel: 'JPG, PNG, WebP o AVIF',
};

function sanitizeEmail(raw: string | undefined | null): string | null {
  const trimmed = raw?.trim().toLowerCase() ?? '';
  if (!trimmed) return null;
  if (!EMAIL_PATTERN.test(trimmed) || trimmed.length > 254) {
    throw new PromptEvalError(
      `Indirizzo email non valido: "${trimmed}".`,
      400,
      'invalid_email'
    );
  }
  return trimmed;
}

function extractValidEmailOrNull(
  raw: string | undefined | null
): string | null {
  const trimmed = raw?.trim().toLowerCase() ?? '';
  if (!trimmed || !EMAIL_PATTERN.test(trimmed) || trimmed.length > 254) {
    return null;
  }
  return trimmed;
}

function normalizeRating(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new PromptEvalError(
      'La valutazione in stelle deve essere un numero intero tra 1 e 5.',
      400,
      'invalid_rating'
    );
  }
  return value;
}

function aggregateRunStats(items: readonly PromptEvalItem[]) {
  let completedItems = 0;
  let failedItems = 0;
  let totalEstimatedCostUsd = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const item of items) {
    if (item.status === 'completed') completedItems++;
    if (item.status === 'failed') failedItems++;
    if (item.usage) {
      totalEstimatedCostUsd += item.usage.estimatedCostUsd;
      totalInputTokens += item.usage.inputTokens;
      totalOutputTokens +=
        item.usage.textOutputTokens + item.usage.imageOutputTokens;
    }
  }

  return {
    completedItems,
    failedItems,
    totalEstimatedCostUsd: Number(totalEstimatedCostUsd.toFixed(6)),
    totalInputTokens,
    totalOutputTokens,
  };
}

function resolveFinalStatus(
  totalItems: number,
  completedItems: number,
  failedItems: number
): PromptEvalRunStatus {
  if (totalItems === 0 || (completedItems === 0 && failedItems > 0)) {
    return 'failed';
  }
  if (failedItems > 0) {
    return 'partial';
  }
  return 'completed';
}

export interface DefaultPromptEvalServiceOptions {
  providers: PromptProviderRegistry;
  store: PromptEvalStore;
  catalogResolver?: PromptCatalogResolver;
  mediaPreparer?: PromptEvalMediaPreparer;
  emailSender?: EmailNotificationSender;
  appBaseUrl?: string;
  limits?: Partial<PromptEvalLimits>;
  standardConcurrency?: number;
  now?: () => number;
}

export class DefaultPromptEvalService implements PromptEvalService {
  private readonly providers: PromptProviderRegistry;
  private readonly store: PromptEvalStore;
  private readonly catalogResolver?: PromptCatalogResolver;
  private readonly mediaPreparer?: PromptEvalMediaPreparer;
  private readonly emailSender: EmailNotificationSender;
  private readonly appBaseUrl?: string;
  private readonly limits: PromptEvalLimits;
  private readonly standardConcurrency: number;
  private readonly now: () => number;
  private readonly inFlightRefreshes = new Map<
    string,
    Promise<PromptEvalRunDetail>
  >();

  constructor(options: DefaultPromptEvalServiceOptions) {
    this.providers = options.providers;
    this.store = options.store;
    this.catalogResolver = options.catalogResolver;
    this.mediaPreparer = options.mediaPreparer;
    this.emailSender = options.emailSender ?? new NoopEmailSender();
    this.appBaseUrl = options.appBaseUrl?.trim() || undefined;
    this.limits = { ...DEFAULT_LIMITS, ...(options.limits ?? {}) };
    this.standardConcurrency = Math.max(
      1,
      Math.min(4, Math.trunc(options.standardConcurrency ?? 2))
    );
    this.now = options.now ?? (() => Date.now());
  }

  getLimits(): PromptEvalLimits {
    return {
      ...this.limits,
      acceptedMimeTypes: [...this.limits.acceptedMimeTypes],
    };
  }

  getConfig(): PromptEvalConfigResponse {
    return {
      providers: this.providers.listProviders(),
      catalogs: this.catalogResolver?.listCatalogs() ?? [],
      emailNotification: this.emailSender.getStatus(),
      limits: this.getLimits(),
    };
  }

  resolveCatalogPrompt(
    catalogId: string,
    params: Record<string, string>
  ): ResolvedPromptPreview {
    if (!this.catalogResolver) {
      throw new PromptEvalError(
        'Nessun catalogo prompt configurato sul server.',
        404,
        'catalog_unavailable'
      );
    }
    return this.catalogResolver.resolvePrompt(catalogId, params);
  }

  async createRun(input: CreatePromptEvalRunInput): Promise<PromptEvalRunDetail> {
    if (!isPromptEvalModality(input.modality)) {
      throw new PromptEvalError(
        'Modalità non valida (usa "image" o "text").',
        400,
        'invalid_modality'
      );
    }
    if (!isPromptExecutionMode(input.executionMode)) {
      throw new PromptEvalError(
        'Modalità esecuzione API non valida (usa "standard" o "batch").',
        400,
        'invalid_execution_mode'
      );
    }

    const provider = this.providers.getProvider(input.providerId);
    if (!provider.isConfigured()) {
      throw new PromptEvalError(
        `Il provider "${provider.label}" non è configurato sul server (chiave API mancante).`,
        503,
        'provider_not_configured'
      );
    }

    const providerInfo = provider.getInfo(false);
    const matchingModalityModels = providerInfo.models.filter(
      (m) => m.modality === input.modality
    );
    const requestedModel = input.model?.trim();
    const model =
      requestedModel ||
      matchingModalityModels[0]?.id ||
      providerInfo.defaultModel;

    const modelInfo = provider.getModelInfo(model);
    if (modelInfo && modelInfo.modality !== input.modality) {
      throw new PromptEvalError(
        `Il modello "${model}" supporta solo la modalità "${modelInfo.modality}", non "${input.modality}".`,
        400,
        'model_modality_mismatch'
      );
    }
    if (input.executionMode === 'batch' && modelInfo && !modelInfo.supportsBatch) {
      throw new PromptEvalError(
        `Il modello "${model}" non supporta le Batch API. Scegli un altro modello oppure passa alle API Standard.`,
        400,
        'batch_not_supported'
      );
    }

    let promptText: string;
    let promptLabel: string;
    let promptParams: Record<string, string> = {};
    let promptMetadata: Record<string, string> = {};
    let catalogId: string | null = null;
    let outputFormatHint: 'raster' | 'svg' | 'text' | undefined =
      input.modality === 'text' ? 'text' : modelInfo?.outputFormat;

    if (input.promptSource === 'catalog') {
      const requestedCatalog =
        input.catalogId?.trim() ||
        this.catalogResolver?.listCatalogs()[0]?.id ||
        '';
      if (!requestedCatalog) {
        throw new PromptEvalError(
          'Catalogo prompt non disponibile.',
          400,
          'missing_catalog'
        );
      }
      const resolved = this.resolveCatalogPrompt(
        requestedCatalog,
        input.promptParams ?? {}
      );
      catalogId = resolved.catalogId;
      promptText = resolved.promptText;
      promptLabel = resolved.label;
      promptParams = resolved.params;
      promptMetadata = resolved.metadata;
      if (
        resolved.params.outputFormat === 'svg' ||
        resolved.params.outputFormat === 'raster'
      ) {
        outputFormatHint = resolved.params.outputFormat;
      }
    } else {
      const custom = input.customPromptText?.trim() ?? '';
      if (!custom) {
        throw new PromptEvalError(
          'Inserisci il testo del prompt prima di avviare la valutazione.',
          400,
          'missing_prompt'
        );
      }
      promptText = custom;
      promptLabel = 'Prompt personalizzato';
    }

    const notifyEmail = sanitizeEmail(input.notifyEmail);
    const runId = `eval_${this.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const createdAtMs = this.now();

    const preparedImages: PromptEvalImageInput[] = [];
    const preparedTexts: PromptEvalTextInput[] = [];
    const initialItems: PromptEvalItem[] = [];

    if (input.modality === 'image') {
      const files = input.files ?? [];
      if (files.length === 0) {
        throw new PromptEvalError(
          'Carica almeno un’immagine per avviare la valutazione.',
          400,
          'missing_files'
        );
      }
      if (files.length > this.limits.maxImagesPerRun) {
        throw new PromptEvalError(
          `Puoi caricare al massimo ${this.limits.maxImagesPerRun} immagini per esecuzione.`,
          400,
          'too_many_files'
        );
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const itemId = `item_${String(i + 1).padStart(2, '0')}_${crypto
          .randomBytes(3)
          .toString('hex')}`;
        const prepared = this.mediaPreparer
          ? await this.mediaPreparer.prepareInputImage(
              file.bytes,
              file.mimeType
            )
          : {
              bytes: file.bytes,
              mimeType: file.mimeType,
              width: 0,
              height: 0,
              thumbnailDataUrl: undefined,
            };

        preparedImages.push({
          id: itemId,
          index: i,
          name: file.originalName || `image-${i + 1}`,
          bytes: prepared.bytes,
          mimeType: prepared.mimeType,
          width: prepared.width || undefined,
          height: prepared.height || undefined,
          thumbnailDataUrl: prepared.thumbnailDataUrl,
        });

        initialItems.push({
          id: itemId,
          index: i,
          inputName: file.originalName || `image-${i + 1}`,
          inputMimeType: prepared.mimeType,
          inputWidth: prepared.width || undefined,
          inputHeight: prepared.height || undefined,
          inputThumbnailDataUrl: prepared.thumbnailDataUrl,
          status: input.executionMode === 'standard' ? 'running' : 'pending',
        });
      }
    } else {
      const texts = (input.textInputs ?? [])
        .map((entry, idx) => ({
          name:
            typeof entry?.name === 'string' && entry.name.trim()
              ? entry.name.trim()
              : `Testo #${idx + 1}`,
          text: typeof entry?.text === 'string' ? entry.text.trim() : '',
        }))
        .filter((entry) => entry.text.length > 0);

      if (texts.length === 0) {
        throw new PromptEvalError(
          'Inserisci almeno un testo di input per avviare la valutazione.',
          400,
          'missing_text_inputs'
        );
      }
      if (texts.length > this.limits.maxTextInputsPerRun) {
        throw new PromptEvalError(
          `Puoi inserire al massimo ${this.limits.maxTextInputsPerRun} input testuali per esecuzione.`,
          400,
          'too_many_inputs'
        );
      }

      for (let i = 0; i < texts.length; i++) {
        const itemId = `item_${String(i + 1).padStart(2, '0')}_${crypto
          .randomBytes(3)
          .toString('hex')}`;
        preparedTexts.push({
          id: itemId,
          index: i,
          name: texts[i].name,
          text: texts[i].text,
        });
        initialItems.push({
          id: itemId,
          index: i,
          inputName: texts[i].name,
          inputText: texts[i].text,
          status: input.executionMode === 'standard' ? 'running' : 'pending',
        });
      }
    }

    const totalItems = initialItems.length;
    const defaultTitle = `${promptLabel} (${totalItems} ${
      input.modality === 'image'
        ? totalItems === 1
          ? 'img'
          : 'img'
        : totalItems === 1
          ? 'testo'
          : 'testi'
    })`;
    const title = (input.title?.trim() || defaultTitle).slice(0, 120);

    const runRecord: PromptEvalRunDetail = {
      id: runId,
      title,
      createdByUid: input.actorUid,
      createdByEmail: input.actorEmail,
      modality: input.modality,
      executionMode: input.executionMode,
      providerId: provider.id,
      model,
      promptSource: input.promptSource,
      catalogId,
      promptLabel,
      promptText,
      promptParams,
      promptMetadata,
      status: input.executionMode === 'batch' ? 'queued' : 'running',
      totalItems,
      completedItems: 0,
      failedItems: 0,
      totalEstimatedCostUsd: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      externalBatchJobId: null,
      externalBatchState: null,
      notifyEmail,
      notificationStatus: notifyEmail ? 'pending' : 'not_requested',
      notificationSentAtMs: null,
      notificationError: null,
      createdAtMs,
      updatedAtMs: createdAtMs,
      completedAtMs: null,
      errorMessage: null,
      items: initialItems,
    };

    await this.store.createRun(runRecord);

    if (input.executionMode === 'batch') {
      try {
        const submitted = await provider.submitBatchJob({
          runId,
          displayName: title,
          modality: input.modality,
          model,
          promptText,
          outputFormatHint,
          images: input.modality === 'image' ? preparedImages : undefined,
          textInputs: input.modality === 'text' ? preparedTexts : undefined,
        });

        await this.store.updateRunSummary(runId, {
          status: 'queued',
          externalBatchJobId: submitted.externalBatchJobId,
          externalBatchState: submitted.externalBatchState,
          updatedAtMs: this.now(),
        });

        return (await this.store.getRun(runId)) ?? runRecord;
      } catch (error) {
        const errMessage =
          error instanceof Error
            ? error.message
            : 'Errore invio job alla Batch API.';
        const failedAtMs = this.now();
        const failedItems: PromptEvalItem[] = initialItems.map((item) => ({
          ...item,
          status: 'failed',
          errorMessage: errMessage.slice(0, 400),
          completedAtMs: failedAtMs,
        }));
        for (const item of failedItems) {
          try {
            await this.store.upsertRunItem(runId, item);
          } catch (cleanupErr) {
            console.error(
              `[PROMPT_EVAL] Failed marking batch item ${item.id} as failed during cleanup:`,
              cleanupErr
            );
          }
        }
        const stats = aggregateRunStats(failedItems);
        try {
          await this.store.updateRunSummary(runId, {
            status: 'failed',
            errorMessage: errMessage,
            ...stats,
            ...(notifyEmail
              ? {
                  notificationStatus: 'failed' as const,
                  notificationError:
                    'Job Batch non avviato a causa di un errore di invio.',
                }
              : {}),
            completedAtMs: failedAtMs,
            updatedAtMs: failedAtMs,
          });
        } catch (cleanupErr) {
          console.error(
            `[PROMPT_EVAL] Failed updating run summary ${runId} during batch submit cleanup:`,
            cleanupErr
          );
        }
        if (error instanceof PromptEvalError) throw error;
        throw new PromptEvalError(errMessage, 502, 'batch_submit_failed');
      }
    }

    // Standard mode: execute each item individually with bounded concurrency
    const updatedItems: PromptEvalItem[] = [...initialItems];
    let cursor = 0;

    const worker = async () => {
      while (cursor < totalItems) {
        const idx = cursor++;
        const currentItem = updatedItems[idx];
        let result: ProviderItemResult;
        try {
          result = await provider.executeStandardItem({
            modality: input.modality,
            model,
            promptText,
            outputFormatHint,
            image: input.modality === 'image' ? preparedImages[idx] : undefined,
            textInput: input.modality === 'text' ? preparedTexts[idx] : undefined,
          });
        } catch (err) {
          result = {
            itemId: currentItem.id,
            index: idx,
            status: 'failed',
            outputFormat: outputFormatHint,
            errorMessage:
              err instanceof Error
                ? err.message.slice(0, 400)
                : 'Errore imprevisto durante la generazione.',
          };
        }

        const storedItem = await this.mergeItemResult(currentItem, result);
        await this.store.upsertRunItem(runId, storedItem);
        updatedItems[idx] = storedItem;
      }
    };

    try {
      const workers = Array.from(
        { length: Math.min(this.standardConcurrency, totalItems) },
        () => worker()
      );
      await Promise.all(workers);
    } catch (err) {
      const failedAtMs = this.now();
      const errMessage =
        err instanceof Error
          ? err.message.slice(0, 400)
          : 'Errore interno durante l’elaborazione.';
      for (let i = 0; i < updatedItems.length; i++) {
        const item = updatedItems[i];
        if (item.status !== 'completed' && item.status !== 'failed') {
          const failedItem: PromptEvalItem = {
            ...item,
            status: 'failed',
            errorMessage: errMessage,
            completedAtMs: failedAtMs,
          };
          updatedItems[i] = failedItem;
          try {
            await this.store.upsertRunItem(runId, failedItem);
          } catch (cleanupErr) {
            console.error(
              `[PROMPT_EVAL] Failed marking standard item ${failedItem.id} as failed during cleanup:`,
              cleanupErr
            );
          }
        }
      }
      const stats = aggregateRunStats(updatedItems);
      try {
        await this.store.updateRunSummary(runId, {
          status: 'failed',
          errorMessage: errMessage,
          ...stats,
          ...(notifyEmail
            ? {
                notificationStatus: 'failed' as const,
                notificationError:
                  'Elaborazione interrotta a causa di un errore interno.',
              }
            : {}),
          completedAtMs: failedAtMs,
          updatedAtMs: failedAtMs,
        });
      } catch (cleanupErr) {
        console.error(
          `[PROMPT_EVAL] Failed updating run summary ${runId} during standard run cleanup:`,
          cleanupErr
        );
      }
      throw err;
    }

    const stats = aggregateRunStats(updatedItems);
    const finishedAtMs = this.now();
    const finalStatus = resolveFinalStatus(
      totalItems,
      stats.completedItems,
      stats.failedItems
    );

    await this.store.updateRunSummary(runId, {
      status: finalStatus,
      ...stats,
      completedAtMs: finishedAtMs,
      updatedAtMs: finishedAtMs,
    });

    const completedRun = (await this.store.getRun(runId)) ?? {
      ...runRecord,
      status: finalStatus,
      ...stats,
      completedAtMs: finishedAtMs,
      updatedAtMs: finishedAtMs,
      items: updatedItems,
    };

    if (notifyEmail) {
      return this.deliverOrRecordEmailNotification(completedRun, notifyEmail);
    }

    return completedRun;
  }

  private async mergeItemResult(
    existing: PromptEvalItem,
    result: ProviderItemResult
  ): Promise<PromptEvalItem> {
    let outputImageDataUrl = result.outputImageDataUrl;
    if (outputImageDataUrl && this.mediaPreparer?.prepareOutputForStorage) {
      try {
        outputImageDataUrl =
          await this.mediaPreparer.prepareOutputForStorage(outputImageDataUrl);
      } catch (err) {
        console.warn('[PROMPT_EVAL] Output storage compression skipped:', err);
      }
    }

    return {
      ...existing,
      status: result.status,
      outputFormat: result.outputFormat,
      outputImageDataUrl,
      outputText: result.outputText,
      errorMessage: result.errorMessage,
      latencyMs: result.latencyMs,
      usage: result.usage,
      completedAtMs: this.now(),
    };
  }

  async listRuns(limit = 50): Promise<PromptEvalRunSummary[]> {
    return this.store.listRuns(limit);
  }

  async getRun(runId: string): Promise<PromptEvalRunDetail> {
    const safeRunId = assertValidEntityId(runId, 'esecuzione');
    const run = await this.store.getRun(safeRunId);
    if (!run) {
      throw new PromptEvalError(
        'Esecuzione di test non trovata.',
        404,
        'run_not_found'
      );
    }
    return run;
  }

  async refreshBatchRun(runId: string): Promise<PromptEvalRunDetail> {
    const safeRunId = assertValidEntityId(runId, 'esecuzione');
    const existingPromise = this.inFlightRefreshes.get(safeRunId);
    if (existingPromise) {
      return existingPromise;
    }

    const promise = this.performRefreshBatchRun(safeRunId).finally(() => {
      this.inFlightRefreshes.delete(safeRunId);
    });
    this.inFlightRefreshes.set(safeRunId, promise);
    return promise;
  }

  private async performRefreshBatchRun(
    runId: string
  ): Promise<PromptEvalRunDetail> {
    const run = await this.getRun(runId);
    if (
      run.executionMode !== 'batch' ||
      !run.externalBatchJobId ||
      isTerminalRunStatus(run.status)
    ) {
      return run;
    }

    const provider = this.providers.getProvider(run.providerId);
    const outputFormatHint =
      run.modality === 'text'
        ? 'text'
        : run.promptParams.outputFormat === 'svg'
          ? 'svg'
          : run.promptParams.outputFormat === 'raster'
            ? 'raster'
            : undefined;

    const polled = await provider.pollBatchJob({
      externalBatchJobId: run.externalBatchJobId,
      model: run.model,
      modality: run.modality,
      outputFormatHint,
      expectedItemIds: run.items.map((item) => item.id),
    });

    const nowMs = this.now();

    if (polled.status === 'queued' || polled.status === 'running') {
      await this.store.updateRunSummary(runId, {
        status: polled.status,
        externalBatchState: polled.externalBatchState,
        updatedAtMs: nowMs,
      });
      return this.getRun(runId);
    }

    if (polled.status === 'failed' || polled.status === 'cancelled') {
      const updatedItems = run.items.map((item) =>
        item.status === 'completed'
          ? item
          : {
              ...item,
              status: 'failed' as const,
              errorMessage:
                polled.errorMessage ??
                `Job batch ${polled.status === 'cancelled' ? 'annullato' : 'fallito'}.`,
              completedAtMs: nowMs,
            }
      );
      for (const item of updatedItems) {
        await this.store.upsertRunItem(runId, item);
      }
      const stats = aggregateRunStats(updatedItems);
      await this.store.updateRunSummary(runId, {
        status: polled.status,
        externalBatchState: polled.externalBatchState,
        errorMessage: polled.errorMessage ?? null,
        ...stats,
        completedAtMs: nowMs,
        updatedAtMs: nowMs,
      });

      const finalized = await this.getRun(runId);
      if (finalized.notifyEmail && finalized.notificationStatus !== 'sent') {
        return this.deliverOrRecordEmailNotification(
          finalized,
          finalized.notifyEmail
        );
      }
      return finalized;
    }

    // Batch completed: merge every returned item result
    const resultById = new Map<string, ProviderItemResult>();
    const resultByIndex = new Map<number, ProviderItemResult>();
    for (const entry of polled.items ?? []) {
      resultById.set(entry.itemId, entry);
      resultByIndex.set(entry.index, entry);
    }

    const updatedItems: PromptEvalItem[] = [];
    for (const item of run.items) {
      const match = resultById.get(item.id) ?? resultByIndex.get(item.index);
      if (match) {
        const merged = await this.mergeItemResult(item, match);
        updatedItems.push(merged);
        await this.store.upsertRunItem(runId, merged);
      } else {
        const missing: PromptEvalItem = {
          ...item,
          status: 'failed',
          errorMessage: 'Risultato mancante nella risposta Batch API.',
          completedAtMs: nowMs,
        };
        updatedItems.push(missing);
        await this.store.upsertRunItem(runId, missing);
      }
    }

    const stats = aggregateRunStats(updatedItems);
    const finalStatus = resolveFinalStatus(
      run.totalItems,
      stats.completedItems,
      stats.failedItems
    );

    await this.store.updateRunSummary(runId, {
      status: finalStatus,
      externalBatchState: polled.externalBatchState,
      ...stats,
      completedAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    const finalized = await this.getRun(runId);
    if (finalized.notifyEmail && finalized.notificationStatus !== 'sent') {
      return this.deliverOrRecordEmailNotification(
        finalized,
        finalized.notifyEmail
      );
    }

    return finalized;
  }

  private async deliverOrRecordEmailNotification(
    run: PromptEvalRunDetail,
    recipient: string
  ): Promise<PromptEvalRunDetail> {
    if (!this.emailSender.isConfigured()) {
      await this.store.updateRunSummary(run.id, {
        notifyEmail: recipient,
        notificationStatus: 'failed',
        notificationError:
          'Servizio email non configurato sul server (imposta RESEND_API_KEY o BREVO_API_KEY + EMAIL_FROM).',
        updatedAtMs: this.now(),
      });
      return this.getRun(run.id);
    }

    if (this.store.claimEmailNotification) {
      const claimed = await this.store.claimEmailNotification(
        run.id,
        recipient,
        this.now()
      );
      if (!claimed) {
        return this.getRun(run.id);
      }
    }

    return this.tryDeliverEmailNotification(run, recipient);
  }

  private async tryDeliverEmailNotification(
    run: PromptEvalRunDetail,
    recipient: string
  ): Promise<PromptEvalRunDetail> {
    try {
      const message = buildRunResultEmailMessage({
        run,
        to: recipient,
        appBaseUrl: this.appBaseUrl,
      });
      await this.emailSender.send(message);
      const sentAt = this.now();
      await this.store.updateRunSummary(run.id, {
        notifyEmail: recipient,
        notificationStatus: 'sent',
        notificationSentAtMs: sentAt,
        notificationError: null,
        updatedAtMs: sentAt,
      });
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : 'Errore invio email.';
      await this.store.updateRunSummary(run.id, {
        notifyEmail: recipient,
        notificationStatus: 'failed',
        notificationError: errMsg.slice(0, 400),
        updatedAtMs: this.now(),
      });
    }
    return this.getRun(run.id);
  }

  async cancelBatchRun(runId: string): Promise<PromptEvalRunDetail> {
    const run = await this.getRun(runId);
    if (run.executionMode !== 'batch' || !run.externalBatchJobId) {
      throw new PromptEvalError(
        'Solo i job Batch API possono essere annullati.',
        400,
        'not_a_batch_run'
      );
    }
    if (isTerminalRunStatus(run.status)) {
      return run;
    }

    const provider = this.providers.getProvider(run.providerId);
    await provider.cancelBatchJob(run.externalBatchJobId);

    const nowMs = this.now();
    const updatedItems = run.items.map((item) =>
      item.status === 'completed'
        ? item
        : {
            ...item,
            status: 'failed' as const,
            errorMessage: 'Job batch annullato dall’amministratore.',
            completedAtMs: nowMs,
          }
    );
    for (const item of updatedItems) {
      await this.store.upsertRunItem(run.id, item);
    }
    const stats = aggregateRunStats(updatedItems);
    await this.store.updateRunSummary(run.id, {
      status: 'cancelled',
      externalBatchState: 'CANCELLED',
      errorMessage: 'Job batch annullato dall’amministratore.',
      ...stats,
      ...(run.notifyEmail && run.notificationStatus === 'pending'
        ? {
            notificationStatus: 'not_requested' as const,
            notificationError: null,
          }
        : {}),
      completedAtMs: nowMs,
      updatedAtMs: nowMs,
    });
    return this.getRun(run.id);
  }

  async notifyRunByEmail(
    runId: string,
    overrideEmail?: string
  ): Promise<PromptEvalRunDetail> {
    const run = await this.getRun(runId);
    if (!isTerminalRunStatus(run.status)) {
      throw new PromptEvalError(
        'Il job Batch è ancora in corso: attendi il completamento prima di inviare l’email con i risultati.',
        400,
        'run_not_finished'
      );
    }
    const targetEmail =
      sanitizeEmail(overrideEmail) ??
      extractValidEmailOrNull(run.notifyEmail) ??
      extractValidEmailOrNull(run.createdByEmail);

    if (!targetEmail) {
      throw new PromptEvalError(
        'Specifica un indirizzo email di destinazione.',
        400,
        'missing_email'
      );
    }

    if (!this.emailSender.isConfigured()) {
      throw new PromptEvalError(
        'Servizio email non configurato sul server. Imposta RESEND_API_KEY o BREVO_API_KEY (piano gratuito) + EMAIL_FROM.',
        503,
        'email_not_configured'
      );
    }

    const message = buildRunResultEmailMessage({
      run,
      to: targetEmail,
      appBaseUrl: this.appBaseUrl,
    });
    await this.emailSender.send(message);

    const sentAt = this.now();
    await this.store.updateRunSummary(run.id, {
      notifyEmail: targetEmail,
      notificationStatus: 'sent',
      notificationSentAtMs: sentAt,
      notificationError: null,
      updatedAtMs: sentAt,
    });

    return this.getRun(run.id);
  }

  async updateRunEvaluation(
    runId: string,
    patch: UpdateRunEvaluationRequest
  ): Promise<PromptEvalRunDetail> {
    const existing = await this.getRun(runId);
    const nextRating =
      patch.overallRating !== undefined
        ? normalizeRating(patch.overallRating)
        : (existing.evaluation?.overallRating ?? null);
    if (patch.notes !== undefined && typeof patch.notes !== 'string') {
      throw new PromptEvalError(
        'Il campo notes deve essere una stringa.',
        400,
        'invalid_notes'
      );
    }
    if (patch.tags !== undefined && !Array.isArray(patch.tags)) {
      throw new PromptEvalError(
        'Il campo tags deve essere una lista di stringhe.',
        400,
        'invalid_tags'
      );
    }
    const nextNotes =
      patch.notes !== undefined
        ? patch.notes.trim().slice(0, 5000)
        : (existing.evaluation?.notes ?? '');
    const nextTags =
      patch.tags !== undefined
        ? [
            ...new Set(
              patch.tags
                .filter((tag): tag is string => typeof tag === 'string')
                .map((tag) => tag.trim())
                .filter(Boolean)
                .map((tag) => tag.slice(0, 40))
            ),
          ].slice(0, 12)
        : (existing.evaluation?.tags ?? []);

    const evaluation: PromptEvalRunEvaluation = {
      overallRating: nextRating,
      notes: nextNotes,
      tags: nextTags,
      updatedAtMs: this.now(),
    };

    const updated = await this.store.updateRunEvaluation(existing.id, evaluation);
    if (!updated) {
      throw new PromptEvalError(
        'Esecuzione non trovata.',
        404,
        'run_not_found'
      );
    }
    return updated;
  }

  async updateItemEvaluation(
    runId: string,
    itemId: string,
    patch: UpdateItemEvaluationRequest
  ): Promise<PromptEvalRunDetail> {
    const safeItemId = assertValidEntityId(itemId, 'elemento');
    const existingRun = await this.getRun(runId);
    const existingItem = existingRun.items.find((item) => item.id === safeItemId);
    if (!existingItem) {
      throw new PromptEvalError(
        'Elemento non trovato in questa esecuzione.',
        404,
        'item_not_found'
      );
    }

    const nextRating =
      patch.rating !== undefined
        ? normalizeRating(patch.rating)
        : (existingItem.evaluation?.rating ?? null);

    let nextVerdict = existingItem.evaluation?.verdict ?? null;
    if (patch.verdict !== undefined) {
      if (patch.verdict === null) {
        nextVerdict = null;
      } else if (
        typeof patch.verdict === 'string' &&
        isPromptEvalVerdict(patch.verdict)
      ) {
        nextVerdict = patch.verdict;
      } else {
        throw new PromptEvalError(
          'Esito valutazione non valido (usa pass, needs_work o fail).',
          400,
          'invalid_verdict'
        );
      }
    }

    if (patch.notes !== undefined && typeof patch.notes !== 'string') {
      throw new PromptEvalError(
        'Il campo notes deve essere una stringa.',
        400,
        'invalid_notes'
      );
    }
    const nextNotes =
      patch.notes !== undefined
        ? patch.notes.trim().slice(0, 3000)
        : (existingItem.evaluation?.notes ?? '');

    const evaluation: PromptEvalItemEvaluation = {
      rating: nextRating,
      verdict: nextVerdict,
      notes: nextNotes,
      updatedAtMs: this.now(),
    };

    const updated = await this.store.updateItemEvaluation(
      existingRun.id,
      safeItemId,
      evaluation
    );
    if (!updated) {
      throw new PromptEvalError(
        'Impossibile salvare la valutazione dell’elemento.',
        404,
        'item_not_found'
      );
    }
    return updated;
  }

  async deleteRun(runId: string): Promise<void> {
    const safeRunId = assertValidEntityId(runId, 'esecuzione');
    const deleted = await this.store.deleteRun(safeRunId);
    if (!deleted) {
      throw new PromptEvalError(
        'Esecuzione di test non trovata.',
        404,
        'run_not_found'
      );
    }
  }

  async pollPendingBatchRuns(): Promise<PollPendingRunsResponse> {
    const activeRuns = await this.store.listActiveBatchRuns();
    const updatedRunIds: string[] = [];
    const notifiedRunIds: string[] = [];

    for (const run of activeRuns) {
      try {
        const beforeStatus = run.status;
        const beforeNotification = run.notificationStatus;
        const refreshed = await this.refreshBatchRun(run.id);
        if (
          refreshed.status !== beforeStatus ||
          refreshed.externalBatchState !== run.externalBatchState
        ) {
          updatedRunIds.push(run.id);
        }
        if (
          beforeNotification !== 'sent' &&
          refreshed.notificationStatus === 'sent'
        ) {
          notifiedRunIds.push(run.id);
        }
      } catch (err) {
        console.error(
          `[PROMPT_EVAL] Failed polling batch run ${run.id}:`,
          err
        );
      }
    }

    return {
      checkedCount: activeRuns.length,
      updatedRunIds,
      notifiedRunIds,
    };
  }

  startBackgroundPoller(intervalMs = 60_000): { stop: () => void } {
    let inFlight = false;
    const timer = setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      void this.pollPendingBatchRuns()
        .catch((err) => {
          console.error('[PROMPT_EVAL] Background batch poll failed:', err);
        })
        .finally(() => {
          inFlight = false;
        });
    }, Math.max(10_000, intervalMs));
    timer.unref();
    return {
      stop: () => clearInterval(timer),
    };
  }
}
