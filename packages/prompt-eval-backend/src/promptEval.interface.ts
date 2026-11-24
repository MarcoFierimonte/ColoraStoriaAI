import type {
  PollPendingRunsResponse,
  PromptCatalogDefinition,
  PromptEvalConfigResponse,
  PromptEvalDatasetDetail,
  PromptEvalDatasetItemRef,
  PromptEvalDatasetItemSummary,
  PromptEvalDatasetSummary,
  PromptEvalEmailConfigStatus,
  PromptEvalItem,
  PromptEvalItemEvaluation,
  PromptEvalLimits,
  PromptEvalModality,
  PromptEvalModelInfo,
  PromptEvalProviderInfo,
  PromptEvalRunDetail,
  PromptEvalRunEvaluation,
  PromptEvalRunSummary,
  PromptEvalUsage,
  PromptExecutionMode,
  ResolvedPromptPreview,
  UpdateItemEvaluationRequest,
  UpdateRunEvaluationRequest,
} from '../../prompt-eval-core/src/index.ts';

export class PromptEvalError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly rawDetails?: string;

  constructor(
    message: string,
    statusCode = 400,
    code = 'prompt_eval_error',
    rawDetails?: string
  ) {
    super(message);
    this.name = 'PromptEvalError';
    this.statusCode = statusCode;
    this.code = code;
    this.rawDetails = rawDetails;
  }
}

export interface PromptCatalogResolver {
  listCatalogs(): PromptCatalogDefinition[];
  resolvePrompt(
    catalogId: string,
    params: Record<string, string>
  ): ResolvedPromptPreview;
}

export interface PreparedImagePayload {
  bytes: Uint8Array;
  mimeType: string;
  width: number;
  height: number;
  thumbnailDataUrl?: string;
}

export interface PromptEvalMediaPreparer {
  prepareInputImage(
    rawBytes: Uint8Array,
    declaredMimeType: string
  ): Promise<PreparedImagePayload>;
  prepareOutputForStorage?(dataUrl: string): Promise<string>;
}

export interface PromptEvalImageInput {
  id: string;
  index: number;
  name: string;
  bytes: Uint8Array;
  mimeType: string;
  width?: number;
  height?: number;
  thumbnailDataUrl?: string;
}

export interface PromptEvalTextInput {
  id: string;
  index: number;
  name: string;
  text: string;
}

export interface ProviderStandardItemRequest {
  modality: PromptEvalModality;
  model: string;
  promptText: string;
  outputFormatHint?: 'raster' | 'svg' | 'text';
  image?: PromptEvalImageInput;
  textInput?: PromptEvalTextInput;
}

export interface ProviderItemResult {
  itemId: string;
  index: number;
  status: 'completed' | 'failed';
  outputFormat?: 'raster' | 'svg' | 'text';
  outputImageDataUrl?: string;
  outputText?: string;
  errorMessage?: string;
  latencyMs?: number;
  usage?: PromptEvalUsage;
}

export interface ProviderBatchSubmitRequest {
  runId: string;
  displayName: string;
  modality: PromptEvalModality;
  model: string;
  promptText: string;
  outputFormatHint?: 'raster' | 'svg' | 'text';
  images?: PromptEvalImageInput[];
  textInputs?: PromptEvalTextInput[];
}

export interface ProviderBatchSubmitResult {
  externalBatchJobId: string;
  externalBatchState: string;
}

export type ProviderBatchPollStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ProviderBatchPollResult {
  status: ProviderBatchPollStatus;
  externalBatchState: string;
  errorMessage?: string;
  items?: ProviderItemResult[];
}

export interface PromptExecutionProvider {
  readonly id: string;
  readonly label: string;
  isConfigured(): boolean;
  getInfo(isDefault: boolean): PromptEvalProviderInfo;
  getModelInfo(modelId: string): PromptEvalModelInfo | undefined;
  executeStandardItem(
    request: ProviderStandardItemRequest
  ): Promise<ProviderItemResult>;
  submitBatchJob(
    request: ProviderBatchSubmitRequest
  ): Promise<ProviderBatchSubmitResult>;
  pollBatchJob(params: {
    externalBatchJobId: string;
    model: string;
    modality: PromptEvalModality;
    outputFormatHint?: 'raster' | 'svg' | 'text';
    expectedItemIds: string[];
  }): Promise<ProviderBatchPollResult>;
  cancelBatchJob(externalBatchJobId: string): Promise<void>;
}

export interface PromptProviderRegistry {
  getProvider(providerId?: string): PromptExecutionProvider;
  listProviders(): PromptEvalProviderInfo[];
}

