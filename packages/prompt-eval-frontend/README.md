# `@colorastoria/prompt-eval-frontend`

Generic, reusable React workbench and typed API client for testing prompts across multiple images or text inputs with **Standard API** and **Batch API (-50%)** execution modes.

## Exports
- `PromptEvalApiClient` interface & `PromptEvalClientError` (`src/promptEvalClient.interface.ts`)
- `FetchPromptEvalClient` implementation (`src/implementations/fetchPromptEvalClient.ts`)
- `PromptEvalWorkbench` React component (`src/components/PromptEvalWorkbench.tsx`)
- Browser download helpers (`downloadItemOutput`, `downloadRunZipArchive`, `downloadRunReportJson`)
