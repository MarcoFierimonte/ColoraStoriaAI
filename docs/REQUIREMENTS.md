# ColoraStoria — Wiki dei Requisiti (Funzionali, Non-Funzionali & Roadmap)

> **Versione:** `1.5.0`  
> **Data:** `2026-11-24`  
> **Stato attuale del prodotto:** **Fase 1 — Beta Privata su Invito (Pagine singole istantanee + Stampa A4 + Console Admin & Laboratorio Prompt Batch)**

---

## Regole di Versionamento e Manutenzione

Questo documento è la **fonte di verità sui requisiti di prodotto** del repository (vedi anche `AGENTS.md` Sezione 5). Ogni modifica a funzionalità, flussi utente, limiti, sicurezza o roadmap **deve aggiornare questo file** seguendo il versionamento semantico (`MAJOR.MINOR.PATCH`):

- **`MAJOR` (`X.0.0`):** Cambio di direzione del prodotto, introduzione di una nuova fase di lancio (es. lancio pagamenti o Fase 2 Libro) o rottura di flussi esistenti.
- **`MINOR` (`1.X.0`):** Aggiunta o modifica di un requisito funzionale/non-funzionale (es. nuovo stile, nuovo limite, nuovo ruolo, cambio regole quote).
- **`PATCH` (`1.0.X`):** Chiarimenti testuali, allineamenti numerici o correzioni di incoerenze senza cambiare il comportamento atteso.

Ogni aggiornamento deve incrementare `Versione` / `Data` in testata e aggiungere una riga nella tabella **5. Storico Versioni (Changelog)**.

---

## 1. Visione Prodotto, Fasi e Ruoli Utente

ColoraStoria trasforma fotografie personali (animali, giocattoli, paesaggi, persone) in illustrazioni in bianco e nero pronte da stampare e colorare.

### Fasi del Prodotto
| Fase | Stato | Obiettivo | Modello di Accesso |
| :--- | :--- | :--- | :--- |
| **Fase 1 — Generatore Pagine Singole** | **Attiva (Beta Privata)** | Caricare una foto, scegliere stile/tema, visualizzare l’anteprima A4 e scaricare PDF da stampa (`1-up`, `2-up`, `4-up`) o PNG in pochi secondi. | Landing pubblica; generazione e stampa riservate a tester con **codice/link invito** (`beta-access`) o **Admin**. |
| **Fase 2 — Libro Multi-Pagina & Monetizzazione** | **Roadmap Futura** | Creare un libro personalizzato da **10–15 foto + copertina** consegnato in PDF via email, con modello commerciale validato post-beta. | Pagamento / crediti / abbonamento (opzioni da validare dopo i test con gli invitati). |

### Ruoli (Personas)
1. **Visitatore (non autenticato):** Può navigare la landing page, vedere gli esempi, consultare le pagine legali e aprire il modale creatore (dove vede il gate d’ingresso per il codice invito).
2. **Beta Tester (con invito):** Possiede un codice personale (es. `MARCO-BETA` o link `?invite=...`) associato su Firestore a un tetto massimo di generazioni e a un’eventuale scadenza temporale.
3. **Amministratore (`Admin`):** Autenticato tramite Google Sign-In (`Area riservata`) verificato via Firebase Admin SDK (`{ admin: true }` custom claim o `ADMIN_EMAILS`). Salta i limiti invito/anti-bot, gestisce gli inviti beta, seleziona provider/versione prompt e consulta costi/log su Firestore.

---

## 2. Requisiti Funzionali — Fase 1 (Attiva)

