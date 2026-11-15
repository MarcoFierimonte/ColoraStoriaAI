# ColoraStoria Backend

Express + TypeScript API server for converting an uploaded photo into a coloring-book page through a pluggable AI provider layer and versioned prompts.

## Structure
- `server.ts` — Express server entry point (mounts `/api/*` and serves `web-app/` via Vite in dev or `dist/` in production).
- `src/config/env.ts` — Environment configuration (`AI_PROVIDER`, `PROMPT_VERSION`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENAI_API_KEY`, `OPENAI_MODEL`).
- `src/utils/prompts.ts` — Loads prompts from `prompts/` according to `prompts/config.json` (defaults to `latest` or pins a specific version).
- `src/providers/types.ts` — Shared `ColoringProvider` interface.
- `src/providers/geminiProvider.ts` — `@google/genai` adapter (defaults to free-tier `gemini-4-hydrogen` SVG mode; supports raster image models when configured).
- `src/providers/openaiProvider.ts` — Ready-to-enable OpenAI `/v1/images/edits` adapter.
- `src/routes/coloringRoutes.ts` — `GET /api/health`, `GET /api/providers`, `POST /api/coloring/generate`.

## Endpoints
- `GET /api/health` — Returns `{ ok: true, promptVersion }`.
- `GET /api/providers` — Lists registered AI providers and whether their server key is configured.
- `POST /api/coloring/generate` — Accepts `multipart/form-data` (`photo`, `theme`, optional `provider`). Images stay strictly in memory for the duration of the request and are never written to disk.

## Adding a New Provider
1. Implement `ColoringProvider` from `src/providers/types.ts`.
2. Register the adapter in `src/providers/index.ts`.
3. Add its environment variables to `.env.example` and `src/config/env.ts`.
