# ColoraStoria Web App

React 19 + TypeScript + Tailwind CSS v4 frontend organized with centralized neo-brutalist design tokens, templateable configuration, reusable UI primitives, and modular interfaces under `src/modules/`.

## Structure
- `index.html` — HTML entry point (`lang="it"`, `viewport-fit=cover`, `theme-color`, `og:image`, `canonical`, no external font CDNs).
- `vite.config.ts` — Vite + Tailwind v4 configuration outputting to `../dist`.
- `src/main.tsx` — Entry point loading self-hosted `@fontsource/plus-jakarta-sans` woff2 fonts.
- `src/styles/theme.css` & `src/styles/main.css` — Centralized neo-brutalist CSS design tokens (`--cs-*` palette, 3px borders, hard offset shadows, container width) and Tailwind v4 layer utilities/dialog rules.
- `src/config/siteTemplate.ts`, `src/config/sampleScenes.ts`, & `src/config/generationPayload.ts` — Editable landing/creator copy, example gallery slots, 2× procedural `<canvas>` sample scenes (`1120×1584 px`), and pure UI-to-API request mapping (ensuring `fedele` mode omits `theme` and `ageGroup`).
- `src/App.tsx` — Composable SPA layout with real-URL legal routes (`/contatti`, `/privacy`, `/condizioni`, `/recesso`), `?invite=` auto-redeem handler, hero with fixed-slot `<ExamplesCarousel>`, landing sections, `<CreatorDialog>`, footer (`Area riservata`), and Admin panels.
- `src/components/ui/` & `src/components/sections/` — Reusable neo-brutalist primitives (`UiButton`, `UiCard`, `UiChip`, `UiBadge`, `ModalDialog`, `UiToast`) and composable landing sections (including fixed-footprint horizontal slider `ExamplesCarousel`).
- `src/components/` — Domain dialogs and Admin panels (`CreatorDialog`, `LegalPage`, `AdminInvitesPanel`, `AdminTelemetryPanel`, `TempModelCostEstimatorPanel`).
- `src/modules/auth/` — `AuthProviderGateway` interface + `FirebaseAuthGateway`, DI `AuthProvider`, and `useAuth()`.
- `src/modules/beta-access/` — `BetaAccessClient` interface + `FetchBetaAccessClient` for invite session status, code redemption, logout, and Admin invite CRUD.
- `src/modules/database/` — `GenerationLogRepository` interface + `firebaseAppInstance` and `FirestoreGenerationLogRepository`.
- `src/modules/coloring-api/` — `ColoringApiClient` interface + `FetchColoringApiClient` (`/api/*` HTTP client + proxy cookie-check handling).
- `src/modules/media-validation/` — `MediaValidator` interface + `BrowserPhotoValidator` (client-side format, size, and resolution checks).

## Development & Build
Run from the repository root:
```bash
npm run dev
npm run build
```