### `REQ-FN-01` — Landing Page Neo-Brutalist Templetizzabile & Pagine Legali
- **Interfaccia configurabile:** Design system centralizzato tramite token CSS (`web-app/src/styles/theme.css`), configurazione testi/slot esempi (`web-app/src/config/siteTemplate.ts`), primitive UI riutilizzabili (`web-app/src/components/ui/`) e sezioni componibili (`web-app/src/components/sections/`).
- **Contenuti landing:** Header (`ColoraStoria` + CTA `Inizia`), Hero con uno spazio fisso subito visibile contenente lo slider orizzontale scorrevole (`ExamplesCarousel`, scroll-snap + frecce + pallini + tastiera + anteprima ingrandita al clic) di tutti i 6 esempi reali `Foto → Fedele / Creativa` su tutti i 6 temi di `Creativa`, fascia categorie (*Animali*, *Giocattoli*, *Paesaggi*, *Persone*), 3 passaggi *Come funziona*, CTA finale e footer con *Area riservata*.
- **Pagine legali con URL reali:** `/contatti`, `/privacy`, `/condizioni` e `/recesso` gestite lato client con sincronizzazione `document.title`, tag `<link rel="canonical">` e focus accessibile sul titolo `<h1>`.

### `REQ-FN-02` — Accesso Beta su Invito & Quote per Tester (`beta-access`)
- **Riscatto tramite link o codice manuale:** Apertura automatica tramite query `?invite=<CODICE>` (con immediata rimozione di `?invite=` dalla barra URL via `history.replaceState`) oppure inserimento manuale nel gate di `CreatorDialog` (`POST /api/access/redeem`).
- **Sessione sicura:** Il server rilascia un cookie `HttpOnly` (`cs_invite`, `SameSite=Lax`, `Secure` in produzione) firmato con HMAC-SHA256 (`BETA_SESSION_SECRET`).
- **Verifica live e quota atomica:** Prima e durante `POST /api/coloring/generate`, il backend controlla lo stato live del documento su Firestore (`beta_invites/{code}`): attivo, non scaduto, con `usedGenerations < maxGenerations`, incrementando `usedGenerations` in transazione atomica.
- **Rimborso automatico su errore AI:** Se il provider AI fallisce o restituisce un output non valido, il credito viene riaccreditato automaticamente (`refundGeneration`) dentro la stessa richiesta.
- **Stampa dell’ultima pagina a credito 0:** Se un tester ha appena consumato il proprio ultimo credito, `POST /api/coloring/export-pdf` continua a consentire il download del PDF finché l’invito resta attivo e non scaduto.
- **Revoca e scadenza immediate:** Disattivare un invito o superare `expiresAtMs` blocca immediatamente sia le sessioni già aperte (cookie esistenti) sia i nuovi riscatti.
- **Bypass Admin:** L’amministratore autenticato con Bearer ID token salta il gate inviti senza consumare alcuna quota beta.

### `REQ-FN-03` — Upload Foto, Esempi Dimostrativi & Consenso
- **Formati e limiti immagine** (unica fonte di verità in `shared/config/limits.ts`):
  - Tipi MIME ammessi: `image/jpeg`, `image/png`, `image/webp`, `image/avif`.
  - Peso massimo file: **12 MB**.
  - Dimensione minima: **400×400 px** (avviso qualità non bloccante sotto **700 px**); dimensione massima: **16000×16000 px**.
- **Esempi interattivi:** 4 scene procedurali su `<canvas>` (`Gatto`, `Orsetto`, `Paesaggio`, `Ritratto` in `web-app/src/config/sampleScenes.ts`), renderizzate a risoluzione **2× (`1120×1584 px`)** per superare la validazione senza falsi avvisi.
- **Usabilità del modale creatore:** Anteprima A4 (`1 / 1.414`) con animazione di caricamento, conferma anti-chiusura accidentale (`Chiudere? Perdi la foto e le scelte fatte.`) se c’è una foto o un risultato attivo, e checkbox obbligatoria di maggiore età (`18+`) e titolarità dei diritti sulla foto prima di abilitare *Crea la pagina*.

### `REQ-FN-04` — Modalità di Generazione, Temi & Età (`prompts/v3/`)
La generazione AI supporta due modalità rigorosamente isolate sia lato UI (`web-app/src/config/generationPayload.ts`), sia lato API (`/api/coloring/generate`), sia nel builder prompt (`FilesystemPromptRepository` + `prompts/v3/`, con `v2` e `v1` mantenute selezionabili per confronto Admin):

