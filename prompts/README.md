# ColoraStoria Prompts

Versioned prompt library loaded by `backend/src/modules/prompts/` (`FilesystemPromptRepository`).

## Configuration (`config.json`)
- `"activeVersion": "latest"` — Automatically selects the highest version in `"versions"` (currently `v2`).
- `"activeVersion": "v2"` (or `"v1"`) — Pins a specific version.
- Can also be overridden via the `PROMPT_VERSION` environment variable or the Admin selector without changing files.

## Files Inside `v2/` (Current Active Version)
- `base.txt` — Strict likeness rules covering both **people** (exact count, faces, hair, glasses, expressions, child proportions) and **animals, toys, objects, or landscapes** (preserving real species/details without inventing extra people), plus printable pure B&W outline rules.
- `modes.json` — Per-mode instructions (`fedele` vs `creativa`):
  - `fedele`: Strict faithful translation of the photo; forbids any fantasy theme, costumes, or invented elements (and never appends `themes.json` or `ages.json`).
  - `creativa`: Keeps main subject likeness intact while surrounding the scene with the chosen theme.
- `themes.json` — The 6 fantasy blocks (`pirati`, `unicorni`, `draghi`, `spazio`, `dinosauri`, `principessa`), used exclusively in `creativa` mode and phrased so themed outfits apply only when people appear in the photo.
- `ages.json` — Line weight & detail complexity instructions for the 4 age groups (`1-2`, `3-4`, `5-7`, `8+`), applied exclusively in `creativa` mode.
- `svg-adapter.txt` — SVG formatting instructions appended only for SVG-mode models.
- `manual-test.json` — Auto-generated reference JSON built by `npm run prompts:sync`.

## Files Inside `v1/` (Legacy Baseline)
- Contains the initial `base.txt`, `themes.json`, `svg-adapter.txt`, and `manual-test.json`. If selected by Admin override in `fedele` mode, `FilesystemPromptRepository` strips any theme cue and applies a faithful-photo fallback instruction.

## Adding a New Version (e.g. `v3`)
1. Copy `prompts/v2/` to `prompts/v3/`.
2. Edit files inside `prompts/v3/`.
3. Run `npm run prompts:sync` to regenerate `manual-test.json` across all versions.
4. Add `"v3"` to `"versions"` in `prompts/config.json` and run `npm test` (verifies `consistency.test.ts` and `prompt-combinations.test.ts`).
