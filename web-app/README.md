# ColoraStoria Web App

React + TypeScript + Tailwind CSS frontend organized with modular interfaces and vendor implementations under `src/modules/`.

## Structure
- `index.html` — HTML entry point (`lang="it"`).
- `vite.config.ts` — Vite + Tailwind v4 configuration outputting to `../dist`.
- `src/App.tsx` — Single-page layout (Hero comparison, Come funziona, live generator, privacy note, footer, Admin panels).
- `src/components/` — Presentational and interactive UI components (`PhotoGeneratorSection`, `AdminTelemetryPanel`, `TempModelCostEstimatorPanel`, etc.).
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
