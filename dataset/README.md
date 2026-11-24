# Prompt Evaluation Datasets

This directory stores **repository-backed image datasets** (`source: "repo"`) automatically discovered by the Admin Prompt & Batch Lab (`/admin`).

## Two Ways to Create a Dataset

### 1. From the Git Repository (`dataset/<slug>/`)
1. Create a folder `dataset/<slug>/input/` (slug letters, numbers, `-`, `_`).
2. Drop up to 20 test photos (`JPG`, `PNG`, `WebP`, or `AVIF`, `>= 400x400 px`, `<= 12 MB`) inside `dataset/<slug>/input/`.
3. *(Optional)* Add `dataset/<slug>/dataset.json`:
   ```json
   {
     "name": "Human-readable dataset name",
     "description": "Short description shown in /admin"
   }
   ```
4. The dataset appears automatically in `/admin` with a **`REPO`** badge (read-only from the UI, served strictly to authenticated Admins).

### 2. Directly From the Admin App (`/admin`)
1. Open `/admin` -> **Laboratorio Prompt & Batch API** -> Step 2 (**Dataset & Immagini di test**).
2. Click **Crea dataset dall'app** (or upload photos from your device), enter a name and optional description, and click **Salva dataset**.
3. The dataset is persisted server-side in Cloud Firestore (`prompt_eval_datasets/{datasetId}/items/{itemId}`, Free Tier) with an **`APP`** badge and can also be exported anytime as a `.zip` archive structured as `<slug>/dataset.json` + `<slug>/input/*` if you later want to commit it into this directory.
