# ColoraStoria Prompts

Versioned prompt library loaded by `backend/src/modules/prompts/` (`FilesystemPromptRepository`).

## Configuration (`config.json`)
- `"activeVersion": "latest"` — Automatically selects the highest version in `"versions"` (currently `v3`).
- `"activeVersion": "v3"` (or `"v2"` / `"v1"`) — Pins a specific version.
- Can also be overridden via the `PROMPT_VERSION` environment variable, the Admin `CreatorDialog` selector, or the `/admin` Prompt & Batch Lab catalog selector without changing files.

## Files Inside `v3/` (Current Active Version)
- `base.txt` — High-fidelity subject likeness rules across **people** (exact count, facial structure, real unforced expression, hair, glasses, real worn caps/headbands, toddler/child proportions, omitting blurry background strangers), **animals & pets** (breed silhouette and closed coat color-patch boundaries without black fills), **toys, plushies, dolls & vehicles** (simplified hand-drawn toy outline with strict removal of retail cardboard boxes, blister packs, hangtags, barcodes, brand logos, and printed letters/numbers, drawing standalone toys only once), and **landscapes**, paired with pure `#000000` on `#FFFFFF` printable line-art rules (zero grey strokes, zero stippling/hatching, open white regions with eye catchlights, smooth texture grouping, and grounded `3:4` A4 composition).
- `modes.json` — Per-mode instructions (`fedele` vs `creativa`):
  - `fedele`: Translates only the real subject(s), pose, clothing, and essential setting into child-friendly coloring outlines; replaces messy indoor/packaging clutter with clean white space while simplifying meaningful outdoor settings into subordinate black outlines, and strictly forbids any fantasy themes or props.
  - `creativa`: Keeps the main subject(s) 100% recognizable as the grounded foreground hero (`55-75%` height), **preserving real worn glasses, baseball caps, bows, or headbands from the photo** while forbidding newly invented helmets/hats/crowns/masks on heads, staging pets/toys naturally without human clothes, and scaling prop density to `AGE COMPLEXITY`.
- `themes.json` — The 6 creative worlds (`pirati`, `unicorni`, `draghi`, `spazio`, `dinosauri`, `principessa`), defining foreground grounding + core iconic elements + optional secondary storybook details scaled by `ages.json`.
- `ages.json` — Concrete stroke weight, shape size, and background prop-count rules for `1-2`, `3-4`, `5-7`, and `8+` (applied exclusively in `creativa` mode).
- `svg-adapter.txt` — SVG formatting instructions reserved for SVG-capable adapters.
- `manual-test.json` — Auto-generated reference JSON built by `npm run prompts:sync`.

## Files Inside `v2/` & `v1/` (Previous Baselines Kept for A/B Comparison)
- `v2/` — First multi-mode (`modes.json`) & age-grouped (`ages.json`) prompt set, selectable in Admin for direct A/B comparison against `v3`.
- `v1/` — Initial legacy baseline (`base.txt`, `themes.json`, `svg-adapter.txt`).

## Adding a New Version (e.g. `v4`)
1. Copy `prompts/v3/` to `prompts/v4/`.
2. Edit files inside `prompts/v4/`.
3. Run `npm run prompts:sync` to regenerate `manual-test.json` across all versions.
4. Add `"v4"` to `"versions"` in `prompts/config.json` and run `npm test` (verifies `consistency.test.ts` and `prompt-combinations.test.ts`).
