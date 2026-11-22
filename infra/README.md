# Infrastructure as Code (IaC) — ColoraStoriaAI

Questo modulo Terraform (`infra/`) permette di **ricreare da zero e in modo automatizzato l’intera infrastruttura cloud** di ColoraStoriaAI su Google Cloud Platform e Firebase, garantendo conformità con le policy di sicurezza e i limiti di spesa (Free Tier).

---

## Architettura Provisionata

1. **Frontend & Backend unificati su Cloud Run v2**:
   - Container Docker full-stack (`Dockerfile` multi-stage non-root `node:24-slim`).
   - Servizio configurato per rimanere nel **Free Tier**: `min_instances = 0` (scale-to-zero, **0 € di costo fisso a riposo**).
   - Tetto di sicurezza anti-costi imprevisti: `max_instances = 2`, `concurrency = 10`, `cpu = 1`, `memory = 512Mi`.
   - In modalità **Beta Privata su Invito** (`allow_unauthenticated = true` + `beta_invite_required = true`), la landing page è visibile a livello HTTP mentre generazione AI e stampa PDF sono bloccate lato server senza codice invito valido o login Google Admin (`allow_unauthenticated = false` resta disponibile se vuoi chiudere anche l’accesso Cloud Run IAM).
2. **Registro Immagini (Artifact Registry)**:
   - Repository Docker dedicato per ospitare le immagini container compilate.
3. **Gestione Segreti (Cloud Secret Manager)**:
   - `GEMINI_API_KEY` e `BETA_SESSION_SECRET` salvate in modo cifrato e montate su Cloud Run (`TURNSTILE_SECRET_KEY` montata dinamicamente solo se configurata, nessuna chiave in chiaro nei file di configurazione).
4. **Database & Sicurezza (Cloud Firestore + Rules)**:
   - Database NoSQL Firestore nativo (`europe-west1`).
   - Deploy automatico delle regole blindate da `firestore.rules`: blocco totale per `beta_invites` dai client (gestiti solo via `firebase-admin` dal backend) e accesso a `generation_logs` ristretto tramite custom claim `admin == true`.
5. **Autenticazione (Firebase Auth / Identity Platform)**:
   - Registrazione Web App Firebase.
   - Provider Google Sign-In attivo per l’area riservata Admin.
   - Domini autorizzati configurati automaticamente (`localhost`, domini Firebase, Cloud Run e dominio personalizzato).
6. **IAM & Sicurezza Minima**:
   - Service Account dedicato per il runtime Cloud Run con soli permessi di lettura segreti, accesso datastore (`roles/datastore.user`) e scrittura log.

---

## Prerequisiti

1. **Google Cloud SDK (`gcloud`)**: installato e autenticato:
   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```
2. **Terraform** (versione `>= 1.5.0`): [Download Terraform](https://developer.hashicorp.com/terraform/install).
3. Un progetto Google Cloud con fatturazione collegata (necessaria per Cloud Run e Secret Manager, che rientrano nelle quote gratuite mensili).

---

## Guida Rapida in 4 Passi

### 1. Configura le Variabili
Dalla cartella `infra/`, copia il template delle variabili:
```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
```

Modifica `terraform.tfvars` inserendo Project ID, API key Gemini e il segreto HMAC per i cookie invito (es. generato con `openssl rand -hex 32`):
```hcl
project_id            = "il-tuo-gcp-project-id"
region                = "europe-west1"
gemini_api_key        = "AIzaSy..."
admin_emails          = "tua-email@gmail.com"
allow_unauthenticated = true
beta_invite_required  = true
beta_session_secret   = "<64-hex-chars>"
```

*(Opzionale: aggiungi `turnstile_site_key` e `turnstile_secret_key` se vuoi attivare anche Cloudflare Turnstile).*

---

### 2. Inizializza e Applica l’Infrastruttura
```bash
terraform init
terraform plan
terraform apply
```
*(Attenzione: verifica sempre dal `plan` che `google_firestore_database.database` non venga mai distrutto o ricreato).*

---

### 3. Compila e Invia l’Immagine Docker
Dalla **root del repository**:
```bash
gcloud builds submit \
  --project="IL_TUO_PROJECT_ID" \
  --region=europe-west1 \
  --tag="europe-west1-docker.pkg.dev/IL_TUO_PROJECT_ID/colorastoria-repo/colorastoria:latest" \
  .

gcloud run services update colorastoria \
  --project="IL_TUO_PROJECT_ID" \
  --region=europe-west1 \
  --image="europe-west1-docker.pkg.dev/IL_TUO_PROJECT_ID/colorastoria-repo/colorastoria:latest"
```

---

### 4. Crea i Primi Inviti & Verifica
1. **Health Check & Gate Inviti**:
   ```bash
   curl -sS https://<URL_CLOUD_RUN>/api/health          # {"ok":true}
   curl -sS https://<URL_CLOUD_RUN>/api/access/session  # {"inviteRequired":true,"hasAccess":false,...}
   ```
2. **Crea il tuo invito personale da CLI**:
   ```bash
   npx tsx scripts/manage-invites.ts create --label "Marco" --code MARCO-BETA --max 50
   ```
3. **Abilita il ruolo Admin su Firestore (custom claim)**:
   ```bash
   npx tsx scripts/set-admin-claim.ts tua-email@gmail.com
   ```
   Poi accedi dal footer con **Area riservata** per creare/copiare/disattivare gli inviti da browser e consultare la telemetria costi.

---

## Distruzione delle Risorse

Per rimuovere completamente tutte le risorse create ed evitare qualsiasi addebito futuro:
```bash
cd infra
terraform destroy
```
*(Nota: le API abilitate sul progetto rimangono attive per non interrompere altri eventuali servizi GCP).*