| Modalità | Identificativo | Temi applicabili | Fasce d’età applicabili | Comportamento atteso |
| :--- | :--- | :--- | :--- | :--- |
| **Fedele alla foto** *(predefinita)* | `fedele` | **Nessuno** *(scartati sempre dal backend)* | **Nessuna** *(non applicate né mostrate)* | Riproduce fedelmente soggetto/i (persone, animali, giocattoli, oggetti, paesaggi), abiti e accessori reali in linee nere piene (`#000000`, zero linee grigie o puntinature) su fondo bianco (`#FFFFFF`), rimuovendo scatole/cartellini/loghi/testi commerciali e disordine domestico interno, con aree ampie e ben chiuse adatte a essere colorate e divieto assoluto di elementi fantasy. |
| **Creativa** | `creativa` | **1 obbligatorio** tra i 6 ammessi (`pirati`, `unicorni`, `draghi`, `spazio`, `dinosauri`, `principessa`) | **1 selezionabile** tra `1-2`, `3-4` *(default)*, `5-7`, `8+` (**esclusiva di Creativa**) | Mantiene riconoscibili i soggetti reali in primo piano sul terreno della scena (preservando occhiali, cappellini o cerchietti reali già indossati nella foto senza aggiungere caschi/cappelli/corone inventati sopra la testa, e lasciando giocattoli/animali nella loro forma naturale senza vestiti umani), scalando numero e dettaglio degli elementi fantasy secondo l’età selezionata. |

### `REQ-FN-05` — Post-Produzione, Anteprima e Stampa A4
- **PDF pronto per la stampa (`POST /api/coloring/export-pdf`):** Mastering lato server con `sharp` + `pdf-lib` (scala di grigi pura su sfondo `#FFFFFF` a **300 DPI** reali, margini sicuri da **12 mm**) con 3 layout A4 selezionabili:
  - `1-up`: 1 copia grande su A4 verticale.
  - `2-up`: 2 copie affiancate su A4 orizzontale con guida di taglio.
  - `4-up`: griglia 2×2 su A4 verticale con guide di taglio tratteggiate.
- **Esportazione PNG:** Download diretto dell’illustrazione in formato `.png` (raster o rasterizzazione client da SVG).

### `REQ-FN-06` — Console Amministratore Multi-Servizio (`/admin`), Burger Menu & Laboratorio Prompt Batch
- **Accesso tramite Burger Menu & pagina dedicata `/admin`:** Dal menu hamburger nella navbar dell’app principale l’amministratore (e la voce *Area Admin*) raggiunge la pagina dedicata `/admin` strettamente riservata agli Admin (`isAdmin === true`, con gate di autenticazione Google per chi non è autorizzato). Le sezioni admin esistenti (**Inviti Beta** e **Telemetria & Costi**) sono spostate dalla landing pubblica in schede dedicate di questa console multi-servizio (`?tab=prompt-lab|invites|telemetry`).
- **Laboratorio Prompt & Batch API (`packages/prompt-eval-*`):** Pacchetti generici e riutilizzabili (`prompt-eval-core`, `prompt-eval-backend`, `prompt-eval-frontend`) per testare sistematicamente prompt su più immagini (o input testuali):
  - **Dataset dal Repository (`REPO`) e dall’App (`APP`) + Upload multi-immagine:** Possibilità di selezionare in 1 clic sia i dataset già presenti nel repository Git (`dataset/<nome>/input/`, es. `dataset/v1`, scoperti dinamicamente in sola lettura senza dover ricaricare i file dal browser), sia di caricare nuove foto dal dispositivo per test rapidi o per **creare e salvare un nuovo dataset riutilizzabile direttamente dall’app** (persistito su Firestore `prompt_eval_datasets/{datasetId}/items/{itemId}` in piano gratuito, eliminabile dall’UI ed esportabile come archivio `.zip` già strutturato come `<slug>/dataset.json` + `<slug>/input/*` per eventuale commit nel repository). Le foto locali restano inoltre copiate in `ArrayBuffer` in RAM per riesecuzioni immediate.
  - **Selezione e copia prompt completo:** Selezione guidata da tutte le combinazioni dell’app (`v1`/`v2`/`v3`, `fedele` o `creativa` con tema ed età, solo immagini raster) oppure prompt personalizzato, con visualizzazione del testo completo integrale, stima token, pulsante di copia immediata e banner di stato/errore contestuale accanto al pulsante di avvio.
  - **Scelta API Normali (Standard) vs Batch API (-50%):** Per le immagini, selezione esplicita tra elaborazione sincrona (risultato immediato, singola elaborazione per immagine) e Batch API asincrona (`-50%` costo AI su Gemini e OpenAI compatibili).
  - **Salvataggio su dispositivo & notifica email Free Tier:** Download singola immagine o archivio `.zip` completo (`outputs/` + `prompt.txt` + `evaluation-report.json`); per i job batch asincroni, invio automatico dell’email con riepilogo e allegato ZIP tramite provider con piano gratuito (**Resend** 3.000/mese o **Brevo** 300/giorno) e endpoint `/api/admin/prompt-eval/poll-pending` compatibile con Google Cloud Scheduler (piano gratuito).
  - **Persistenza esecuzioni, voti e note:** Ogni esecuzione e ogni singolo output (con miniatura di confronto) sono salvati su Firestore (`prompt_eval_runs/{runId}/items/{itemId}`, free tier, server-only), con valutazione in stelle (`1–5`), esito (`Promosso`/`Da migliorare`/`Scartato`), tag e note testuali modificabili nel tempo.
