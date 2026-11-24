export const PROMPT_EVAL_MODALITIES = ['image', 'text'] as const;
export type PromptEvalModality = (typeof PROMPT_EVAL_MODALITIES)[number];

export const PROMPT_EXECUTION_MODES = ['standard', 'batch'] as const;
export type PromptExecutionMode = (typeof PROMPT_EXECUTION_MODES)[number];

export const PROMPT_EVAL_RUN_STATUSES = [
  'queued',
  'running',
  'completed',
  'partial',
  'failed',
  'cancelled',
] as const;
export type PromptEvalRunStatus = (typeof PROMPT_EVAL_RUN_STATUSES)[number];

export const PROMPT_EVAL_ITEM_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
] as const;
export type PromptEvalItemStatus = (typeof PROMPT_EVAL_ITEM_STATUSES)[number];

export const PROMPT_EVAL_VERDICTS = ['pass', 'needs_work', 'fail'] as const;
export type PromptEvalVerdict = (typeof PROMPT_EVAL_VERDICTS)[number];

export const PROMPT_EVAL_NOTIFICATION_STATUSES = [
  'not_requested',
  'pending',
  'sent',
  'failed',
] as const;
export type PromptEvalNotificationStatus =
  (typeof PROMPT_EVAL_NOTIFICATION_STATUSES)[number];

export function isPromptEvalModality(
  value: string
): value is PromptEvalModality {
  return (PROMPT_EVAL_MODALITIES as readonly string[]).includes(value);
}

export function isPromptExecutionMode(
  value: string
): value is PromptExecutionMode {
  return (PROMPT_EXECUTION_MODES as readonly string[]).includes(value);
}

export function isPromptEvalVerdict(
  value: string
): value is PromptEvalVerdict {
  return (PROMPT_EVAL_VERDICTS as readonly string[]).includes(value);
}

export interface PromptCatalogOption {
  value: string;
  label: string;
  description?: string;
}

export interface PromptCatalogVisibilityRule {
  fieldId: string;
  values: string[];
}

export interface PromptCatalogField {
  id: string;
  label: string;
  type: 'select' | 'chips' | 'text';
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  options?: PromptCatalogOption[];
  visibleWhen?: PromptCatalogVisibilityRule;
}

export interface PromptCatalogDefinition {
  id: string;
  label: string;
  description?: string;
  supportedModalities: PromptEvalModality[];
  fields: PromptCatalogField[];
}

export interface ResolvePromptRequest {
  catalogId: string;
  params: Record<string, string>;
}

export interface ResolvedPromptPreview {
  catalogId: string;
  promptText: string;
  label: string;
  params: Record<string, string>;
  metadata: Record<string, string>;
  charCount: number;
  estimatedTokens: number;
}

export interface PromptEvalModelInfo {
  id: string;
  label: string;
  modality: PromptEvalModality;
  outputFormat: 'raster' | 'svg' | 'text';
  supportsStandard: boolean;
  supportsBatch: boolean;
  batchDiscountRatio: number;
  estimatedStandardCostPerItemUsd: number;
  estimatedBatchCostPerItemUsd: number;
  isFreeTier: boolean;
  standardTurnaroundLabel: string;
  batchTurnaroundLabel: string;
  notes?: string;
}

export interface PromptEvalProviderInfo {
  id: string;
  label: string;
  configured: boolean;
  isDefault: boolean;
  supportedModalities: PromptEvalModality[];
  supportsBatch: boolean;
  defaultModel: string;
  models: PromptEvalModelInfo[];
}

export interface PromptEvalUsage {
  inputTokens: number;
  cachedInputTokens: number;
  textOutputTokens: number;
  imageOutputTokens: number;
  estimatedCostUsd: number;
  batchDiscountApplied: boolean;
}

export interface PromptEvalItemEvaluation {
  rating: number | null;
  verdict: PromptEvalVerdict | null;
  notes: string;
  updatedAtMs: number;
}

export interface PromptEvalItem {
  id: string;
  index: number;
  inputName: string;
  inputMimeType?: string;
  inputWidth?: number;
  inputHeight?: number;
  inputText?: string;
  inputThumbnailDataUrl?: string;
  status: PromptEvalItemStatus;
  outputFormat?: 'raster' | 'svg' | 'text';
  outputImageDataUrl?: string;
  outputText?: string;
  errorMessage?: string;
  latencyMs?: number;
  usage?: PromptEvalUsage;
  evaluation?: PromptEvalItemEvaluation;
  completedAtMs?: number;
}

export interface PromptEvalRunEvaluation {
  overallRating: number | null;
  notes: string;
  tags: string[];
  updatedAtMs: number;
}

export interface PromptEvalRunSummary {
  id: string;
  title: string;
  createdByUid: string;
  createdByEmail: string;
  modality: PromptEvalModality;
  executionMode: PromptExecutionMode;
  providerId: string;
  model: string;
  promptSource: 'catalog' | 'custom';
  catalogId?: string | null;
  promptLabel: string;
  promptText: string;
  promptParams: Record<string, string>;
  promptMetadata: Record<string, string>;
  status: PromptEvalRunStatus;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  totalEstimatedCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  externalBatchJobId?: string | null;
  externalBatchState?: string | null;
  notifyEmail?: string | null;
  notificationStatus: PromptEvalNotificationStatus;
  notificationSentAtMs?: number | null;
  notificationError?: string | null;
  evaluation?: PromptEvalRunEvaluation;
  createdAtMs: number;
  updatedAtMs: number;
  completedAtMs?: number | null;
  errorMessage?: string | null;
}

export interface PromptEvalRunDetail extends PromptEvalRunSummary {
  items: PromptEvalItem[];
}

export interface PromptEvalEmailConfigStatus {
  configured: boolean;
  provider: string;
  fromAddress: string | null;
  freeTierSummary: string;
}

export interface PromptEvalLimits {
  maxImagesPerRun: number;
  maxTextInputsPerRun: number;
  maxFileSizeMb: number;
  acceptedMimeTypes: string[];
  acceptedExtensionsLabel: string;
}

export interface PromptEvalConfigResponse {
  providers: PromptEvalProviderInfo[];
  catalogs: PromptCatalogDefinition[];
  emailNotification: PromptEvalEmailConfigStatus;
  limits: PromptEvalLimits;
}

export interface PromptEvalRunsListResponse {
  runs: PromptEvalRunSummary[];
}

export interface PromptEvalRunResponse {
  run: PromptEvalRunDetail;
}

export interface UpdateRunEvaluationRequest {
  overallRating?: number | null;
  notes?: string;
  tags?: string[];
}

export interface UpdateItemEvaluationRequest {
  rating?: number | null;
  verdict?: PromptEvalVerdict | null;
  notes?: string;
}

export interface NotifyRunEmailRequest {
  email?: string;
}

export interface PollPendingRunsResponse {
  checkedCount: number;
  updatedRunIds: string[];
  notifiedRunIds: string[];
}

export function estimateTextTokenCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

export function isTerminalRunStatus(status: PromptEvalRunStatus): boolean {
  return (
    status === 'completed' ||
    status === 'partial' ||
    status === 'failed' ||
    status === 'cancelled'
  );
}
