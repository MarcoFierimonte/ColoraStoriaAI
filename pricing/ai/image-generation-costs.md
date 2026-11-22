# AI Image Generation Cost Estimate — ColoraStoria

Compact cost reference for converting uploaded photos into black-and-white coloring pages (`1 photo + theme prompt -> 1 coloring page`), comparing **Standard (real-time)** vs **Batch API (async)**.

> **App Baseline:**
> - **Input per page:** 1 resized photo (`~560–1,120` image tokens, `<=1280 px` longest side) + ~`300–400` text prompt tokens (`prompts/v2`: faithful `fedele` mode or `creativa` mode + theme + age group).
> - **Output per page (Phase 1 Active Beta):** 1 portrait coloring page (`1K` ≈ 1 MP is crisp for A4 crayon printing; `2K` ≈ 4 MP is max needed).
> - **Full book projection (Phase 2 Roadmap):** 15 photo pages + 1 cover = **16 images per book**.

---

## 1. Google Gemini (Global Region — Standard vs. Batch API)

Google Gemini Batch API applies a **50% discount** across input, text/thinking, and image output tokens on supported image models.
- **Standard Latency:** Synchronous, typically **~3–15 seconds** per image.
- **Batch API Turnaround (Official SLO):** Asynchronous, **up to 24 hours** (often completes faster in minutes/hours depending on queue load; no Flex tier on `gemini-nano-banana-2.1`).

| Model | Tier | Standard 1 Image (`1K`) | Batch 1 Image (`1K`, -50%) | Standard 1 Image (`2K`) | Batch 1 Image (`2K`, -50%) | Book 16 Imgs (`1K` Std / Batch) | Official Turnaround (Std / Batch) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`gemini-3.1-flash-lite-image`** *(Nano Banana 2 Lite)* | Lite | **~$0.034** | **~$0.017** | — | — | **~$0.55 / ~$0.27** | ~3–10 sec / Up to 24h SLO |
| **`gemini-nano-banana-2.1`** | Balanced | **~$0.036** | **~$0.018** | **~$0.053** | **~$0.026** | **~$0.58 / ~$0.29** | ~5–15 sec / Up to 24h SLO |
| **`gemini-3.1-flash-image`** *(Nano Banana 2)* | Mid | **~$0.068** | **~$0.034** | **~$0.102** | **~$0.051** | **~$1.09 / ~$0.54** | ~5–15 sec / Up to 24h SLO |
| **`gemini-3-pro-image`** *(Nano Banana Pro)* | Flagship | **~$0.137** | **~$0.069** | **~$0.137** | **~$0.069** | **~$2.20 / ~$1.10** | ~10–20 sec / Up to 24h SLO |

*Base Token Rates (Standard per 1M tokens — Batch is 50% of all rates below):*
- `gemini-3.1-flash-lite-image`: Input `$0.25` (cached `$0.025`), Text Out `$1.50`, Image Out `$30.00` (`1,120` tok for `1K`).
- `gemini-nano-banana-2.1`: Input `$1.50` (cached `$0.15`), Text Out `$7.50`, Image Out `$30.00` (`1,120` tok `1K`, `1,680` tok `2K`).
- `gemini-3.1-flash-image`: Input `$0.50` (cached `$0.05`), Text Out `$3.00`, Image Out `$60.00` (`1,120` tok `1K`, `1,680` tok `2K`).
- `gemini-3-pro-image`: Input `$2.00` (cached `$0.20`), Text Out `$12.00`, Image Out `$120.00` (`1,120` tok for `1K` and `2K`).

---

## 2. OpenAI (Standard vs. Batch API)

OpenAI Batch API (`/v1/images/generations` and `/v1/images/edits` via JSONL) applies a **50% discount** on supported models, with an official **24-hour SLA**.
- **Important (`gpt-image-2.6`):** Per official OpenAI pricing tables, **`gpt-image-2.6-sunburst` and `gpt-image-2.6-flare` do NOT support Batch API** (Standard/Priority only).
- **Standard Latency:** Synchronous, typically **~10–40 seconds** per image (increases with `high` quality).

| Model | Quality / Effort | Standard 1 Image (1024×1536) | Batch 1 Image (-50%) | Book 16 Imgs (Std / Batch) | Official Turnaround (Std / Batch) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`gpt-image-1-mini`** *(Lite)* | Default | **~$0.021** | **~$0.011** | **~$0.34 / ~$0.17** | ~10–20 sec / Up to 24h SLA |
| **`gpt-image-1`** | `medium` | **~$0.055** | **~$0.028** | **~$0.88 / ~$0.44** | ~15–35 sec / Up to 24h SLA |
| **`gpt-image-2.6-sunburst` / `flare`** | `low` / `high` | **~$0.05–$0.12+** | *Not supported* | **~$0.80–$1.90+** *(Std only)* | ~15–40 sec / Batch N/A |

*Base Token Rates for `gpt-image-2.6` (Standard per 1M tokens):*
- **Image Input:** `$8.00` (Cached: `$2.00`) · **Text Input:** `$5.00` (Cached: `$1.25`) · **Image Output:** `$30.00`.

---

## 3. MVP Delivery Time vs. Cost Trade-Off

- **15–30 minute async email delivery (MVP target):** Requires **Standard API** concurrency (you cannot rely on a 24h Batch SLA/SLO when a customer expects their PDF within 30 minutes).
- **Where Batch API (-50%) fits cleanly:**
  - Next-day / economy delivery tier ("Consegna entro 24 ore") cutting AI cost to **~$0.27–$0.29 per 16-page book** on `gemini-3.1-flash-lite-image` or `gemini-nano-banana-2.1`.
  - Pre-generating theme covers, catalog samples, or bulk offline tests.

---

## 4. Recommended Cost-Saving Strategies (Without Losing Quality)

1. **Standardize on `1K` Output (`gemini-nano-banana-2.1` or `gemini-3.1-flash-lite-image`):**
   Pure black outlines on white paper print cleanly on A4 at `1K` (**~$0.55–$0.58 per book** Standard, **~$0.27–$0.29** Batch). Reserve `2K` or `Pro` only for manual retries.
2. **Minimize Thinking / Quality Effort (`effort`):**
   Keep reasoning/thinking at the lowest supported level on Gemini and use `medium` (or `low` on `2.6`) on OpenAI so token counts do not balloon on textureless B&W outlines.
3. **Downscale Uploaded Photos Before Calling the API:**
   Resize user photos to max `1024–1280 px` on the longest side before sending to preserve facial features while reducing input image tokens.
4. **Keep the Fixed Prompt Block First (Prompt Caching):**
   Keep `prompts/v1/base.txt` identical at the start of every call to leverage cached-input discounts across the 15 photos of a single book.
5. **Per-Page Retry Instead of Full-Book Retry:**
   Process each page independently and retry only single failed outputs.