- **Gestione inviti (`AdminInvitesPanel` + CLI `scripts/manage-invites.ts`):** Creazione inviti con codice automatico o personalizzato, quota massima (`1–1000`), durata opzionale (`1–365` giorni), copia link `?invite=...`, ricarica rapida `+5`, sospensione/riattivazione ed eliminazione.
- **Diagnostica & Telemetria AI (`AdminTelemetryPanel`):** Override di provider (`gemini` / `openai`) e versione prompt (`v1` / `v2`), copia dettagli completi di errore, calcolo costi stimati per pagina e proiezione 16 pagine (`rateCardCostEstimator.ts`), e persistenza log su Firestore (`generation_logs` con `themeId` esteso anche a `'fedele'`).

---

## 3. Requisiti Non-Funzionali, Privacy, Sicurezza & Costi

### `REQ-NFR-01` — Privacy Foto & Zero Persistenza Media
- Le foto caricate restano **esclusivamente in RAM** (`multer.memoryStorage()`) per il tempo della richiesta HTTP e non vengono mai salvate su disco o bucket.
- Prima di chiamare i provider AI, `BufferImageValidator.prepareForAi()` raddrizza l’orientamento EXIF, elimina tutti i metadati EXIF/GPS e ridimensiona il lato lungo a max **1280 px**.

### `REQ-NFR-02` — GDPR, Font Self-Hosted & CSP
- I font tipografici (`@fontsource/plus-jakarta-sans` + `DMMono-Regular.ttf`) sono serviti interamente dal bundle applicativo: zero richieste verso Google Fonts.
- `helmet` applica Content Security Policy restrittiva su script, font, stili e frame (consentendo i popup di Google Auth e Cloudflare Turnstile).

### `REQ-NFR-03` — Sicurezza Applicativa & Regole Firestore
- **Rate limiting per IP:** `15` richieste / `15 min` su `/api/coloring/generate`, `30` / `15 min` su `/api/coloring/export-pdf`, `20` / `15 min` su `/api/access/redeem`, `60` / `15 min` su `/api/admin/prompt-eval/poll-pending`.
- **Anti-bot opzionale:** Supporto Cloudflare Turnstile e Firebase App Check configurabile via env (il segnaposto Terraform `"none"` su `TURNSTILE_SECRET_KEY` viene normalizzato come disattivato).
- **Validazione file binaria:** Verifica server-side tramite *magic bytes* e coerenza MIME prima di passare i dati a Sharp o ai modelli AI.
- **Firestore Security Rules (`firestore.rules`):** Criterio *deny-all* predefinito; `beta_invites`, `prompt_eval_runs` e `prompt_eval_datasets` (incluse le sottocollezioni `items`) sono completamente inaccessibili dai client (`allow read, write: if false`) e gestite solo lato server da backend autenticato; `generation_logs` accessibile solo ad Admin con email verificata e custom claim `{ admin: true }`.

