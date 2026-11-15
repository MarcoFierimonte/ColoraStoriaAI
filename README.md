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

## Scripts
- `npm run dev` — Starts Express + Vite dev server on port `3000`.
- `npm run build` — Builds `web-app/` into `dist/`.
- `npm run start` — Runs the production server on port `3000`.
- `npm run lint` — Runs TypeScript checks (`tsc --noEmit`).
