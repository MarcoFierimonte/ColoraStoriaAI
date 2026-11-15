# ColoraStoria

Web app that turns personal photos into printable coloring-book pages using a server-side, multi-provider AI backend.

## Repository Layout
- `web-app/` — React + TypeScript + Tailwind CSS frontend (`web-app/README.md`).
- `backend/` — Express + TypeScript API server with pluggable AI providers (`backend/README.md`).
- `prompts/` — Versioned prompt library and `config.json` version selector (`prompts/README.md`).
- `server.ts` — Root entry point delegating to `backend/server.ts`.
- `.env.example` — Required server-side environment variables.

## Quick Start
```bash
npm install
npm run dev
```

## Environment Variables
Copy `.env.example` or set secrets in your hosting environment:
- `AI_PROVIDER=gemini` (`gemini` or `openai`)
- `PROMPT_VERSION` — Optional override (defaults to `prompts/config.json` `activeVersion: "latest"`)
- `GEMINI_API_KEY` — Required for the default Gemini provider
- `GEMINI_MODEL=gemini-4-hydrogen` — Free tier default model
- `OPENAI_API_KEY` / `OPENAI_MODEL=gpt-image-1` — Optional OpenAI configuration

## Architecture & MVP Roadmap

Solid boxes show what is **implemented and active** today; dashed grey boxes show what is **still pending for the full MVP**.

```mermaid
flowchart LR
  subgraph Client["Frontend (web-app/)"]
    UI["Landing Page + 6 Fixed Themes<br/>Single Photo Upload & PNG Download<br/>(Implemented)"]:::done
    MultiUI["10–15 Photo Upload, Reordering,<br/>Cover Title & 3 Legal Checkboxes<br/>(Pending MVP)"]:::pending
  end

  subgraph Server["Backend (backend/)"]
    API["Express API (/api/coloring/generate)<br/>In-Memory Multer Upload<br/>(Implemented)"]:::done
    Prompts["Versioned Prompts (prompts/v1)<br/>config.json: latest / pinned<br/>(Implemented)"]:::done
    JobQueue["Async Book Job Queue &<br/>Auto Photo Cleanup<br/>(Pending MVP)"]:::pending
    PDF["A4 PDF Book Composer<br/>Cover + 10–15 Pages<br/>(Pending MVP)"]:::pending
  end

  subgraph External["External Services & AI Providers"]
    GeminiFree["Google Gemini (gemini-4-hydrogen)<br/>Free Tier SVG Line-Art<br/>(Active)"]:::done
    RasterAI["Raster Image Model<br/>(gemini-nano-banana-2.1 / gpt-image-1)<br/>(Adapter Ready · Needs Billing Key)"]:::pending
    Stripe["Stripe Checkout + Webhook<br/>Order Payment<br/>(Pending MVP)"]:::pending
    Email["Email Delivery (Resend / SMTP)<br/>Send PDF to Customer<br/>(Pending MVP)"]:::pending
  end

  UI -->|"POST 1 photo + theme"| API
  MultiUI -.->|"POST 10–15 photos + metadata"| Stripe
  API --> Prompts
  API --> GeminiFree
  API -.->|"Switch via env"| RasterAI
  Stripe -.->|"Payment confirmed"| JobQueue
  JobQueue -.-> RasterAI
  JobQueue -.-> PDF
  PDF -.-> Email

  classDef done fill:#ecfdf5,stroke:#15803d,stroke-width:2px,color:#14532d
  classDef pending fill:#f4f4f5,stroke:#a1a1aa,stroke-width:1.5px,stroke-dasharray:5 5,color:#71717a
```

### Status Summary
- **Implemented:** Single-page landing UI, 6 fixed themes, single-photo validation & upload, Express backend in `backend/`, versioned prompt library in `prompts/` (`v1`), PNG export, and active free-tier `gemini-4-hydrogen` generation (`OpenAIColoringProvider` & Gemini raster mode pre-wired via env).
- **Pending for Final MVP:** Multi-photo upload (`10–15` photos with reorder), custom cover title, email input & 3 mandatory legal checkboxes, Stripe Checkout + webhook verification, billing-enabled raster image model for high facial likeness, A4 PDF generation, automated email delivery, and order confirmation screen.

## Scripts
- `npm run dev` — Starts Express + Vite dev server on port `3000`.
- `npm run build` — Builds `web-app/` into `dist/`.
- `npm run start` — Runs the production server on port `3000`.
- `npm run lint` — Runs TypeScript checks (`tsc --noEmit`).
- `npm run prompts:sync` — Regenerates `manual-test.json` inside every `prompts/v*` folder.

