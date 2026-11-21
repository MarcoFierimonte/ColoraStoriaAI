# Wiki Tecnica di ColoraStoriaAI

Guida rapida, chiara e senza gergo inutile per capire **cos’è**, **a cosa serve** e **dov’è usato** ogni scelta architetturale, controllo di sicurezza, libreria e strumento presente in questo progetto.

> **Nota per chi sviluppa (e per gli AI Agent):** questo file va tenuto sempre aggiornato (vedi `AGENTS.md`) ogni volta che si aggiunge una libreria, un modulo o una nuova misura di sicurezza.

---

## Indice rapido
1. [Architettura & Organizzazione del Codice](#1-architettura--organizzazione-del-codice)
2. [Sicurezza Server & Protezione Anti-Abuso](#2-sicurezza-server--protezione-anti-abuso)
3. [Backend, Server & Intelligenza Artificiale](#3-backend-server--intelligenza-artificiale)
4. [Frontend & Interfaccia Utente](#4-frontend--interfaccia-utente)
5. [Database & Autenticazione (Firebase)](#5-database--autenticazione-firebase)
6. [Qualità del Codice, Build & Deploy](#6-qualità-del-codice-build--deploy)

---

## 1. Architettura & Organizzazione del Codice

### Monorepo leggero (`web-app/`, `backend/`, `shared/`)
- **Cos’è:** La separazione in tre cartelle principali nello stesso repository: il sito mostrato nel browser (`web-app/`), il server API (`backend/`) e i contratti comuni (`shared/`).
- **Come e dov’è usato:** `backend/` non può importare codice da `web-app/` e viceversa; tutto ciò che serve a entrambi passa da `shared/types/`. Questa regola è controllata automaticamente da ESLint.

### Moduli con Interfaccia vs Implementazione (`*.interface.ts` + `implementations/`)
- **Cos’è:** Un pattern architetturale (simile a una "presa elettrica" e alla sua "spina") che separa **cosa** fa un modulo (l’interfaccia pura in TypeScript) da **come** lo fa tecnicamente con una specifica libreria esterna (l’implementazione).
- **Come e dov’è usato:** Ogni dominio collegato a servizi esterni in `backend/src/modules/` e `web-app/src/modules/` ha `<nome>.interface.ts` (senza import di librerie esterne), `implementations/*.ts` (es. Gemini, Firebase, Cloudflare) e `index.ts` (punto unico di accesso). Se domani vuoi cambiare database o provider AI, sostituisci solo l’implementazione senza toccare la UI o le route Express.

### Dependency Injection (DI)
- **Cos’è:** Invece di creare gli strumenti direttamente dentro una funzione o route, glieli "passi da fuori" come parametri.
- **Come e dov’è usato:** `createColoringRouter(deps)` in `backend/src/routes/coloringRoutes.ts` e `AuthProvider` in `web-app/src/modules/auth/` ricevono interfacce (`providers`, `auth`, `botProtection`, `mediaValidator`, `prompts`), rendendo il codice modulare e facilmente testabile.

### Regola "Interfaccia solo se serve" (`*.interface.ts` vs moduli diretti)
- **Cos’è:** La regola pratica per non scrivere file superflui: usiamo il pattern completo **Interfaccia + Implementazione** solo dove serve davvero poter cambiare fornitore o servizio esterno (`ai-providers`, `auth`, `database`, `bot-protection`, `media-validation`, `prompts`, futuri `payments`/`email`). Moduli interni come `config` e `cost-estimation` restano funzioni/moduli diretti e leggeri.
- **Come e dov’è usato:** Documentato in `AGENTS.md` e applicato in `backend/src/modules/` e `web-app/src/modules/`.

### `shared/types/` e `shared/config/` (Fonte unica di verità)
- **Cos’è:** Un’unica cartella condivisa tra client e server (*Single Source of Truth*) per evitare costanti duplicate o disallineate.
- **Come e dov’è usato:** `shared/config/limits.ts` centralizza tipi MIME accettati, limite `12 MB`, risoluzione minima `400×400 px`, `10–15` foto libro, `16` pagine proiettate, lista dei 6 temi (`ALLOWED_THEME_IDS`) e provider (`SUPPORTED_PROVIDER_IDS`). `shared/types/coloring.ts` definisce invece tutti i DTO delle API. Sia `backend/` sia `web-app/` importano da qui.

### Prompt Versionati (`prompts/`)
- **Cos’è:** Le istruzioni testuali inviate all’AI tenute in file separati dal codice sorgente, divise per versione (`v1`, `v2`, ecc.).
- **Come e dov’è usato:** `prompts/config.json` sceglie la versione attiva (`"latest"` o bloccata). Il modulo `backend/src/modules/prompts/` li legge da disco (`FilesystemPromptRepository`), permettendo all’Admin di testare nuove versioni dal menu a tendina senza modificare il codice del server.

### `NODE_ENV` esplicito (`development` vs `production`)
- **Cos’è:** La variabile standard di Node.js che dice al server se sta girando sul PC di sviluppo oppure online davanti agli utenti reali.
- **Come e dov’è usato:** In `package.json`, `npm run dev` imposta `NODE_ENV=development` (avvia Vite per lo sviluppo live) e `npm run start` imposta `NODE_ENV=production node server.ts` (serve solo i file statici compilati in `dist/`, senza mai esporre strumenti di sviluppo).

---

## 2. Sicurezza Server & Protezione Anti-Abuso

### `helmet` & Content-Security-Policy (CSP)
- **Cos’è:** Un middleware di sicurezza per Express che aggiunge automaticamente intestazioni HTTP protettive nelle risposte del server. La **CSP** dice al browser esattamente da quali domini può scaricare script, font, immagini o aprire frame, bloccando attacchi XSS (script malevoli iniettati) e clickjacking.
- **Come e dov’è usato:** Configurato in `backend/server.ts`. Imposta anche `crossOriginOpenerPolicy: 'same-origin-allow-popups'` e autorizza in `scriptSrc`/`connectSrc`/`workerSrc`/`childSrc`/`frameSrc` i domini e protocolli necessari per Cloudflare Turnstile (`data:`, `blob:`, `*.cloudflare.com`, `challenges.cloudflare.com`, `*.cloudflarecaptcha.com`) e Firebase Google Sign-In (`apis.google.com`, `www.gstatic.com`, `*.firebaseapp.com`, `*.web.app`), oltre a `frameAncestors` per l’anteprima AI Studio e `upgradeInsecureRequests` solo in produzione.

### Disattivazione `X-Powered-By` & `trust proxy`
- **Cos’è:** Due impostazioni Express di sicurezza e rete. `disable('x-powered-by')` nasconde che il server usa Express (meno info utili per chi attacca); `set('trust proxy', 1)` dice a Express di leggere l’IP reale del visitatore dall’header `X-Forwarded-For` invece dell’IP interno del bilanciatore di Cloud Run.
- **Come e dov’è usato:** In `backend/server.ts`. Senza `trust proxy`, il rate limiter vedrebbe tutti gli utenti con lo stesso IP del proxy Cloud Run e bloccherebbe tutti insieme.

### Rate Limiting (`express-rate-limit`)
- **Cos’è:** Un "contagiri" che limita quante richieste può fare lo stesso indirizzo IP in un certo intervallo di tempo.
- **Come e dov’è usato:** In `backend/src/routes/coloringRoutes.ts` su `POST /api/coloring/generate`: massimo **15 generazioni ogni 15 minuti** per IP. Oltre quella soglia risponde `HTTP 429` evitando che qualcuno prosciughi quota o budget con script automatici.

### Protezione Anti-Bot (`Cloudflare Turnstile` / `Firebase App Check`)
- **Cos’è:** Un controllo che verifica che a premere "Genera" sia un browser/utente reale e non uno script automatico (bot):
  - **Cloudflare Turnstile:** alternativa gratuita e leggera ai vecchi CAPTCHA a semafori; verifica il visitatore in modo trasparente generando un token temporaneo.
  - **Firebase App Check:** servizio Firebase che attesta che la richiesta arriva davvero dalla tua app registrata.
- **Come e dov’è usato:** Modulo `backend/src/modules/bot-protection/` (`DefaultBotProtectionVerifier`) eseguito su `POST /api/coloring/generate` **prima** di caricare la foto in RAM. Lato client, `web-app/src/components/TurnstileWidget.tsx` mostra il widget Turnstile automaticamente quando `VITE_TURNSTILE_SITE_KEY` è configurata.

### `multer` (con `memoryStorage`)
- **Cos’è:** La libreria Node/Express standard per leggere i file inviati dai form HTML (`multipart/form-data`). Con `memoryStorage`, il file rimane **solo nella memoria RAM** per la durata della richiesta e non viene mai scritto su disco.
- **Come e dov’è usato:** In `backend/src/routes/coloringRoutes.ts` per ricevere `photo`, con limite massimo di **1 file** e **12 MB**. Appena la richiesta termina, il buffer sparisce dalla RAM garantendo la privacy delle foto.

### Validazione Magic Bytes & Dimensioni lato server (`BufferImageValidator`)
- **Cos’è:** I **magic bytes** sono i primissimi byte all’interno di un file che ne identificano il formato reale (es. `FF D8 FF` per JPEG, `89 50 4E 47` per PNG, `RIFF...WEBP` per WebP), indipendentemente da come l’utente ha rinominato il file.
- **Come e dov’è usato:** Modulo `backend/src/modules/media-validation/` (`BufferImageValidator`). Controlla che il file caricato sia davvero un JPEG/PNG/WebP coerente, legge larghezza e altezza reali dai metadati binari e rifiuta immagini sotto `400×400 px` o sopra `16000×16000 px` prima ancora di chiamare l’AI.

### Error Handler Globale & Errori Sanitizzati
- **Cos’è:** Un "paracadute" finale in Express che intercetta qualsiasi errore imprevisto evitando di mandare al browser stack trace o dettagli interni del server.
- **Come e dov’è usato:** In fondo a `backend/server.ts` risponde sempre con un JSON generico. Nei provider AI (`GeminiColoringProvider`, `OpenAIColoringProvider`), gli errori verso gli utenti normali mostrano solo messaggi generici (mappati su `error.status`), mentre i dettagli tecnici vengono salvati nei log server e mostrati solo all’Admin autenticato.

### Cloud Secret Manager & Restrizione delle API Key (GCP)
- **Cos’è:** Il "caveau" sicuro di Google Cloud per salvare password e API key (`GEMINI_API_KEY`, `TURNSTILE_SECRET_KEY`), invece di lasciarle scritte in chiaro dentro file o variabili d’ambiente visibili.
- **Come e dov’è usato:** Documentato in `README.md` (`--set-secrets` al deploy su Cloud Run), insieme ai limiti `--max-instances 2 --concurrency 10`, ai Budget Alert di fatturazione e alle restrizioni delle API key in Console GCP (referrer HTTP per la chiave web Firebase e sola *Generative Language API* per Gemini).

---

## 3. Backend, Server & Intelligenza Artificiale

### Node.js 22 & `tsx`
- **Cos’è:** **Node.js** è il motore che esegue JavaScript/TypeScript sul server (dalla versione 22 legge direttamente file `.ts` con sintassi erasable senza compilazione preventiva). **`tsx`** è il runner veloce usato in sviluppo.
- **Come e dov’è usato:** `npm run start` usa `node server.ts` direttamente; `npm run dev` usa `tsx server.ts` per avviare l’ambiente di sviluppo.

### Express 5 (`express`)
- **Cos’è:** Il framework web più diffuso per Node.js per creare API HTTP (`/api/...`) e servire file statici.
- **Come e dov’è usato:** `backend/server.ts` crea l’app Express, monta le route di `backend/src/routes/coloringRoutes.ts` (`/api/health` che restituisce `{ ok: true }`, `/api/admin/session`, `/api/coloring/generate`) e gestisce il fallback SPA.

### Google GenAI SDK (`@google/genai`)
- **Cos’è:** La libreria ufficiale di Google per chiamare i modelli Gemini.
- **Come e dov’è usato:** Incapsulata esclusivamente dentro `backend/src/modules/ai-providers/implementations/geminiColoringProvider.ts`. Supporta sia la generazione immagine raster ad alta fedeltà fisionomica (`gemini-nano-banana-2.1`, predefinito) sia la modalità vettoriale SVG (`gemini-4-hydrogen`).

### OpenAI Image API (via `fetch`)
- **Cos’è:** Adapter HTTP verso l’endpoint `/v1/images/edits` di OpenAI tramite `fetch` nativo di Node.
- **Come e dov’è usato:** `backend/src/modules/ai-providers/implementations/openaiColoringProvider.ts`, attivabile tramite `AI_PROVIDER=openai` o selettore Admin se `OPENAI_API_KEY` è configurata.

### Cost Estimation (`calculateGenerationCost`)
- **Cos’è:** Modulo di calcolo che traduce i token consumati in input/output e cache in una stima economica in dollari (singola pagina e proiezione su `PROJECTED_BOOK_PAGES = 16` pagine). Se incontra un modello non presente nel listino, stampa un `console.warn` invece di ignorarlo in silenzio.
- **Come e dov’è usato:** `backend/src/modules/cost-estimation/rateCardCostEstimator.ts` (sincronizzato con i prezzi documentati in `pricing/`). I risultati arrivano solo nella telemetria Admin.

### Elaborazione Immagini & Print Mastering (`sharp`)
- **Cos’è:** Libreria Node.js ad alte prestazioni per manipolare immagini in memoria RAM.
- **Come e dov’è usato:** Usata in due punti chiave:
  1. **Ottimizzazione Input (`BufferImageValidator.prepareForAi`)**: prima di inviare la foto a Gemini/OpenAI, raddrizza automaticamente l’orientamento EXIF, elimina i dati GPS/privacy e ridimensiona il lato lungo a max `1280 px` (meno banda e meno token).
  2. **Pre-stampa (`SharpPdfLibGenerator`)**: converte l’illustrazione in scala di grigi pura (zero spreco di inchiostro CMYK), forza lo sfondo a bianco assoluto (`#FFFFFF`) e porta la risoluzione a `300 DPI` reali per la cella A4 scelta.

### Generazione PDF da Stampa (`pdf-lib`)
- **Cos’è:** Libreria JavaScript pura per creare e impaginare file PDF standard lato server senza browser headless pesanti.
- **Come e dov’è usato:** Modulo `backend/src/modules/print-pdf/` esposto su `POST /api/coloring/export-pdf`. Impagina il disegno in A4 con margini sicuri da `12 mm`: **1 copia** (A4 verticale), **2 copie** (A4 orizzontale affiancate) o **4 copie** (griglia 2×2 con linee di taglio tratteggiate).

### Validazione configurazione all’avvio (`zod`) & Graceful Shutdown
- **Cos’è:** `zod` è una libreria di validazione rigorosa degli schemi dati. Qui controlla tutte le variabili d’ambiente all’avvio del server: se `PORT` non è un numero valido, `AI_PROVIDER` è sbagliato o `ADMIN_EMAILS` contiene un’email non valida, il server rifiuta di partire subito con un errore chiaro. Il **Graceful Shutdown** (`SIGTERM`/`SIGINT`) fa sì che Cloud Run chiuda le connessioni HTTP in corso prima di spegnere il container.
- **Come e dov’è usato:** `backend/src/modules/config/envConfig.ts` (`parseServerConfig`) e `backend/server.ts`.

---

## 4. Frontend & Interfaccia Utente

### React 19 (`react`, `react-dom`)
- **Cos’è:** La libreria per costruire interfacce web a componenti reattivi.
- **Come e dov’è usato:** Tutto il frontend in `web-app/src/` (`App.tsx`, `components/`, `AuthContext.tsx`).

### Vite (`vite`, `@vitejs/plugin-react`)
- **Cos’è:** Il build tool moderno che compila TypeScript/React/CSS velocemente in sviluppo e crea il pacchetto ottimizzato in `dist/` per la produzione.
- **Come e dov’è usato:** Configurato in `web-app/vite.config.ts`. In sviluppo viene montato dentro Express solo quando `NODE_ENV === 'development'`.

### Tailwind CSS v4 (`tailwindcss`, `@tailwindcss/vite`)
- **Cos’è:** Framework CSS basato su classi utility (`p-4`, `rounded-xl`, `text-zinc-900`) per stilare i componenti senza fogli CSS complessi.
- **Come e dov’è usato:** Importato via `@import "tailwindcss";` in `web-app/src/styles/main.css` e usato in tutti i componenti React.

### Lucide React (`lucide-react`)
- **Cos’è:** Raccolta di icone SVG pulite e leggere importabili come normali componenti React (solo le icone usate entrano nel bundle finale).
- **Come e dov’è usato:** Pulsanti, step visivi, anteprime e pannello Admin in `web-app/src/App.tsx` e `web-app/src/components/`.

### Design System Templetizzabile (`theme.css` + `siteTemplate.ts` + `components/ui/` & `sections/`)
- **Cos’è:** Separazione tra token visivi CSS (colori, bordi spessi `3px`, ombre nette neo-brutalist, font e raggio), configurazione dati dei testi/esempi (`siteTemplate.ts` e `sampleScenes.ts`), primitive UI riutilizzabili (`UiButton`, `UiCard`, `UiChip`, `UiBadge`, `ModalDialog`, `UiToast`) e sezioni componibili della landing.
- **Come e dov’è usato:** `web-app/src/styles/theme.css`, `web-app/src/config/siteTemplate.ts`, `web-app/src/config/sampleScenes.ts`, `web-app/src/components/ui/` e `web-app/src/components/sections/`. Permette di modificare palette, testi, scene di esempio o interi blocchi visivi senza toccare la logica API o le validazioni.

### Finestre Modali Native (`<dialog>` in `CreatorDialog` ed `ExamplesDialog`)
- **Cos’è:** Wrapper accessibile sopra l’elemento HTML nativo `<dialog>` (`.showModal()`, focus trap automatico, backdrop scuro, chiusura con `Esc` e passaggio automatico a schermo intero su smartphone `<= 600px`) dotato di anteprima A4 e conferma anti-smarrimento se ci sono modifiche non salvate.
- **Come e dov’è usato:** `web-app/src/components/ui/ModalDialog.tsx`, `web-app/src/components/CreatorDialog.tsx` (flusso foto/esempi, stile Fedele/Creativa, temi, età, esportazione PDF A4 `1-up`/`2-up`/`4-up` e PNG) e `web-app/src/components/ExamplesDialog.tsx`.

### Font Self-Hosted (`@fontsource/plus-jakarta-sans` & `DM Mono`)
- **Cos’è:** Pacchetto npm e font locale che includono i file `.woff2`/`.ttf` direttamente dentro il bundle dell’applicazione, eliminando ogni chiamata ai server di Google Fonts (migliorando la privacy **GDPR**, perché l’IP del visitatore non viene inviato a terzi, e rendendo più stretta la CSP).
- **Come e dov’è usato:** `Plus Jakarta Sans` importato in `web-app/src/main.tsx` per tutti i pesi usati e associato ai token `--cs-font-sans` / `--cs-font-display` in `web-app/src/styles/theme.css`, insieme al font monospace locale `DMMono-Regular.ttf`.

### Pagine Legali con URL Reali & SEO Meta
- **Cos’è:** Invece di aprire finestre modali difficili da raggiungere con tastiera o link diretti, le pagine informative hanno veri indirizzi web navigabili e linkabili (`/contatti`, `/privacy`, `/condizioni`, `/recesso`) con gestione automatica del focus sul titolo `<h1>`.
- **Come e dov’è usato:** `web-app/src/components/LegalPage.tsx` e routing client-side in `web-app/src/App.tsx`, accompagnati da `og:image`, `canonical` e `theme-color` in `web-app/index.html`.

### Esportazione SVG → PNG (`Canvas` browser) & Validazione Foto client
- **Cos’è:** Uso delle API native del browser (`FileReader`/`Image` + `<canvas>`) per controllare formato/risoluzione prima dell’invio, disegnare proceduralmente a risoluzione 2× (`1120×1584 px`) gli esempi dimostrativi (`Gatto`, `Orsetto`, `Paesaggio`, `Ritratto`) e convertire l’eventuale disegno SVG in `.png`.
- **Come e dov’è usato:** Modulo `web-app/src/modules/media-validation/` (`BrowserPhotoValidator`) per i controlli rapidi sul browser, `web-app/src/config/sampleScenes.ts` per gli esempi pronti, e `web-app/src/components/CreatorDialog.tsx` per il download PNG.

---

## 5. Database & Autenticazione (Firebase)

### Firebase Auth + Google Popup (`firebase/auth`)
- **Cos’è:** Servizio gestito da Google per far accedere gli utenti (qui solo l’Admin) tramite account Google, senza dover gestire password, reset o hashing sul server.
- **Come e dov’è usato:** Modulo frontend `web-app/src/modules/auth/` (`FirebaseAuthGateway` con `signInWithPopup` e `AuthProvider`).

### Firebase Admin SDK (`firebase-admin`) & Custom Claim `admin`
- **Cos’è:** La libreria ufficiale lato server per verificare la validità crittografica dei token Firebase degli utenti e gestire ruoli/permessi in modo sicuro. Un **Custom Claim** (`{ admin: true }`) è un’etichetta firmata da Google dentro il token di autenticazione che il client non può falsificare.
- **Come e dov’è usato:** Modulo `backend/src/modules/auth/` (`FirebaseAdminTokenVerifier`) e script una tantum `scripts/set-admin-claim.ts` (assegna il ruolo admin via CLI senza salvare email personali nel codice). `ADMIN_EMAILS` abilita controlli e telemetria live Admin (`isAdmin`), mentre la lettura/scrittura dello storico persistente su Firestore viene attivata solo quando il token possiede effettivamente il custom claim `admin: true` (`hasAdminClaim`), evitando errori di permessi su Firestore.

### Cloud Firestore (`firebase/firestore`)
- **Cos’è:** Database NoSQL gestito in cloud da Google con aggiornamenti in tempo reale (`onSnapshot`).
- **Come e dov’è usato:** Modulo `web-app/src/modules/database/` (`firebaseAppInstance.ts` con il `firestoreDatabaseId` specifico e test di connessione iniziale + `FirestoreGenerationLogRepository`). Salva e mostra in tempo reale nella tabella Admin lo storico di costi, modelli e token (`generation_logs`) quando `hasAdminClaim` è attivo.

### Firestore Security Rules (`firestore.rules`) & `firebase-blueprint.json`
- **Cos’è:** Le regole di sicurezza (`firestore.rules`) agiscono come un firewall direttamente sul database Firestore: decidono chi può leggere/scrivere cosa e verificano tipo, lunghezza e timestamp di ogni campo. `firebase-blueprint.json` è lo schema di riferimento della struttura dati.
- **Come e dov’è usato:** Nella root del progetto. Blocca tutto di default (`deny-all`), permette lettura/creazione/cancellazione su `generation_logs` **solo** ad account verificati con custom claim `admin == true` e valida tutti i 13 campi più `createdAt == request.time`.

---

## 6. Qualità del Codice, Build & Deploy

### TypeScript 7 (`typescript` + `tsc --noEmit`)
- **Cos’è:** JavaScript con controllo statico dei tipi: scova errori di battitura, proprietà mancanti o tipi incompatibili prima ancora di avviare l’app.
- **Come e dov’è usato:** Configurato in `tsconfig.json` (`strict: true`); eseguito da `npm run lint`.

### ESLint 10 (`eslint`) & `@firebase/eslint-plugin-security-rules`
- **Cos’è:** Uno strumento di analisi automatica del codice (*linter*). Qui fa due lavori chiave: controlla la sicurezza di `firestore.rules` e applica regole architetturali sui confini tra moduli (`no-restricted-imports`).
- **Come e dov’è usato:** Configurato in `eslint.config.mjs` (con parser compatibile con TypeScript 7) ed eseguito automaticamente insieme a `tsc --noEmit` tramite `npm run lint`.

### Test Automatici (`node --test`), CI (`GitHub Actions`) & `Dependabot`
- **Cos’è:** Il runner di test integrato in Node.js (`node:test`) verifica senza librerie extra che validazione upload (magic bytes e dimensioni), configurazione Zod, auth admin, provider registry e coerenza dei temi tra `shared/config`, `prompts/` e `firestore.rules` restino sempre validi. **GitHub Actions** e **Dependabot** automatizzano questi controlli e gli aggiornamenti di sicurezza su ogni modifica.
- **Come e dov’è usato:** `tests/*.test.ts` (eseguiti con `npm test`), `.github/workflows/ci.yml` e `.github/dependabot.yml`.

### Docker Multi-Stage (`Dockerfile`) & `npm` con `package-lock.json`
- **Cos’è:** Il `Dockerfile` crea un’immagine di produzione leggera e isolata (`node:24-slim`) compilando prima il frontend e installando poi solo le dipendenze necessarie a runtime (`npm ci --omit=dev`), eseguendo l’app con utente non privilegiato (`USER node`). Tutto il progetto usa `npm` e `package-lock.json` come unico package manager.
- **Come e dov’è usato:** Nella root (`Dockerfile`, `.dockerignore`, `package.json`, `package-lock.json`), pronto per il deploy su Cloud Run Free Tier documentato in `README.md`.

### Infrastructure as Code (`infra/`, Terraform)
- **Cos’è:** Lo standard universale per definire e ricreare risorse cloud tramite codice dichiarativo e versionabile, senza dipendere da configurazioni manuali nella console web.
- **Come e dov’è usato:** Cartella `infra/`. Automatizza in un unico comando (`terraform apply`) il provisioning completo di Cloud Run v2 (con limiti Free Tier: scale-to-zero e max 2 istanze, protetto di default tramite **IAM privato** `allow_unauthenticated = false` con ruolo `roles/run.invoker` riservato ai soli account Google autorizzati e supporto opzionale a Cloud Run IAP tramite `enable_iap = true`), Artifact Registry, Secret Manager (`GEMINI_API_KEY`, `TURNSTILE_SECRET_KEY`), database Cloud Firestore nativo, deploy automatico di `firestore.rules`, registrazione Web App Firebase, Identity Platform (Google Sign-In) e Service Account dedicato con privilegi minimi. Documentato in `infra/README.md`.