export interface PromptEvalStore {
  createRun(run: PromptEvalRunDetail): Promise<PromptEvalRunDetail>;
  getRun(runId: string): Promise<PromptEvalRunDetail | null>;
  listRuns(limit?: number): Promise<PromptEvalRunSummary[]>;
  listActiveBatchRuns(): Promise<PromptEvalRunSummary[]>;
  updateRunSummary(
    runId: string,
    patch: Partial<PromptEvalRunSummary>
  ): Promise<PromptEvalRunSummary | null>;
  upsertRunItem(runId: string, item: PromptEvalItem): Promise<void>;
  updateRunEvaluation(
    runId: string,
    evaluation: PromptEvalRunEvaluation
  ): Promise<PromptEvalRunDetail | null>;
  updateItemEvaluation(
    runId: string,
    itemId: string,
    evaluation: PromptEvalItemEvaluation
  ): Promise<PromptEvalRunDetail | null>;
  claimEmailNotification?(
    runId: string,
    recipient: string,
    nowMs: number,
    leaseMs?: number
  ): Promise<boolean>;
  deleteRun(runId: string): Promise<boolean>;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  contentBase64: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: EmailAttachment[];
}

export interface EmailNotificationSender {
  readonly providerName: string;
  isConfigured(): boolean;
  getStatus(): PromptEvalEmailConfigStatus;
  send(message: EmailMessage): Promise<void>;
}

export interface CreatePromptEvalRunInput {
  actorUid: string;
  actorEmail: string;
  title?: string;
  modality: PromptEvalModality;
  executionMode: PromptExecutionMode;
  providerId?: string;
  model?: string;
  promptSource: 'catalog' | 'custom';
  catalogId?: string;
  promptParams?: Record<string, string>;
  customPromptText?: string;
  notifyEmail?: string;
  datasetId?: string;
  datasetItems?: PromptEvalDatasetItemRef[];
  files?: Array<{
    originalName: string;
    mimeType: string;
    bytes: Uint8Array;
  }>;
  textInputs?: Array<{
    name?: string;
    text: string;
  }>;
}

export interface PromptEvalStoredDatasetItem extends PromptEvalDatasetItemSummary {
  bytes: Uint8Array;
}

export interface PromptEvalDatasetRepository {
  listDatasets(): Promise<PromptEvalDatasetSummary[]>;
  getDataset(datasetId: string): Promise<PromptEvalDatasetDetail | null>;
  loadDatasetItemBytes(
    datasetId: string,
    itemId: string
  ): Promise<PromptEvalStoredDatasetItem | null>;
}

export interface PromptEvalDatasetStore {
  createDataset(
    dataset: PromptEvalDatasetDetail,
    itemsWithBytes: PromptEvalStoredDatasetItem[]
  ): Promise<PromptEvalDatasetDetail>;
  listDatasets(limit?: number): Promise<PromptEvalDatasetSummary[]>;
  getDataset(datasetId: string): Promise<PromptEvalDatasetDetail | null>;
  loadDatasetItemBytes(
    datasetId: string,
    itemId: string
  ): Promise<PromptEvalStoredDatasetItem | null>;
  deleteDataset(datasetId: string): Promise<boolean>;
}

export interface CreatePromptEvalDatasetInput {
  actorUid: string;
  actorEmail: string;
  name: string;
  description?: string;
  files?: Array<{
    originalName: string;
    mimeType: string;
    bytes: Uint8Array;
  }>;
  sourceItems?: PromptEvalDatasetItemRef[];
}

export interface PromptEvalService {
  getConfig(): PromptEvalConfigResponse;
  getLimits(): PromptEvalLimits;
  resolveCatalogPrompt(
    catalogId: string,
    params: Record<string, string>
  ): ResolvedPromptPreview;
  listDatasets(): Promise<PromptEvalDatasetSummary[]>;
  getDataset(datasetId: string): Promise<PromptEvalDatasetDetail>;
  createDataset(
    input: CreatePromptEvalDatasetInput
  ): Promise<PromptEvalDatasetDetail>;
  deleteDataset(datasetId: string): Promise<void>;
  exportDatasetZip(
    datasetId: string
  ): Promise<{ filename: string; bytes: Uint8Array }>;
  createRun(input: CreatePromptEvalRunInput): Promise<PromptEvalRunDetail>;
  listRuns(limit?: number): Promise<PromptEvalRunSummary[]>;
  getRun(runId: string): Promise<PromptEvalRunDetail>;
  refreshBatchRun(runId: string): Promise<PromptEvalRunDetail>;
  cancelBatchRun(runId: string): Promise<PromptEvalRunDetail>;
  notifyRunByEmail(
    runId: string,
    overrideEmail?: string
  ): Promise<PromptEvalRunDetail>;
  updateRunEvaluation(
    runId: string,
    patch: UpdateRunEvaluationRequest
  ): Promise<PromptEvalRunDetail>;
  updateItemEvaluation(
    runId: string,
    itemId: string,
    patch: UpdateItemEvaluationRequest
  ): Promise<PromptEvalRunDetail>;
  deleteRun(runId: string): Promise<void>;
  pollPendingBatchRuns(): Promise<PollPendingRunsResponse>;
}
