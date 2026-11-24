# `@colorastoria/prompt-eval-core`

Framework-agnostic TypeScript types, cost estimation helpers, and pure ZIP archive builder shared between `@colorastoria/prompt-eval-backend` and `@colorastoria/prompt-eval-frontend`.

## Guarantees
- Zero runtime dependencies (no Express, React, Firebase, AI SDKs, or `node:*` imports).
- Generic prompt catalog model (`PromptCatalogDefinition`, `PromptCatalogField`, `ResolvedPromptPreview`) that adapts to any host application's prompt combinations without coupling to domain enums.
- Supports both `image` (standard sync API vs async Batch API with configurable discount) and `text` evaluation modalities.
- Includes a pure TypeScript Store-mode ZIP archive generator (`createZipArchive`) usable in both Node.js (email attachments) and browsers (one-click multi-image downloads).