### `REQ-NFR-04` — Infrastruttura Cloud & Controllo Costi (Free Tier)
- Infrastruttura dichiarata interamente come IaC in `infra/` (Terraform): Cloud Run v2 `min_instances = 0` (scale-to-zero) e `max_instances = 2` (`512Mi` RAM, `concurrency = 10`), Artifact Registry, Secret Manager (`GEMINI_API_KEY`, `BETA_SESSION_SECRET`, opzionale `TURNSTILE_SECRET_KEY`), Firestore nativo e Firebase Auth.
- Tutte le chiavi AI e i segreti risiedono lato server / Secret Manager; zero API key esposte nel client o nell’UI.

### `REQ-NFR-05` — Modularità & Qualità del Codice
- Separazione rigida tra contratti puri (`*.interface.ts`, `shared/`) e adattatori concreti (`implementations/`), verificata automaticamente via `npm run lint` (`eslint.config.mjs`).
- Copertura test (`node --test tests/*.test.ts`) su configurazione Zod, validazione immagini, generatori PDF A4, coerenza temi/mode/age con `firestore.rules`, quote/revoca inviti beta e combinazioni UI → API → prompt, eseguita anche su ogni push in GitHub Actions (`ci.yml`) insieme ad `npm audit --audit-level=high`.

---

## 4. Requisiti Fase 2 & Roadmap Futura *(Non ancora implementati)*

I requisiti seguenti descrivono l’evoluzione prevista dopo la validazione della Beta Privata:

| ID | Requisito | Descrizione & Note di Progettazione | Stato |
| :--- | :--- | :--- | :--- |
| **`REQ-FUT-01`** | **Libro Multi-Pagina (10–15 foto)** | Upload batch di `10–15` foto con riordino pagine, titolo copertina personalizzato e composizione di un unico PDF libro da `16` pagine (copertina + pagine interne) tramite coda lavori asincrona e pulizia automatica file temporanei. | *Pianificato (Fase 2)* |
| **`REQ-FUT-02`** | **Monetizzazione Post-Beta** | Integrazione pagamenti (es. Stripe Checkout + webhook) con modello commerciale da definire dopo il feedback dei beta tester: pacchetti crediti / generazioni, pagamento per singola pagina/libro o abbonamento. | *Da validare post-beta* |
| **`REQ-FUT-03`** | **Consegna Email & Coda Batch** | Invio automatico del libro PDF via email al completamento e valutazione modalità economica "24h" basata su Batch API (`-50%` costo AI, documentata in `pricing/ai/image-generation-costs.md`). | *Pianificato (Fase 2)* |
| **`REQ-FUT-04`** | **Allineamento Legale & Pricing Finale** | Aggiornamento dei testi definitivi di `/contatti`, `/condizioni`, `/recesso`, `web-app/src/config/orderConfig.ts` e rimozione/sostituzione dei riferimenti statici placeholder (es. vecchio importo `€19` / consegna email libro) prima dell’apertura commerciale pubblica. | *Pianificato pre-lancio pubblico* |

---

## 5. Storico Versioni (Changelog)

