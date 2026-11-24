# ColoraStoria

Web app that turns personal photos into printable coloring-book pages using a server-side, multi-provider AI backend.

Currently operating in **Phase 1 (Private Beta)** for instant single-page generation and print-ready A4 PDF export, gated by personal invite codes and per-user quotas. See [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) for the versioned product specification and Phase 2 roadmap.

## Repository Layout
- `AGENTS.md` — Engineering guidelines enforcing Interface vs. Implementation module separation and mandatory Wiki/Requirements maintenance.
- `docs/REQUIREMENTS.md` — Versioned Product Requirements Wiki in Italian (`v1.4.0`: Phase 1 active specs, `prompts/v3`, Admin `/admin` console & Prompt/Batch Lab, non-functional security/cost rules, Phase 2 roadmap, and changelog).
- `docs/WIKI.md` — Plain-language Italian technical wiki explaining all tools, libraries, security controls, and architectural choices.
- `shared/` — Cross-stack TypeScript domain contracts (`shared/types/`) and single-source-of-truth limits/modes/themes/ages (`shared/config/`) shared by `backend/` and `web-app/`.
- `packages/` — Generic, host-app agnostic reusable packages for multi-input Prompt & Batch API evaluation (`packages/prompt-eval-core/`, `packages/prompt-eval-backend/`, `packages/prompt-eval-frontend/`).
- `web-app/` — React + TypeScript + Tailwind CSS frontend with a neo-brutalist themeable UI (`theme.css`, `siteTemplate.ts`, `Navbar` burger menu, `CreatorDialog`), dedicated Admin-Only `/admin` console (`AdminPage` hosting `PromptEvalWorkbench`, `AdminInvitesPanel`, and `AdminTelemetryPanel`), domain modules under `web-app/src/modules/`, self-hosted `@fontsource` fonts, and real-URL legal routes (`web-app/README.md`).
- `backend/` — Express + TypeScript API server with domain modules under `backend/src/modules/` (including `beta-access` invite quotas, `print-pdf` A4 mastering, and `prompt-eval` Standard/Batch testing) and Zod startup env validation (`backend/README.md`).
- `tests/` — Native Node test runner suite (`node --test`) verifying upload validation, auth/providers, beta-access quotas/revocation, prompt mode/theme/age combinations, Prompt & Batch Lab flows, PDF export, and config/rules consistency.
- `Dockerfile` & `.dockerignore` — Multi-stage non-root production container (`node:24-slim`).
- `.github/workflows/ci.yml` — Automated CI running `lint`, `test`, `build`, and `npm audit --audit-level=high`.
- `eslint.config.mjs` — Enforces module boundaries (`no-restricted-imports`) and Firestore security rules checks.
- `prompts/` — Versioned prompt library (`v3` active multi-mode/age + `v2`/`v1` baselines) and `config.json` version selector (`prompts/README.md`).
- `pricing/` — AI model cost estimates for Standard and Batch APIs (`pricing/ai/image-generation-costs.md`).
- `infra/` — Infrastructure as Code (Terraform) to automatically provision Cloud Run, Artifact Registry, Secret Manager, Firestore, and Firebase Auth (`infra/README.md`).
- `scripts/` — One-time admin utilities (`set-admin-claim.ts`, `manage-invites.ts`).
- `firebase-blueprint.json` & `firestore.rules` — Firestore schema blueprint and hardened security rules.
- `server.ts` — Root entry point delegating to `backend/server.ts`.
- `.env.example` — Required and optional server-side environment variables.

## Quick Start
```bash
npm install
npm run dev
```

