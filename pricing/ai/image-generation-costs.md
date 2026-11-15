# AI Image Generation Cost Estimate — ColoraStoria

Compact cost reference for converting uploaded photos into black-and-white coloring pages (`1 photo + theme prompt -> 1 coloring page`).

> **App Baseline:**
> - **Input per page:** 1 resized photo (`~560–1,120` image tokens) + ~`300` text prompt tokens (`prompts/v1`).
> - **Output per page:** 1 portrait coloring page (`1K` ≈ 1 MP is crisp for A4 crayon printing; `2K` ≈ 4 MP is max needed).
> - **Full book (MVP):** 15 photo pages + 1 cover = **16 images per order**.

---

## 1. Google Gemini (Global Region)

| Model | Tier | Input (1M tok) | Text/Thinking Out (1M tok) | Image Out (1M tok) | Est. Cost / 1 Image (`1K`) | Est. Cost / 1 Image (`2K`) | Est. Cost / Book (16 imgs `1K`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`gemini-3.1-flash-lite-image`** *(Nano Banana 2 Lite)* | Lite | $0.25 | $1.50 | $30.00 | **~$0.034** *(1,120 out tok)* | — | **~$0.55** |
| **`gemini-nano-banana-2.1`** | Balanced | $1.50 | $7.50 | $30.00 | **~$0.036–$0.039** *(1,120 out tok)* | **~$0.052–$0.055** *(1,680 out tok)* | **~$0.60** *(~$0.85 at 2K)* |
| **`gemini-3.1-flash-image`** *(Nano Banana 2)* | Mid | $0.50 | $3.00 | $60.00 | **~$0.068** *(1,120 out tok)* | **~$0.102** *(1,680 out tok)* | **~$1.09** |
| **`gemini-3-pro-image`** *(Nano Banana Pro)* | Flagship | $2.00 | $12.00 | $120.00 | **~$0.136–$0.142** *(1,120 out tok)* | **~$0.136–$0.142** *(1,120 out tok)* | **~$2.20** |

*Notes:*
- `4K` (~16 MP) costs **$0.113** on Nano Banana 2.1 (`3,780` tok) and **$0.240** on Gemini 3 Pro (`2,000` tok) — unnecessary for coloring-book line art.
- Thinking/reasoning output tokens add ~$0.001–$0.006 per call if enabled; lowering thinking effort minimizes this extra cost.
- `gemini-nano-banana-2.1` does not support Flex tier.

---

## 2. OpenAI (Standard Token Rate Card)

Rate card for **`gpt-image-2.6-sunburst`** / **`gpt-image-2.6-flare`** (and v2 image models):
- **Image Input:** `$8.00 / 1M` (Cached: `$2.00 / 1M`)
- **Text Input:** `$5.00 / 1M` (Cached: `$1.25 / 1M`)
- **Image Output:** `$30.00 / 1M`

| Model | Quality / Effort | Est. Cost / 1 Image (1024×1536) | Est. Cost / Book (16 imgs) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **`gpt-image-1-mini`** *(Lite)* | Default | **~$0.020** | **~$0.32** | Lowest OpenAI tier, lower facial likeness |
| **`gpt-image-1`** | `low` / `medium` / `high` | **~$0.02 / ~$0.055 / ~$0.19+** | **~$0.35 / ~$0.88 / ~$3.00+** | `medium` is usually sufficient for B&W outlines |
| **`gpt-image-2.6-sunburst` / `flare`** | `low` / `medium` / `high` | **~$0.04–$0.12+** *(scales with quality)* | **~$0.65–$1.90+** | Uses ~3.3x–4.2x more output tokens than v2.5 at equal quality labels |

*Note:* OpenAI **Batch API** (async 24h) reduces token costs by **50%** where supported, though `15–30 min` email delivery requires Standard/Priority speed.

---

## 3. Recommended Cost-Saving Strategies (Without Losing Quality)

1. **Standardize on `1K` Output (`gemini-nano-banana-2.1` or `gemini-3.1-flash-lite-image`):**
   Pure black outlines on white paper print cleanly on A4 at `1K` (**~$0.55–$0.60 per 16-page book**, ~3% of a €19 order price). Reserve `2K` (~$0.85/book) or `Pro` (~$2.20/book) only for difficult group photos or manual retries.
2. **Minimize Thinking / Quality Effort (`effort`):**
   - On Gemini, keep reasoning/thinking at the lowest supported level so you don't pay `$7.50–$12/1M` for hidden thinking tokens on straightforward line-art edits.
   - On OpenAI, prefer `quality: "medium"` (or `low` on `2.6` if clean enough); `high` multiplies output patch tokens by 3–4× mainly for photorealistic textures that coloring pages discard.
3. **Downscale Uploaded Photos Before Calling the API:**
   Resize user photos to max `1024–1280 px` on the longest side before sending. It preserves full facial features while cutting upload bandwidth and OpenAI image-input tiling tokens.
4. **Keep the Fixed Prompt Block First (Prompt Caching):**
   Our `prompts/v1/base.txt` prefix stays identical across all 15 photos in an order, enabling cached-input discounts (up to **75%–90% off** text input tokens on OpenAI/Gemini when supported).
5. **Per-Page Retry Instead of Full-Book Retry:**
   In the async MVP pipeline, process each photo independently and retry only a single failed/rejected page rather than re-running all 15 generations.
