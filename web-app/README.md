# ColoraStoria Web App

React + TypeScript + Tailwind CSS frontend for ColoraStoria, located in `web-app/`.

## Structure
- `index.html` — HTML entry point (`lang="it"`).
- `vite.config.ts` — Vite + Tailwind v4 configuration outputting to `../dist`.
- `src/App.tsx` — Single-page layout (Hero comparison, Come funziona, live photo-to-coloring generator, privacy note, footer).
- `src/components/PhotoGeneratorSection.tsx` — Theme selection, single photo upload/validation, provider selector, result preview, and PNG/SVG download.
- `src/services/coloringApi.ts` — HTTP client communicating with `/api/providers` and `/api/coloring/generate`.

## Development & Build
Run from the repository root:
```bash
npm run dev
npm run build
```
