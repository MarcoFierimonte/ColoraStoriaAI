# ColoraStoria Backend

Express 5 + TypeScript API server organized into self-contained modules with separated interfaces (`*.interface.ts`) and implementations (`implementations/`).

## Structure
- `server.ts` — Express server entry point (`helmet` CSP + `same-origin-allow-popups`, `trust proxy`, global JSON error handler, listen error handling + `SIGTERM`/`SIGINT` graceful shutdown; mounts `/api/*`; serves Vite middleware strictly when `NODE_ENV === 'development'`, otherwise static `dist/`).
- `src/routes/coloringRoutes.ts` — `createColoringRouter(deps)` exposing `GET /api/health`, `GET /api/admin/session`, rate-limited `POST /api/coloring/generate`, and `POST /api/coloring/export-pdf`.
- `src/modules/config/` — Zod-validated `serverConfig` module (`envConfig.ts`) failing fast on invalid startup env vars (no hardcoded admin emails).
- `src/modules/auth/` — `AuthTokenVerifier` interface + `FirebaseAdminTokenVerifier` verifying Firebase ID tokens (`admin` custom claim or `ADMIN_EMAILS`).
- `src/modules/bot-protection/` — `BotProtectionVerifier` interface + `DefaultBotProtectionVerifier` (Cloudflare Turnstile & Firebase App Check).
- `src/modules/media-validation/` — `ServerMediaValidator` interface + `BufferImageValidator` (JPG/PNG/WebP/AVIF magic-bytes validation + `sharp` EXIF stripping & `<=1280px` resize before AI calls).
- `src/modules/print-pdf/` — `PrintPdfGenerator` interface + `SharpPdfLibGenerator` (`sharp` B&W print mastering at 300 DPI grayscale + `pdf-lib` A4 `1-up`/`2-up`/`4-up` layout).
- `src/modules/ai-providers/` — `ColoringProvider` & `AiProviderRegistry` interfaces + `GeminiColoringProvider` (maps errors via numeric `error.status`), `OpenAIColoringProvider`, and `DefaultAiProviderRegistry`.
- `src/modules/prompts/` — `PromptRepository` interface + `FilesystemPromptRepository` loading versioned prompts from `prompts/`.
- `src/modules/cost-estimation/` — `calculateGenerationCost` (`rateCardCostEstimator.ts`) computing token/image costs and logging a warning for unmapped models.

## Endpoints
- `GET /api/health` — Returns `{ ok: true }`.
- `GET /api/admin/session` — Verifies optional Bearer token and returns admin capabilities (`promptVersions`, `providers`) only when `isAdmin === true`.
- `POST /api/coloring/generate` — IP rate-limited + anti-bot protected `multipart/form-data` (`photo`, `theme`, optional admin `provider` and `promptVersion`). Images are validated by magic bytes, stripped of EXIF/GPS & resized (`<=1280px`) strictly in memory (`multer.memoryStorage()`), and never written to disk.
- `POST /api/coloring/export-pdf` — Accepts `{ imageDataUrl, layout }` (`1-up` | `2-up` | `4-up`) and returns a 300 DPI grayscale print-ready A4 PDF (`application/pdf`) with 12 mm safe margins and cut guides.

## Extending Modules (Template Pattern)
See root `AGENTS.md` for full guidelines:
1. Define the contract in `src/modules/<name>/<name>.interface.ts` (zero vendor imports).
2. Add the concrete adapter in `src/modules/<name>/implementations/`.
3. Export types and default wired instances in `src/modules/<name>/index.ts`.
4. Inject via `ColoringRouterDeps` in `src/routes/coloringRoutes.ts`.