| Versione | Data | Autore / Contesto | Modifiche Principali |
| :--- | :--- | :--- | :--- |
| **`1.5.0`** | `2026-11-24` | Gestione Dataset dal Repository & dall’App in Console Admin | Aggiornati `REQ-FN-06` e `REQ-NFR-03`: aggiunta gestione completa dei dataset di test immagine nei pacchetti `packages/prompt-eval-*` e nella Console Admin (`/admin`), con scoperta automatica dei dataset presenti nel repository (`dataset/<nome>/input/`, badge `REPO`), creazione/eliminazione di nuovi dataset direttamente dall’app caricando foto dal dispositivo (`prompt_eval_datasets/{datasetId}/items/{itemId}` su Firestore free tier, badge `APP`), esecuzione diretta senza ri-upload dei file ed esportazione `.zip` pronta per il repository. |
| **`1.4.0`** | `2026-11-24` | Libreria prompt `prompts/v3` & fix riesecuzione Console Admin | Aggiornati `REQ-FN-04` e `REQ-FN-06`: introdotta la nuova versione attiva `prompts/v3/` ottimizzata su dataset reale per la Fase 1 (pulizia automatica scatole/cartellini/loghi/testi sui giocattoli, contorni neri `#000000` puri senza linee grigie né micro-texture incolorabili, tutela dei cappellini/occhiali reali in *Creativa*, staging naturale per animali/peluche e scalatura progressiva per età `1-2`/`3-4`/`5-7`/`8+`). Corretto il blocco della Console Admin `/admin` dopo la prima esecuzione tramite snapshot `ArrayBuffer` in RAM dei file caricati (immuni da `ERR_UPLOAD_FILE_CHANGED` se spostati su disco), feedback inline accanto al tasto *Avvia*, azione *Riusa impostazioni* e pulsante *Prova un altro stile con questa foto* anche in `CreatorDialog`. |
| **`1.3.1`** | `2026-11-24` | Rimozione opzione vettoriale/SVG nel Prompt Lab | Aggiornato `REQ-FN-06`: rimosso il selettore «Adattatore output» (`raster`/`svg`) dal catalogo ColoraStoria e il modello vettoriale `gemini-4-hydrogen` dai modelli del Laboratorio Prompt Admin, limitando i test immagine ai soli modelli raster. |
| **`1.3.0`** | `2026-11-24` | Console Admin `/admin`, Burger Menu & Pacchetti Prompt Eval Batch | Aggiornati `REQ-FN-06` e `REQ-NFR-03`: creati pacchetti riutilizzabili `packages/prompt-eval-core`, `packages/prompt-eval-backend` e `packages/prompt-eval-frontend` per test prompt multi-immagine (API Standard vs Batch `-50%`), anteprima/copia prompt completo, download singolo/ZIP, notifiche email free-tier (Resend/Brevo) e valutazioni/note persistenti su Firestore (`prompt_eval_runs`). Aggiunta pagina Admin-Only `/admin` accessibile da burger menu con spostamento delle sezioni *Inviti Beta* e *Telemetria & Costi*. |
| **`1.2.0`** | `2026-11-23` | Carousel esempi fisso in Hero | Aggiornato `REQ-FN-01`: spostati tutti i 6 esempi reali in un singolo spazio fisso subito visibile in apertura nella Hero con slide orizzontale (`ExamplesCarousel`, swipe laterale/frecce/pallini e zoom al clic), sostituendo la sezione verticale espansa `ExamplesGallerySection`. |
| **`1.1.0`** | `2026-11-23` | Galleria esempi reali inline | Aggiornato `REQ-FN-01`: sostituita la modale `ExamplesDialog` con la sezione inline `#esempi` (`ExamplesGallerySection`) nella landing page, completa di 6 foto reali (`Gattino`, `Cagnolino`, `Giocattolo`, `Bambola`, `Montagna con alberi`, `Bimbo di 2 anni che gioca`) e relative 12 generazioni `Fedele` + `Creativa` su tutti i 6 temi, con anteprima ingrandibile su clic. |
| **`1.0.0`** | `2026-11-22` | Baseline post-redesign & prompt `v2` | Prima stesura formale del Wiki dei Requisiti: consolidamento Fase 1 (Beta su invito Firestore `beta-access`, pagine singole con modalità `Fedele` vs `Creativa` + temi/età esclusivi di `Creativa`, PDF A4 `1-up`/`2-up`/`4-up`, redesign templetizzabile) e separazione chiara verso la Fase 2 (Libro 10–15 foto e monetizzazione post-beta da validare). |
