# ColoraStoria Web App

React + TypeScript + Tailwind CSS frontend organized with modular interfaces and vendor implementations under `src/modules/`.

## Structure
- `index.html` — HTML entry point (`lang="it"`, `theme-color`, `og:image`, `canonical`, no external font CDNs).
- `vite.config.ts` — Vite + Tailwind v4 configuration outputting to `../dist`.
- `src/main.tsx` — Entry point loading self-hosted `@fontsource/plus-jakarta-sans` woff2 fonts.
- `src/styles/theme.css` — Centralized neo-brutalist CSS design tokens (palette, borders, hard offset shadows, container width, font stacks).
- `src/config/siteTemplate.ts` & `src/config/sampleScenes.ts` — Editable data-driven landing/creator copy, examples gallery slots, and 2x procedural canvas sample scenes.
- `src/App.tsx` — Composable SPA layout with real-URL legal routes (`/contatti`, `/privacy`, `/condizioni`, `/recesso`), landing sections, interactive `<ExamplesDialog>` / `<CreatorDialog>`, footer, and Admin telemetry panel.
- `src/components/ui/` & `src/components/sections/` — Reusable neo-brutalist UI primitives (`UiButton`, `UiCard`, `UiChip`, `UiBadge`, `ModalDialog`, `UiToast`) and composable landing sections (`Navbar`, `HeroSection`, `CategoriesSection`, `HowItWorksSection`, `BottomCtaSection`, `SiteFooter`).
- `src/components/` — Interactive application dialogs and domain panels (`CreatorDialog`, `ExamplesDialog`, `LegalPage`, `AdminTelemetryPanel`, `TempModelCostEstimatorPanel`).
- `src/modules/auth/` — `AuthProviderGateway` interface + `FirebaseAuthGateway`, DI `AuthProvider`, and `useAuth()`.
- `src/modules/database/` — `GenerationLogRepository` interface + `firebaseAppInstance` and `FirestoreGenerationLogRepository`.
- `src/modules/coloring-api/` — `ColoringApiClient` interface + `FetchColoringApiClient` (`/api/*` HTTP client + proxy cookie-check handling).
- `src/modules/media-validation/` — `MediaValidator` interface + `BrowserPhotoValidator` (client-side format, size, and resolution checks).

## Development & Build
Run from the repository root:
```bash
npm run dev
npm run build
```
