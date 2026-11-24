import type {
  NotifyRunEmailRequest,
  PollPendingRunsResponse,
  PromptEvalConfigResponse,
  PromptEvalDatasetDetail,
  PromptEvalDatasetItemRef,
  PromptEvalDatasetSummary,
  PromptEvalModality,
  PromptEvalRunDetail,
  PromptEvalRunSummary,
  PromptExecutionMode,
  ResolvedPromptPreview,
  UpdateItemEvaluationRequest,
  UpdateRunEvaluationRequest,
} from '../../prompt-eval-core/src/index.ts';

export class PromptEvalClientError extends Error {
  readonly statusCode: number;
  readonly code?: string;
  readonly details?: string;

  constructor(
    message: string,
    statusCode: number,
    code?: string,
    details?: string
  ) {
    super(message);
    this.name = 'PromptEvalClientError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export interface CreatePromptEvalDatasetPayload {
  name: string;
  description?: string;
  files?: File[];
  sourceItems?: PromptEvalDatasetItemRef[];
}

export interface CreatePromptEvalRunPayload {
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
  files?: File[];
  textInputs?: Array<{ name?: string; text: string }>;
}

export interface PromptEvalApiClient {
  fetchConfig(idToken: string | null): Promise<PromptEvalConfigResponse>;
  resolveCatalogPrompt(
    catalogId: string,
    params: Record<string, string>,
    idToken: string | null
  ): Promise<ResolvedPromptPreview>;
  listDatasets(idToken: string | null): Promise<PromptEvalDatasetSummary[]>;
  getDataset(
    datasetId: string,
    idToken: string | null
  ): Promise<PromptEvalDatasetDetail>;
  createDataset(
    payload: CreatePromptEvalDatasetPayload,
    idToken: string | null
  ): Promise<PromptEvalDatasetDetail>;
  deleteDataset(datasetId: string, idToken: string | null): Promise<void>;
  exportDatasetArchive(
    datasetId: string,
    idToken: string | null
  ): Promise<{ blob: Blob; filename: string }>;
  listRuns(
    idToken: string | null,
    limit?: number
  ): Promise<PromptEvalRunSummary[]>;
  getRun(runId: string, idToken: string | null): Promise<PromptEvalRunDetail>;
  createRun(
    payload: CreatePromptEvalRunPayload,
    idToken: string | null
  ): Promise<PromptEvalRunDetail>;
  refreshBatchRun(
    runId: string,
    idToken: string | null
  ): Promise<PromptEvalRunDetail>;
  cancelBatchRun(
    runId: string,
    idToken: string | null
  ): Promise<PromptEvalRunDetail>;
  notifyRunByEmail(
    runId: string,
    body: NotifyRunEmailRequest,
    idToken: string | null
  ): Promise<PromptEvalRunDetail>;
  updateRunEvaluation(
    runId: string,
    patch: UpdateRunEvaluationRequest,
    idToken: string | null
  ): Promise<PromptEvalRunDetail>;
  updateItemEvaluation(
    runId: string,
    itemId: string,
    patch: UpdateItemEvaluationRequest,
    idToken: string | null
  ): Promise<PromptEvalRunDetail>;
  deleteRun(runId: string, idToken: string | null): Promise<void>;
  pollPendingBatchRuns(
    idToken: string | null
  ): Promise<PollPendingRunsResponse>;
}
