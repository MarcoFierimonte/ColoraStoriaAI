# AGENTS.md — Modular Template & Engineering Guidelines

This repository uses a **reusable, modular full-stack TypeScript template architecture** across both `backend/` and `web-app/`. Any AI coding agent or human engineer modifying this codebase MUST preserve these structural, dependency, and security conventions.

---

## 1. Core Architectural Principle: Interface vs. Implementation

Every **vendor-backed or swappable** domain capability lives in its own self-contained module under:
- `backend/src/modules/<module-name>/`
- `web-app/src/modules/<module-name>/`

### Rule: Interface Only When Needed
- **Keep `*.interface.ts` + `implementations/`** when multiple providers, external SDKs, or swappable runtime adapters exist (`ai-providers`, `auth`, `database`, `bot-protection`, `media-validation`, `prompts`, and future `payments`/`email`).
- **Keep simple direct typed modules** (no redundant interface/class ceremony) for internal configuration, pure calculation, or shared constants (`config` with Zod startup validation, `cost-estimation`, `shared/config/`).

For interface-backed modules, preserve this strict separation between **contracts** and **concrete adapters**:

```text
modules/<module-name>/
├── <moduleName>.interface.ts          # 1. Pure TS interfaces, DTOs, domain errors, constants
├── implementations/                   # 2. Concrete vendor/runtime adapters
│   └── <vendorImplementation>.ts      #    Implements the interface; uses constructor DI
└── index.ts                           # 3. Barrel export + default wired singleton instance
```

### Mandatory Rules for Modules
1. **No SDK imports in `*.interface.ts` or `shared/`**: Interface files and `shared/` contracts MUST NOT import vendor SDKs (`@google/genai`, `firebase`, `firebase-admin`, `express`, `multer`, `react`, `node:*`, etc.). They declare only pure TypeScript types, interfaces, domain constants, and domain error classes.
2. **Constructor Dependency Injection**: Concrete classes under `implementations/` accept dependencies or configuration in their constructor (with sensible defaults from module singletons when omitted) so implementations can be swapped cleanly and unit-tested offline.
3. **Import Boundary (Enforced by ESLint)**: Features, Express routes, React components, and sibling modules MUST import from `modules/<module-name>/index.ts` (or `<moduleName>.interface.ts` for types). **Do not reach directly into `implementations/`** outside module barrels/implementations. `eslint.config.mjs` enforces `no-restricted-imports` automatically on `npm run lint`.
4. **Shared Cross-Stack Contracts & Limits (`shared/`)**: Types, DTOs, and limits shared between `backend/` and `web-app/` live in `shared/types/` and `shared/config/` (single source of truth for MIME types, 12 MB upload limit, 400 px minimum dimensions, 16 projected book pages, allowed themes, and providers). Neither `backend/` nor `web-app/` may import directly from the other.
5. **Pure Domain UI**: React components (`web-app/src/components/`) and pages (`web-app/src/App.tsx`) depend on hooks/contexts and module interfaces—not directly on `firebase/*`, `fetch` URLs, or `FileReader` boilerplate.

---

## 2. Current Module Inventory

### Backend (`backend/src/modules/`)
| Module | Interface (`*.interface.ts`) | Implementation(s) (`implementations/`) | Responsibility |
| :--- | :--- | :--- | :--- |
| `config` *(simple)* | `envConfig.ts` (`ServerConfig`, `parseServerConfig`) | *(direct Zod module)* | Validates & normalizes server env vars at startup (fails fast) |
| `auth` | `auth.interface.ts` (`AuthTokenVerifier`, `AdminAuthContext`) | `firebaseAdminTokenVerifier.ts` | Verifies optional Bearer ID tokens (`admin` custom claim or `ADMIN_EMAILS`) |
| `bot-protection` | `botProtection.interface.ts` (`BotProtectionVerifier`) | `defaultBotProtectionVerifier.ts` | Anti-bot verification (Cloudflare Turnstile / Firebase App Check) |
| `media-validation` | `mediaValidation.interface.ts` (`ServerMediaValidator`) | `bufferImageValidator.ts` | Server-side JPEG/PNG/WebP magic-bytes & dimension verification |
| `ai-providers` | `aiProvider.interface.ts` (`ColoringProvider`, `AiProviderRegistry`, errors) | `geminiColoringProvider.ts`, `openaiColoringProvider.ts`, `defaultAiProviderRegistry.ts` | Multi-provider AI generation & provider registry |
| `prompts` | `promptRepository.interface.ts` (`PromptRepository`, `PromptBundle`) | `filesystemPromptRepository.ts` | Loads versioned prompts from `prompts/` & `prompts/config.json` |
| `cost-estimation` *(simple)* | `rateCardCostEstimator.ts` (`calculateGenerationCost`) | *(direct typed module)* | Computes token & image generation costs per model (warns on unknown model) |

Delivery layer (`backend/src/routes/coloringRoutes.ts`):
- Exposes `createColoringRouter(deps: ColoringRouterDeps)` accepting injected `{ providers, auth, prompts, botProtection, mediaValidator }` interfaces.
- `backend/server.ts` configures `helmet` CSP (`crossOriginOpenerPolicy: same-origin-allow-popups`), `trust proxy`, global JSON error handler, listen error handling & `SIGTERM`/`SIGINT` graceful shutdown, `/api`, serves Vite middleware only when `NODE_ENV === 'development'`, and uses `app.use(...)` (Express 5-safe) for production SPA fallback.

