import {
  FetchPromptEvalClient,
  PromptEvalClientError,
  PromptEvalWorkbench,
  downloadItemOutput,
  downloadRunReportJson,
  downloadRunZipArchive,
  type CreatePromptEvalRunPayload,
  type PromptEvalApiClient,
  type PromptEvalQuickSampleOption,
  type PromptEvalWorkbenchProps,
} from '../../../../packages/prompt-eval-frontend/src/index.ts';

export {
  FetchPromptEvalClient,
  PromptEvalClientError,
  PromptEvalWorkbench,
  downloadItemOutput,
  downloadRunReportJson,
  downloadRunZipArchive,
  type CreatePromptEvalRunPayload,
  type PromptEvalApiClient,
  type PromptEvalQuickSampleOption,
  type PromptEvalWorkbenchProps,
};

export const promptEvalApiClient: PromptEvalApiClient =
  new FetchPromptEvalClient('/api/admin/prompt-eval');
