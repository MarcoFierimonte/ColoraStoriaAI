# ColoraStoria Backend

Express 5 + TypeScript API server organized into self-contained modules with separated interfaces (`*.interface.ts`) and implementations (`implementations/`).

## Structure
- `server.ts` — Express server entry point (`helmet` CSP + `same-origin-allow-popups`, `trust proxy`, global JSON error handler; mounts `/api/*`; serves Vite middleware strictly when `NODE_ENV === 'development'`, otherwise static `dist/`).
- `src/routes/coloringRoutes.ts` — `createColoringRouter(deps)` exposing `GET /api/health`, `GET /api/admin/session`, and rate-limited `POST /api/coloring/generate`.
- `src/modules/config/` — `ConfigService` interface + `EnvConfigService` reading server env vars (no hardcoded admin emails).
- `src/modules/auth/` — `AuthTokenVerifier` interface + `FirebaseAdminTokenVerifier` verifying Firebase ID tokens (`admin` custom claim or `ADMIN_EMAILS`).
- `src/modules/bot-protection/` — `BotProtectionVerifier` interface + `DefaultBotProtectionVerifier` (Cloudflare Turnstile & Firebase App Check).
- `src/modules/media-validation/` — `ServerMediaValidator` interface + `BufferImageValidator` (server-side JPEG/PNG/WebP magic-bytes & minimum 400×400 resolution validation).
- `src/modules/ai-providers/` — `ColoringProvider` & `AiProviderRegistry` interfaces + `GeminiColoringProvider` (maps errors via numeric `error.status`), `OpenAIColoringProvider`, and `DefaultAiProviderRegistry`.
- `src/modules/prompts/` — `PromptRepository` interface + `FilesystemPromptRepository` loading versioned prompts from `prompts/`.
- `src/modules/cost-estimation/` — `CostEstimator` interface + `StaticRateCardCostEstimator` computing token/image costs.

## Endpoints
- `GET /api/health` — Returns `{ ok: true }`.
- `GET /api/admin/session` — Verifies optional Bearer token and returns admin capabilities (`promptVersions`, `providers`) only when `isAdmin === true`.
- `POST /api/coloring/generate` — IP rate-limited + anti-bot protected `multipart/form-data` (`photo`, `theme`, optional admin `provider` and `promptVersion`). Images are validated by magic bytes & pixel dimensions strictly in memory (`multer.memoryStorage()`) and never written to disk.

## Extending Modules (Template Pattern)
See root `AGENTS.md` for full guidelines:
1. Define the contract in `src/modules/<name>/<name>.interface.ts` (zero vendor imports).
2. Add the concrete adapter in `src/modules/<name>/implementations/`.
3. Export types and default wired instances in `src/modules/<name>/index.ts`.
4. Inject via `ColoringRouterDeps` in `src/routes/coloringRoutes.ts`.
