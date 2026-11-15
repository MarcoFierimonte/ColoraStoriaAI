# ColoraStoria Prompts

Versioned prompt library used by `backend/src/utils/prompts.ts`.

## Configuration (`config.json`)
- `"activeVersion": "latest"` — Automatically selects the highest version in `"versions"` (e.g. `v2` over `v1`).
- `"activeVersion": "v1"` — Pins a specific version.
- Can also be overridden via the `PROMPT_VERSION` environment variable without changing files.

## Adding a New Version (e.g. `v2`)
1. Copy `prompts/v1/` to `prompts/v2/`.
2. Edit `base.txt`, `themes.json`, or `svg-adapter.txt` inside `prompts/v2/`.
3. Add `"v2"` to `"versions"` in `prompts/config.json`.
