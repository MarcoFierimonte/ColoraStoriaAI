# ColoraStoria Backend

Express + TypeScript API server organized into self-contained modules with separated interfaces (`*.interface.ts`) and implementations (`implementations/`).

## Structure
- `server.ts` — Express server entry point (mounts `/api/*` and serves `web-app/` via Vite in dev with `hmr: false`, or `dist/` in production using Express 5-safe `app.use(...)`).
- `src/routes/coloringRoutes.ts` — `createColoringRouter(deps)` exposing `GET /api/health`, `GET /api/providers`, `GET /api/admin/session`, and `POST /api/coloring/generate`.
- `src/modules/config/` — `ConfigService` interface + `EnvConfigService` implementation reading environment variables.
- `src/modules/auth/` — `AuthTokenVerifier` interface + `FirebaseAdminTokenVerifier` verifying Bearer ID tokens and `ADMIN_EMAILS`.
- `src/modules/ai-providers/` — `ColoringProvider` & `AiProviderRegistry` interfaces + `GeminiColoringProvider`, `OpenAIColoringProvider`, and `DefaultAiProviderRegistry`.
- `src/modules/prompts/` — `PromptRepository` interface + `FilesystemPromptRepository` loading versioned prompts from `prompts/`.
- `src/modules/cost-estimation/` — `CostEstimator` interface + `StaticRateCardCostEstimator` computing token/image costs.

## Endpoints
- `GET /api/health` — Returns `{ ok: true, promptVersion }`.
- `GET /api/providers` — Lists registered AI providers and whether their server key is configured.
- `GET /api/admin/session` — Verifies optional Bearer token and returns admin capabilities (`promptVersions`, `providers`).
- `POST /api/coloring/generate` — Accepts `multipart/form-data` (`photo`, `theme`, optional admin `provider` and `promptVersion`). Images stay strictly in memory (`multer.memoryStorage()`) and are never written to disk.

## Extending Modules (Template Pattern)
See root `AGENTS.md` for full guidelines:
1. Define the contract in `src/modules/<name>/<name>.interface.ts` (zero vendor imports).
2. Add the concrete adapter in `src/modules/<name>/implementations/`.
3. Export types and default wired instances in `src/modules/<name>/index.ts`.
4. Inject via `ColoringRouterDeps` in `src/routes/coloringRoutes.ts`.