## Environment Variables
Copy `.env.example` or set secrets in Secret Manager / hosting environment:
- `AI_PROVIDER=gemini` (`gemini` or `openai`)
- `PROMPT_VERSION` — Optional override (defaults to `prompts/config.json` `activeVersion: "latest"` -> `v3`)
- `GEMINI_API_KEY` — Required for the default Gemini provider
- `GEMINI_MODEL=gemini-nano-banana-2.1` — Default high-quality raster image model (supports likeness across people, pets, toys, and landscapes)
- `OPENAI_API_KEY` / `OPENAI_MODEL=gpt-image-1` — Optional OpenAI configuration
- `ADMIN_EMAILS` — Optional comma-separated verified Google emails allowed Admin diagnostics & invite management (empty = none; prefer also setting Firebase custom claim `{ admin: true }` via `scripts/set-admin-claim.ts`)
- `BETA_INVITE_REQUIRED=false` — Set `true` to gate generation and PDF export behind personal Firestore invite codes (`beta_invites`) while keeping the landing page public
- `BETA_SESSION_SECRET` — HMAC-SHA256 signing secret (>= 16 chars required in production when `BETA_INVITE_REQUIRED=true`) for `HttpOnly` invite session cookies (`cs_invite`)
- `TURNSTILE_SECRET_KEY` / `VITE_TURNSTILE_SITE_KEY` — Optional free Cloudflare Turnstile anti-bot keys
- `APP_CHECK_ENABLED` — Set `true` if using Firebase App Check instead of Turnstile
- `BOT_PROTECTION_REQUIRED` — Set `true`/`false` to explicitly require or disable anti-bot verification
- `EMAIL_PROVIDER` — Optional free-tier transactional email adapter for Admin Prompt & Batch Lab notifications (`resend` 3,000/mo free, `brevo` 300/day free, or `none`)
- `RESEND_API_KEY` / `BREVO_API_KEY` — Optional API key for the selected `EMAIL_PROVIDER`
- `EMAIL_FROM` — Optional sender address for Prompt & Batch Lab result emails (e.g., `ColoraStoria Prompt Lab <onboarding@resend.dev>`)
- `APP_BASE_URL` — Optional public app URL used to build `/admin?tab=prompt-lab&run=<runId>` deep links inside batch result emails
- `PROMPT_EVAL_CRON_SECRET` — Optional shared secret (`>= 16` chars) authorizing free-tier Cloud Scheduler `POST /api/admin/prompt-eval/poll-pending` requests via `X-Cron-Secret`
- `PROMPT_EVAL_STORE` — Storage adapter for Admin Prompt & Batch Lab runs (`firestore` free tier by default, or `memory` for local dev without GCP credentials)

## Architecture & Product Phases

Solid boxes show **Phase 1 (Implemented & Active in Private Beta)**; dashed grey boxes show **Phase 2 (Future Roadmap)**.

```mermaid
flowchart LR
  subgraph Client["Frontend (web-app/)"]
    Landing["Public Neo-Brutalist Landing<br/>theme.css + siteTemplate.ts + Legal Routes<br/>(Implemented)"]:::done
    Creator["CreatorDialog & ExamplesCarousel<br/>6-Example Hero Slider, Invite Gate, Fedele vs Creativa<br/>A4 PDF (1/2/4-up) & PNG Download<br/>(Implemented)"]:::done
    AdminUI["Admin-Only Console (/admin via Burger Menu)<br/>Prompt & Batch Lab (-50%), Invites Manager<br/>& Cost Telemetry<br/>(Implemented)"]:::done
    BookUI["Multi-Page Book UI (10–15 Photos)<br/>Cover Title & Order Flow<br/>(Phase 2 Roadmap)"]:::pending
  end

  subgraph Firebase["Firebase (Auth & Firestore)"]
    FirebaseAuth["Firebase Auth (Google Popup)<br/>Admin Sign-In<br/>(Implemented)"]:::done
    Firestore["Cloud Firestore + Hardened Rules<br/>beta_invites & prompt_eval_runs (server-only)<br/>+ generation_logs<br/>(Implemented)"]:::done
  end

  subgraph Server["Backend (backend/ + packages/)"]
    BetaGate["beta-access Module<br/>HMAC Cookie + Atomic Quotas & Refunds<br/>(Implemented)"]:::done
    API["Express API (/api/coloring/* & /api/admin/prompt-eval/*)<br/>In-Memory Multer, Sharp Mastering & Batch Lab<br/>(Implemented)"]:::done
    Prompts["Versioned Prompts (prompts/v3)<br/>Fedele Isolation + Creativa Themes & Ages<br/>(Implemented)"]:::done
    JobQueue["Async Book Job Queue &<br/>Post-Beta Monetization / Email<br/>(Phase 2 Roadmap)"]:::pending
  end

  subgraph External["AI Providers & Future Services"]
    Gemini["Google Gemini (gemini-nano-banana-2.1)<br/>Raster / SVG Line-Art Generation<br/>(Active)"]:::done
    OpenAI["OpenAI Image Adapter (gpt-image-1)<br/>(Pre-wired via Env)"]:::done
    Monetization["Post-Beta Payments (Stripe TBD)<br/>& Email Delivery<br/>(Phase 2 Roadmap)"]:::pending
  end

  Landing --> Creator
  Creator -->|"POST photo + mode (+ theme/age)"| API
  AdminUI -->|"signInWithPopup"| FirebaseAuth
  AdminUI -->|"Bearer ID Token + Invite CRUD"| API
  AdminUI -->|"Save & query cost logs"| Firestore
  BookUI -.->|"10–15 photos + book order"| Monetization

  API --> BetaGate
  BetaGate -->|"Atomic tx / revoke check"| Firestore
  API --> Prompts
  API --> Gemini
  API -.->|"Switch via env / admin"| OpenAI
  Monetization -.-> JobQueue

  classDef done fill:#ecfdf5,stroke:#15803d,stroke-width:2px,color:#14532d
  classDef pending fill:#f4f4f5,stroke:#a1a1aa,stroke-width:1.5px,stroke-dasharray:5 5,color:#71717a
```

