# Infrastructure as Code (IaC) — ColoraStoriaAI

Questo modulo Terraform (`infra/`) permette di **ricreare da zero e in modo automatizzato l’intera infrastruttura cloud** di ColoraStoriaAI su Google Cloud Platform e Firebase, garantendo conformità con le policy di sicurezza e i limiti di spesa (Free Tier).

---

## 🏗️ Architettura Provisionata

1. **Frontend & Backend unificati su Cloud Run v2**:
   - Container Docker full-stack (`Dockerfile` multi-stage non-root `node:24-slim`).
   - Servizio configurato per rimanere nel **Free Tier**: `min_instances = 0` (scale-to-zero, **0 € di costo fisso a riposo**).
   - Tetto di sicurezza anti-costi imprevisti: `max_instances = 2`, `concurrency = 10`, `cpu = 1`, `memory = 512Mi`.
   - Ingress pubblico (`allUsers` invoker).
2. **Registro Immagini (Artifact Registry)**:
   - Repository Docker dedicato per ospitare le immagini container compilate.
3. **Gestione Segreti (Cloud Secret Manager)**:
   - `GEMINI_API_KEY` e `TURNSTILE_SECRET_KEY` salvate in modo cifrato e montate su Cloud Run (nessuna chiave in chiaro nei file di configurazione).
4. **Database & Sicurezza (Cloud Firestore + Rules)**:
   - Database NoSQL Firestore nativo.
   - Deploy automatico delle regole blindate da `firestore.rules` (accesso ristretto tramite custom claim `admin == true`).
5. **Autenticazione (Firebase Auth / Identity Platform)**:
   - Registrazione Web App Firebase.
   - Provider Google Sign-In attivo per l'area riservata Admin.
   - Domini autorizzati configurati automaticamente (`localhost`, domini Firebase, Cloud Run e dominio personalizzato).
6. **IAM & Sicurezza Minima**:
   - Service Account dedicato per il runtime Cloud Run con soli permessi di lettura segreti, accesso datastore e scrittura log.

---

## 📋 Prerequisiti

1. **Google Cloud SDK (`gcloud`)**: installato e autenticato.
   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```
2. **Terraform** (versione `>= 1.5.0`): [Download Terraform](https://developer.hashicorp.com/terraform/install).
3. Un progetto Google Cloud con fatturazione collegata (necessaria per Cloud Run e Secret Manager, che rientrano nelle quote gratuite mensili).

---

## 🚀 Guida Rapida in 4 Passi

### 1. Configura le Variabili
Dalla cartella `infra/`, copia il template delle variabili:
```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
```

Modifica `terraform.tfvars` inserendo il tuo **Project ID** e la tua **Chiave API Gemini**:
```hcl
project_id     = "il-tuo-gcp-project-id"
region         = "europe-west1"
gemini_api_key = "AIzaSy..."
admin_emails   = "tua-email@gmail.com"
```

*(Opzionale: aggiungi `turnstile_site_key` e `turnstile_secret_key` se usi Cloudflare Turnstile).*

---

### 2. Inizializza e Applica l'Infrastruttura
```bash
# Inizializza i provider Google e Google-Beta
terraform init

# Visualizza l'anteprima delle risorse
terraform plan

# Crea tutte le risorse GCP e Firebase
terraform apply
```
Al termine, Terraform stamperà a video:
- L'URL pubblico di Cloud Run (`cloud_run_url`).
- Il percorso del registro Artifact Registry (`artifact_registry_repo`).
- Il comando pronto per compilare l'immagine Docker.
- La configurazione Firebase generata (`firebase_web_app_config`).

---

### 3. Compila e Invia l'Immagine Docker
Dalla **root del repository** (una cartella sopra `infra/`), esegui il comando suggerito nell'output di Terraform per compilare l'immagine tramite Google Cloud Build:
```bash
cd ..
gcloud builds submit \
  --project="IL_TUO_PROJECT_ID" \
  --tag="europe-west1-docker.pkg.dev/IL_TUO_PROJECT_ID/colorastoria-repo/colorastoria:latest" \
  .
```

Cloud Run aggiornerà automaticamente la revisione con la nuova immagine.

---

### 4. Verifica e Collaudo

1. **Health Check API**:
   Verifica che il server risponda correttamente:
   ```bash
   curl -sS https://<URL_CLOUD_RUN>/api/health
   # Risposta attesa: {"ok":true}
   ```
2. **Verifica Sessione Admin**:
   ```bash
   curl -sS https://<URL_CLOUD_RUN>/api/admin/session
   # Risposta attesa: {"authenticated":false,"isAdmin":false,...}
   ```
3. **Interfaccia Web**:
   Apri l'URL di Cloud Run nel browser:
   - Scegli uno stile, carica una foto e premi **Genera pagina da colorare**.
   - Accedi all'**Area riservata** dal footer con l'account Google specificato in `admin_emails`.
   - Assegna il custom claim Admin con:
     ```bash
     npx tsx scripts/set-admin-claim.ts tua-email@gmail.com
     ```
   - Verifica che lo **Storico test Admin su Firestore** mostri i log salvati in tempo reale.

---

## 🧹 Distruzione delle Risorse

Per rimuovere completamente tutte le risorse create ed evitare qualsiasi addebito futuro:
```bash
cd infra
terraform destroy
```
*(Nota: le API abilitate sul progetto rimangono attive per non interrompere altri eventuali servizi GCP).*
