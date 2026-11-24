# `@colorastoria/prompt-eval-backend`

Generic, reusable backend package for running, persisting, notifying, and evaluating prompt tests across multiple images or text inputs using **Standard (sync)** or **Batch (async, -50%)** AI APIs.

## Architecture
- `src/promptEval.interface.ts`: Framework-agnostic interfaces (`PromptCatalogResolver`, `PromptExecutionProvider`, `PromptEvalStore`, `EmailNotificationSender`, `PromptEvalMediaPreparer`, `PromptEvalService`) and `PromptEvalError`.
- `src/implementations/`:
  - `geminiPromptEvalProvider.ts`: Google Gemini Standard (`models.generateContent`) and Batch API (`batches.create`, `batches.get`, `batches.cancel`) supporting both inline batches and Files API JSONL fallback.
  - `openaiPromptEvalProvider.ts`: OpenAI Standard (`/v1/images/edits`, `/v1/chat/completions`) and Batch API (`/v1/files` + `/v1/batches`, -50%).
  - `firestorePromptEvalStore.ts` & `inMemoryPromptEvalStore.ts`: Run & per-item subcollection persistence (free-tier Firestore friendly, keeping each item in its own subcollection document).
  - `emailSenders.ts`: Free-tier transactional email adapters (`ResendEmailSender` 3,000/mo free, `BrevoEmailSender` 300/day free, `NoopEmailSender`) with optional ZIP result attachments.
  - `defaultPromptEvalService.ts`: Orchestrator for runs, batch polling, idempotent email notifications, and run/item evaluations.
- `src/router.ts`: Express router factory (`createPromptEvalRouter`) with injected admin authorization and in-memory `multer` uploads.
