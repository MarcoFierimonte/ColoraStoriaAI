# ColoraStoria Backend

Express 5 + TypeScript API server organized into self-contained modules with separated interfaces (`*.interface.ts`) and implementations (`implementations/`).

## Structure
- `server.ts` — Express server entry point (`helmet` CSP + `same-origin-allow-popups`, `trust proxy`, global JSON error handler, background Batch API poller, listen error handling + `SIGTERM`/`SIGINT` graceful shutdown; mounts `/api/admin/prompt-eval` and `/api/*`; serves Vite middleware strictly when `NODE_ENV === 'development'`, otherwise static `dist/`).
- `src/routes/coloringRoutes.ts` — `createColoringRouter(deps)` exposing health, beta invite session/redeem/logout, admin invite management, rate-limited `POST /api/coloring/generate`, and `POST /api/coloring/export-pdf`.
- `src/modules/config/` — Zod-validated `serverConfig` module (`envConfig.ts`) failing fast on invalid startup env vars and normalizing placeholder Turnstile `"none"` values.
- `src/modules/auth/` — `AuthTokenVerifier` interface + `FirebaseAdminTokenVerifier` verifying Firebase ID tokens (`admin` custom claim or `ADMIN_EMAILS`).
- `src/modules/beta-access/` — `BetaAccessService` & `BetaInviteStore` interfaces + `DefaultBetaAccessService`, `FirestoreBetaInviteStore`, and `InMemoryBetaInviteStore` handling HMAC-signed `HttpOnly` invite session cookies (`cs_invite`), atomic generation quota reservations/refunds, expiration, revocation, and Admin CRUD.
- `src/modules/bot-protection/` — `BotProtectionVerifier` interface + `DefaultBotProtectionVerifier` (Cloudflare Turnstile & Firebase App Check).
- `src/modules/media-validation/` — `ServerMediaValidator` interface + `BufferImageValidator` (JPG/PNG/WebP/AVIF magic-bytes validation + `sharp` EXIF stripping & `<=1280px` resize before AI calls).
- `src/modules/print-pdf/` — `PrintPdfGenerator` interface + `SharpPdfLibGenerator` (`sharp` B&W print mastering at 300 DPI grayscale + `pdf-lib` A4 `1-up`/`2-up`/`4-up` layout).
- `src/modules/ai-providers/` — `ColoringProvider` & `AiProviderRegistry` interfaces + `GeminiColoringProvider` (maps errors via numeric `error.status`), `OpenAIColoringProvider`, and `DefaultAiProviderRegistry`.
- `src/modules/prompts/` — `PromptRepository` interface + `FilesystemPromptRepository` loading versioned prompts (`v2` multi-mode/age + `v1` fallback) from `prompts/`.
- `src/modules/prompt-eval/` — Host-app adapter for the reusable `packages/prompt-eval-backend/` package (`ColoraStoriaPromptCatalogResolver` exposing `v1`/`v2` + `fedele`/`creativa` combinations, `SharpPromptEvalMediaPreparer` for magic-bytes validation/thumbnails/Firestore-safe output compression, free-tier Firestore/Resend/Brevo wiring, and `createColoraStoriaPromptEvalRouter()`).
- `src/modules/cost-estimation/` — `calculateGenerationCost` (`rateCardCostEstimator.ts`) computing token/image costs and logging a warning for unmapped models.

## Endpoints
- `GET /api/health` — Returns `{ ok: true }`.
- `GET /api/access/session` — Returns `{ inviteRequired, hasAccess, accessSource, invite }` based on Admin Bearer token or live Firestore state of the `cs_invite` cookie.
- `POST /api/access/redeem` — Validates a beta invite code and sets the signed `HttpOnly` `cs_invite` cookie.
- `POST /api/access/logout` — Clears the `cs_invite` cookie.
- `GET /api/admin/session` — Verifies optional Bearer token and returns admin capabilities (`promptVersions`, `providers`) only when `isAdmin === true`.
- `GET / POST / PATCH / DELETE /api/admin/invites` — Admin-only endpoints to list, create, update quota/status, and delete beta invites.
- `GET /api/admin/prompt-eval/config` — Admin-only configuration for Prompt & Batch Lab (providers/models, catalog definitions, email free-tier status, upload limits).
- `POST /api/admin/prompt-eval/catalog/resolve` — Admin-only full prompt preview resolver for selected app combinations (`v1`/`v2`, `fedele`/`creativa`, theme, age, format).
- `GET / POST /api/admin/prompt-eval/runs` — Admin-only list of saved runs and creation of multi-image (`multipart/form-data`, in-memory) or text runs in `standard` or `batch` (`-50%`) mode.
- `GET / DELETE /api/admin/prompt-eval/runs/:runId` — Admin-only run detail (including per-item outputs/notes) and deletion.
- `POST /api/admin/prompt-eval/runs/:runId/refresh`, `/cancel`, `/notify` — Admin-only async Batch status poll, cancellation, and manual/re-send free-tier email delivery with ZIP attachment.
- `PATCH /api/admin/prompt-eval/runs/:runId/evaluation` & `/runs/:runId/items/:itemId/evaluation` — Admin-only persistence of run-level and per-item ratings, verdicts, tags, and notes.
- `POST /api/admin/prompt-eval/poll-pending` — Rate-limited (`60 / 15 min` per IP) endpoint authorized by Admin Bearer token OR timing-safe `X-Cron-Secret` header for free-tier Cloud Scheduler batch polling & email dispatch.
- `POST /api/coloring/generate` — Beta-invite gated, IP rate-limited & optional anti-bot protected `multipart/form-data` (`photo`, `mode`, creative-only `theme` & `ageGroup`, optional admin `provider` & `promptVersion`). In `fedele` mode, any `theme` or `ageGroup` is stripped so fantasy themes never leak. Reserves invite quota atomically and refunds on AI failure. Photos stay strictly in RAM (`multer.memoryStorage()`).
- `POST /api/coloring/export-pdf` — Invite-gated & rate-limited (`imageDataUrl`, `layout`: `1-up` | `2-up` | `4-up`) returning a 300 DPI grayscale A4 PDF (permitted even at `0` remaining credits if the invite is active and unexpired).

## Extending Modules (Template Pattern)
See root `AGENTS.md` and `docs/REQUIREMENTS.md`:
1. Define the contract in `src/modules/<name>/<name>.interface.ts` (zero vendor imports).
2. Add the concrete adapter in `src/modules/<name>/implementations/`.
3. Export types and default wired instances in `src/modules/<name>/index.ts`.
4. Inject via `ColoringRouterDeps` in `src/routes/coloringRoutes.ts`.