### Status Summary
- **Implemented (Phase 1 — Private Beta):** Neo-brutalist themeable landing UI (`theme.css`, `siteTemplate.ts`, `Navbar` burger menu, fixed-position 6-example `ExamplesCarousel` hero slider, `CreatorDialog`, 4 procedural canvas samples), real-URL legal routes, **Fedele alla foto** (faithful outlines with zero theme leakage) vs **Creativa** (6 themes + 4 age groups exclusive to creative mode), single-photo validation (`JPG/PNG/WebP/AVIF`) & EXIF/resize (`<=1280px`), print-ready A4 PDF (`1-up`/`2-up`/`4-up` grayscale at 300 DPI) & PNG download, personal Firestore invite access & atomic quotas (`beta-access`), dedicated Admin-Only `/admin` console accessible via the navbar burger menu (hosting reusable `packages/prompt-eval-*` **Prompt & Batch Lab** with Standard vs Batch `-50%` APIs, full prompt inspection/copy, ZIP/single downloads, free-tier Resend/Brevo email notifications, and Firestore-persisted run/item ratings & notes, plus `AdminInvitesPanel` and `AdminTelemetryPanel`), `prompts/v3`, active `gemini-nano-banana-2.1` provider (`OpenAIColoringProvider` ready via env), and full Terraform IaC (`infra/`).
- **Planned for Phase 2 (Future Roadmap):** Multi-page coloring book composition (`10–15` photos + cover), post-beta monetization model to be validated after beta feedback (credit packs / pay-per-page / subscription), async job queue & automated email delivery, and final commercial/legal copy alignment.

## Scripts
- `npm run dev` — Starts Express + Vite dev server (`NODE_ENV=development`) on port `3000`.
- `npm run build` — Builds `web-app/` into `dist/`.
- `npm run start` — Runs the production server (`NODE_ENV=production`) on port `3000`.
- `npm run lint` — Runs TypeScript checks (`tsc --noEmit`) and ESLint architectural & Firestore rules checks (`eslint .`).
- `npm test` — Runs all unit, beta-access, PDF, image validation, prompt combination, and consistency tests (`node --test tests/*.test.ts`).
- `npm run prompts:sync` — Regenerates `manual-test.json` inside every `prompts/v*` folder.

## Deploy on Cloud Run (Terraform Free Tier & Container)

The repository includes full Terraform IaC (`infra/`) and a multi-stage `Dockerfile` (`node:24-slim`, production-only `npm ci --omit=dev`, non-root `USER node`, `PORT=8080`):

1. **Provision with Terraform (`infra/`)**:
   Configures Cloud Run v2 (`min_instances = 0`, `max_instances = 2`, `concurrency = 10`, `512Mi`), Secret Manager (`GEMINI_API_KEY`, `BETA_SESSION_SECRET`, optional `TURNSTILE_SECRET_KEY`), Firestore Native DB, hardened `firestore.rules`, Firebase Web App, Identity Platform, and least-privilege Service Account. See [infra/README.md](infra/README.md).
2. **Build & Roll Out Updates**:
   ```bash
   IMAGE="europe-west1-docker.pkg.dev/<PROJECT_ID>/colorastoria-repo/colorastoria:latest"
   gcloud builds submit --project="<PROJECT_ID>" --region=europe-west1 --tag="$IMAGE" .
   gcloud run services update colorastoria --project="<PROJECT_ID>" --region=europe-west1 --image="$IMAGE"
   ```
3. **Seed Invites & Admin Claim**:
   ```bash
   npx tsx scripts/manage-invites.ts create --label "Marco" --code MARCO-BETA --max 50
   npx tsx scripts/set-admin-claim.ts admin@yourdomain.com
   ```
4. **GCP Console Safety Defaults**:
   Keep billing budget alerts configured, restrict `GEMINI_API_KEY` solely to *Generative Language API*, and restrict the public Firebase Web API key to your Cloud Run / custom domains.