### Frontend (`web-app/src/modules/`)
| Module | Interface (`*.interface.ts`) | Implementation(s) (`implementations/`) | Responsibility |
| :--- | :--- | :--- | :--- |
| `auth` | `auth.interface.ts` (`AuthProviderGateway`, `AuthContextValue`) | `firebaseAuthGateway.ts` + `AuthContext.tsx` | Google popup login, session sync, DI `AuthProvider` & `useAuth()` |
| `database` | `database.interface.ts` (`GenerationLogRepository`, `GenerationLogRecord`) | `firebaseAppInstance.ts`, `firestoreGenerationLogRepository.ts` | Firestore persistence, schema validation, `handleFirestoreError` |
| `coloring-api` | `coloringApi.interface.ts` (`ColoringApiClient`, `GenerateColoringResult`) | `fetchColoringApiClient.ts` | Typed `/api/*` client + proxy cookie-check detection |
| `media-validation` | `mediaValidation.interface.ts` (`MediaValidator`, `PhotoValidationResult`) | `browserPhotoValidator.ts` | Client-side MIME, file size, and dimension validation |

---

## 3. Recipe: Adding a New Module or Swapping an Adapter

### Adding a New Capability (e.g., `payments/`, `notifications/`, `pdf/`, `job-queue/`)
1. Create `modules/<domain>/<domain>.interface.ts` defining the input/output DTOs and service interface (e.g., `PaymentGateway`, `EmailSender`).
2. Create `modules/<domain>/implementations/<provider>.ts` (e.g., `stripePaymentGateway.ts`, `resendEmailSender.ts`) implementing the interface.
3. Export types, implementation class, and default singleton in `modules/<domain>/index.ts`.
4. Inject the new interface into the route/context constructor (`ColoringRouterDeps`, `AuthProviderProps`, etc.) rather than instantiating vendors inline.
5. Add any required environment variables (names only, never secret values) to `.env.example` and `backend/src/modules/config/`.

### Swapping an Existing Provider or Database (Template Reuse)
- **Swap Database** (e.g., Firestore -> PostgreSQL/Cloud SQL): implement `GenerationLogRepository` in `web-app/src/modules/database/implementations/` (or a backend repository adapter) and update `modules/database/index.ts`. Zero changes needed in UI components.
- **Swap Auth** (e.g., Firebase Auth -> Auth0/Supabase): implement `AuthTokenVerifier` (backend) and `AuthProviderGateway` (frontend) and re-export in each `index.ts`.
- **Add AI Provider** (e.g., Flux/Replicate): implement `ColoringProvider` in `backend/src/modules/ai-providers/implementations/` and register it in `defaultAiProviderRegistry.ts`.

---

## 4. Firebase, Database & Security Standards

- **Never put API keys or secrets in client code or UI**: No settings/API-key forms in `web-app/`. All AI calls proxy through `/api/*`.
- **Firestore Config & Database ID**: Always initialize Firestore with `getFirestore(app, firebaseConfig.firestoreDatabaseId)` from `firebase-applet-config.json` (never assume `(default)`).
- **Connection Test**: Keep `getDocFromServer(doc(db, 'test', 'connection'))` verification inside `firebaseAppInstance.ts`.
- **Error Handling**: Keep structured JSON errors via `handleFirestoreError(err, OperationType, path)` and attach error callbacks to `onSnapshot`.
- **Rules & Blueprint**: Any schema or access change MUST stay synchronized across `firebase-blueprint.json`, `firestore.rules`, and `firestoreGenerationLogRepository.ts`. Validate rules with `npx eslint firestore.rules`.
- **In-Memory Uploads**: Uploaded user photos MUST stay strictly in memory (`multer.memoryStorage()`), never persisted to local disk.
- **Admin Diagnostics**: Detailed provider errors, token telemetry, and overrides MUST remain gated behind `authTokenVerifier.verifyOptionalRequest(req)` (`isAdmin === true`).

---

## 5. Prompts, Pricing & Language Conventions

- **Prompts (`prompts/`)**: Prompts are versioned under `prompts/v*` and selected via `prompts/config.json` (`activeVersion: "latest"` or pinned) or `PROMPT_VERSION`. After editing prompt files, run `npm run prompts:sync`.
- **Pricing (`pricing/`)**: Document model pricing and cost assumptions in `pricing/` and keep rates synchronized with `rateCardCostEstimator.ts`.
- **Technical Wiki (`docs/WIKI.md`)**: **MUST stay up to date.** Whenever you add or remove a library, tool, security layer, module, or architectural pattern, add or update its brief plain-language entry ("Cos'è" + "Come e dov'è usato") in `docs/WIKI.md` (written in accessible Italian for the project owner).
- **Language**:
  - Source code, TypeScript symbols, comments, `AGENTS.md`, and `README.md` files: **English**.
  - `docs/WIKI.md` and end-user UI strings in `web-app/`: **Italian** (unless localized for a new template target).

---

## 6. Verification Checklist Before Finishing Any Change

1. Run `npm run lint` (`tsc --noEmit && eslint .`) — validates TypeScript types, module boundaries (`no-restricted-imports` in `eslint.config.mjs`), and `firestore.rules` security checks in one pass.
2. Run `npm test` — verifies upload magic-bytes validation, Zod config/auth/provider selection, and theme/provider consistency across `shared/config/`, `prompts/`, and `firestore.rules`.
3. Run production bundle check: `npm run build`.
4. Confirm `docs/WIKI.md` is updated if any dependencies, modules, security controls, or architectural choices changed.
5. Ensure the server boots cleanly on port `3000` and `GET /api/health` returns `{ "ok": true }`.
