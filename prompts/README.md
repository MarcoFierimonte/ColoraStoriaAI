# ColoraStoria Prompts

Versioned prompt library used by `backend/src/utils/prompts.ts`.

## Configuration (`config.json`)
- `"activeVersion": "latest"` — Automatically selects the highest version in `"versions"` (e.g. `v2` over `v1`).
- `"activeVersion": "v1"` — Pins a specific version.
- Can also be overridden via the `PROMPT_VERSION` environment variable without changing files.

## Files Inside Each Version Folder (e.g. `v1/`)
- `base.txt` — Fixed likeness and coloring-book output instructions.
- `themes.json` — Per-style blocks (`pirati`, `unicorni`, `draghi`, `spazio`, `dinosauri`, `principessa`).
- `svg-adapter.txt` — SVG formatting instructions appended only for SVG-mode models.
- `manual-test.json` — Ready-to-copy JSON containing `base.txt + theme` for each style for manual testing.

## Adding a New Version (e.g. `v2`)
1. Copy `prompts/v1/` to `prompts/v2/`.
2. Edit `base.txt`, `themes.json`, or `svg-adapter.txt` inside `prompts/v2/`.
3. Run `npm run prompts:sync` to regenerate `manual-test.json` across all versions.
4. Add `"v2"` to `"versions"` in `prompts/config.json`.
