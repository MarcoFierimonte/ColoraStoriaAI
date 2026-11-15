import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  ImagePlus,
  Loader2,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { ORDER_CONFIG } from '../config/orderConfig';
import { useAuth } from '../contexts/AuthContext';
import { BOOK_THEMES, type ThemeId } from '../data/themes';
import {
  ColoringApiError,
  generateColoringPageApi,
  type AdminDebugInfo,
  type ColoringGenerationResponse,
  type ProviderId,
} from '../services/coloringApi';
import { saveGenerationLog } from '../services/firestoreLogs';
import {
  validateSinglePhotoFile,
  type ValidatedPhoto,
} from '../utils/photoValidation';
import { AdminTelemetryPanel } from './AdminTelemetryPanel';

interface PhotoGeneratorSectionProps {
  externalTrigger?: number;
}

async function downloadColoringResultAsPng(result: ColoringGenerationResponse) {
  if (result.outputFormat === 'raster') {
    const link = document.createElement('a');
    link.href = result.imageDataUrl;
    link.download = 'colorastoria-pagina.png';
    link.click();
    return;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Impossibile esportare in PNG'));
    img.src = result.imageDataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 2000;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = 'colorastoria-pagina.png';
    link.click();
  }
}

export function PhotoGeneratorSection({
  externalTrigger = 0,
}: PhotoGeneratorSectionProps) {
  const {
    user,
    isAdmin,
    idToken,
    promptVersions,
    activePromptVersion,
    providers,
  } = useAuth();

  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId | null>('pirati');
  const [photo, setPhoto] = useState<ValidatedPhoto | null>(null);

  const [selectedPromptVersion, setSelectedPromptVersion] = useState<string>('');
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId | ''>('');

  const [isValidatingPhoto, setIsValidatingPhoto] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [themeError, setThemeError] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiErrorDetails, setApiErrorDetails] = useState<AdminDebugInfo | null>(
    null
  );
  const [copiedError, setCopiedError] = useState(false);
  const [result, setResult] = useState<ColoringGenerationResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const photoRef = useRef<ValidatedPhoto | null>(photo);
  photoRef.current = photo;

  useEffect(() => {
    if (!isAdmin) {
      setSelectedPromptVersion('');
      setSelectedProviderId('');
      return;
    }

    if (activePromptVersion && !selectedPromptVersion) {
      setSelectedPromptVersion(activePromptVersion);
    }
    const defaultProvider = providers.find((p) => p.isDefault);
    if (defaultProvider && !selectedProviderId) {
      setSelectedProviderId(defaultProvider.id);
    }
  }, [
    isAdmin,
    activePromptVersion,
    providers,
    selectedPromptVersion,
    selectedProviderId,
  ]);

  useEffect(() => {
    return () => {
      if (photoRef.current) {
        URL.revokeObjectURL(photoRef.current.previewUrl);
      }
    };
  }, []);

  const handleFileChosen = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsValidatingPhoto(true);
    setPhotoError(null);
    setApiError(null);
    setApiErrorDetails(null);

    const { accepted, rejected } = await validateSinglePhotoFile(files[0]);
    if (rejected) {
      setPhotoError(rejected.reason);
      setIsValidatingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (accepted) {
      if (photo) {
        URL.revokeObjectURL(photo.previewUrl);
      }
      setPhoto(accepted);
      setResult(null);
    }

    setIsValidatingPhoto(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePhoto = () => {
    if (photo) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    setPhoto(null);
    setResult(null);
    setPhotoError(null);
    setApiError(null);
    setApiErrorDetails(null);
    setCopiedError(false);
  };

  const handleCopyAdminError = async () => {
    if (!apiError) return;
    const lines: string[] = [`Errore: ${apiError}`];
    if (apiErrorDetails) {
      if (apiErrorDetails.statusCode !== undefined) {
        lines.push(
          `HTTP: ${apiErrorDetails.statusCode} ${apiErrorDetails.statusText ?? ''} (${apiErrorDetails.contentType ?? 'unknown'})`.trim()
        );
      }
      if (apiErrorDetails.backendDetails) {
        lines.push(
          `Classe: ${apiErrorDetails.backendDetails.errorName ?? 'Error'} · Provider: ${apiErrorDetails.backendDetails.provider ?? 'default'}`
        );
        if (apiErrorDetails.backendDetails.rawMessage) {
          lines.push(`Raw message:\n${apiErrorDetails.backendDetails.rawMessage}`);
        }
      }
      if (apiErrorDetails.rawBodySnippet) {
        lines.push(`Raw response:\n${apiErrorDetails.rawBodySnippet}`);
      }
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n\n'));
      setCopiedError(true);
      window.setTimeout(() => setCopiedError(false), 2000);
    } catch {
      // Fallback ignored if clipboard permissions are blocked
    }
  };

  const runGeneration = async () => {
    setThemeError(null);
    setPhotoError(null);
    setApiError(null);
    setApiErrorDetails(null);
    setCopiedError(false);

    if (!selectedThemeId) {
      setThemeError('Scegli uno dei sei mondi illustrati.');
      return;
    }
    if (!photo) {
      setPhotoError('Carica una foto prima di avviare la generazione.');
      return;
    }

    setIsGenerating(true);
    try {
      const freshToken =
        isAdmin && user ? await user.getIdToken() : idToken ?? undefined;

      const generated = await generateColoringPageApi({
        file: photo.file,
        themeId: selectedThemeId,
        providerId: isAdmin && selectedProviderId ? selectedProviderId : undefined,
        promptVersion:
          isAdmin && selectedPromptVersion ? selectedPromptVersion : undefined,
        idToken: freshToken,
      });
      setResult(generated);

      if (isAdmin && user && generated.adminTelemetry) {
        void saveGenerationLog({
          adminUid: user.uid,
          themeId: selectedThemeId,
          telemetry: generated.adminTelemetry,
        }).catch((err) => {
          console.warn('Firestore generation log save failed:', err);
        });
      }

      window.setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
    } catch (err) {
      if (err instanceof ColoringApiError) {
        setApiError(err.message);
        setApiErrorDetails(err.adminDebugInfo ?? null);
      } else {
        setApiError(
          err instanceof Error
            ? err.message
            : 'Errore imprevisto durante la generazione. Riprova.'
        );
        setApiErrorDetails(
          err instanceof Error
            ? { rawBodySnippet: `${err.name}: ${err.message}` }
            : { rawBodySnippet: String(err) }
        );
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const lastExternalRef = useRef(externalTrigger);
  useEffect(() => {
    if (externalTrigger !== lastExternalRef.current) {
      lastExternalRef.current = externalTrigger;
      if (!isGenerating) {
        void runGeneration();
      }
    }
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isGenerating) {
      void runGeneration();
    }
  };

  const selectedTheme = BOOK_THEMES.find((t) => t.id === selectedThemeId) ?? null;

  return (
    <div className="max-w-4xl space-y-10">
      <form onSubmit={handleSubmit} noValidate className="space-y-10">
        {/* Step 1: Scelta dello stile */}
        <fieldset className="space-y-4">
          <legend className="text-xl sm:text-2xl font-semibold text-zinc-900">
            1. Scegli lo stile del mondo
          </legend>
          <p className="text-sm text-zinc-600">
            Seleziona uno dei sei temi disponibili per ambientare la tua pagina da colorare.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 pt-1">
            {BOOK_THEMES.map((theme) => {
              const isSelected = selectedThemeId === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedThemeId(theme.id);
                    setThemeError(null);
                  }}
                  className={`text-left rounded-2xl border p-3 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B83B1F] ${
                    isSelected
                      ? 'border-[#B83B1F] bg-[#FDF1ED]/55 ring-1 ring-[#B83B1F]'
                      : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-[#FBFBF9]'
                  }`}
                >
                  <div className="aspect-[18/13] w-full rounded-xl overflow-hidden border border-zinc-200/80 bg-white mb-3">
                    {theme.renderIllustration('w-full h-full')}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-zinc-900">
                      {theme.name}
                    </span>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-[#B83B1F] text-white flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-600 leading-snug">
                    {theme.description}
                  </p>
                </button>
              );
            })}
          </div>

          {themeError && (
            <p className="flex items-center gap-2 text-sm text-red-700 font-medium" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{themeError}</span>
            </p>
          )}
        </fieldset>

        {/* Step 2: Caricamento della foto */}
        <div className="pt-8 border-t border-zinc-200 space-y-4">
          <h3 className="text-xl sm:text-2xl font-semibold text-zinc-900">
            2. Scegli una foto
          </h3>

          <div className="rounded-xl bg-[#FBFBF9] border border-zinc-200 p-4 space-y-2 text-sm text-zinc-700">
            <p className="font-semibold text-zinc-900">
              Consigli per ottenere un disegno nitido:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-zinc-600">
              <li className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#B83B1F] shrink-0" aria-hidden="true" />
                <span>Volto ben visibile e frontale</span>
              </li>
              <li className="flex items-center gap-2">
                <Sun className="w-4 h-4 text-[#B83B1F] shrink-0" aria-hidden="true" />
                <span>Foto nitida, luminosa e senza sfocature</span>
              </li>
            </ul>
            <p className="text-xs text-zinc-500 pt-1">
              Formati accettati: {ORDER_CONFIG.acceptedExtensionsLabel} · Almeno{' '}
              <span className="font-mono-num">400×400 px</span> · Max{' '}
              <span className="font-mono-num">{ORDER_CONFIG.maxFileSizeMb} MB</span>.
            </p>
          </div>

          {!photo ? (
            <div
              onDragOver={(e: DragEvent<HTMLDivElement>) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e: DragEvent<HTMLDivElement>) => {
                e.preventDefault();
                setIsDragOver(false);
                void handleFileChosen(e.dataTransfer.files);
              }}
              className={`rounded-2xl border-2 border-dashed p-7 sm:p-10 text-center transition-colors ${
                isDragOver
                  ? 'border-[#B83B1F] bg-[#FDF1ED]/60'
                  : photoError
                    ? 'border-red-400 bg-red-50/30'
                    : 'border-zinc-300 bg-[#FBFBF9]'
              }`}
            >
              <input
                ref={fileInputRef}
                id="single-photo-input"
                type="file"
                accept={ORDER_CONFIG.acceptedMimeTypes.join(',')}
                onChange={(e) => void handleFileChosen(e.target.files)}
                className="sr-only"
                disabled={isValidatingPhoto || isGenerating}
              />

              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-[#B83B1F]">
                  {isValidatingPhoto ? (
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <ImagePlus className="w-5 h-5" aria-hidden="true" />
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-sm sm:text-base font-medium text-zinc-900">
                    Trascina qui la tua foto oppure sceglila dal dispositivo
                  </p>
                  <p className="text-xs sm:text-sm text-zinc-600">
                    La foto viene elaborata solo per creare questa pagina da colorare.
                  </p>
                </div>

                <label
                  htmlFor="single-photo-input"
                  className="mt-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isValidatingPhoto ? 'Controllo foto...' : 'Scegli una foto'}
                </label>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-[#FBFBF9] p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-full sm:w-44 aspect-[4/3] rounded-xl overflow-hidden border border-zinc-200 bg-white shrink-0">
                <img
                  src={photo.previewUrl}
                  alt={`Anteprima foto caricata: ${photo.name}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-sm font-semibold text-zinc-900 truncate">
                  {photo.name}
                </p>
                <p className="font-mono-num text-xs text-zinc-600">
                  {photo.width} × {photo.height} px ·{' '}
                  {(photo.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <label
                    htmlFor="replace-photo-input"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Cambia foto
                  </label>
                  <input
                    id="replace-photo-input"
                    type="file"
                    accept={ORDER_CONFIG.acceptedMimeTypes.join(',')}
                    onChange={(e) => void handleFileChosen(e.target.files)}
                    className="sr-only"
                    disabled={isGenerating}
                  />
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-white border border-zinc-300 rounded-lg hover:bg-red-50 hover:border-red-200 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Rimuovi
                  </button>
                </div>
              </div>
            </div>
          )}

          {photoError && (
            <p className="flex items-center gap-2 text-sm text-red-700 font-medium" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{photoError}</span>
            </p>
          )}
        </div>

        {/* Step 3: Genera subito sotto */}
        <div className="pt-8 border-t border-zinc-200 space-y-4">
          <div className="space-y-1">
            <h3 className="text-xl sm:text-2xl font-semibold text-zinc-900">
              3. Genera la pagina da colorare
            </h3>
            <p className="text-sm text-zinc-600">
              Premi il pulsante qui sotto per trasformare la foto nello stile{' '}
              <span className="font-medium text-zinc-900">
                {selectedTheme ? selectedTheme.name : 'selezionato'}
              </span>
              .
            </p>
          </div>

          {isAdmin && (
            <div className="rounded-xl border border-zinc-200 bg-[#FBFBF9] p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#B83B1F]" aria-hidden="true" />
                <span>Controlli Admin</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-700">
                    Versione prompt
                  </span>
                  <select
                    value={selectedPromptVersion}
                    onChange={(e) => setSelectedPromptVersion(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-[#B83B1F] focus:outline-none"
                  >
                    {promptVersions.map((ver) => (
                      <option key={ver} value={ver}>
                        {ver}
                        {ver === activePromptVersion ? ' (attiva)' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-700">
                    Provider AI configurato
                  </span>
                  <select
                    value={selectedProviderId}
                    onChange={(e) =>
                      setSelectedProviderId(e.target.value as ProviderId)
                    }
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-[#B83B1F] focus:outline-none"
                  >
                    {providers.map((p) => (
                      <option key={p.id} value={p.id} disabled={!p.configured}>
                        {p.label} · {p.model}
                        {!p.configured ? ' (non configurato)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}

          {apiError && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3"
              role="alert"
            >
              <div className="flex items-start gap-2 text-sm text-red-800">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{apiError}</span>
              </div>

              {isAdmin && apiErrorDetails && (
                <div className="rounded-lg border border-red-200 bg-white p-3 space-y-2 text-xs text-red-950">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[11px] uppercase tracking-wider text-red-700">
                      Dettaglio errore completo (Admin)
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleCopyAdminError()}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-zinc-300 bg-[#FBFBF9] hover:bg-zinc-100 text-[11px] font-medium text-zinc-800 transition-colors cursor-pointer shrink-0"
                    >
                      {copiedError ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                          <span>Copiato</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Copia</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="font-mono-num space-y-1 break-words">
                    {apiErrorDetails.statusCode !== undefined && (
                      <p>
                        HTTP: {apiErrorDetails.statusCode}{' '}
                        {apiErrorDetails.statusText ?? ''}{' '}
                        {apiErrorDetails.contentType
                          ? `(${apiErrorDetails.contentType})`
                          : ''}
                      </p>
                    )}
                    {apiErrorDetails.backendDetails && (
                      <>
                        <p>
                          Classe: {apiErrorDetails.backendDetails.errorName ?? 'Error'} ·
                          Provider: {apiErrorDetails.backendDetails.provider ?? 'default'}
                        </p>
                        {apiErrorDetails.backendDetails.rawMessage && (
                          <pre className="mt-1 whitespace-pre-wrap rounded bg-red-50/70 p-2 text-[11px] text-red-900 overflow-x-auto">
                            {apiErrorDetails.backendDetails.rawMessage}
                          </pre>
                        )}
                      </>
                    )}
                    {apiErrorDetails.rawBodySnippet && (
                      <pre className="mt-1 whitespace-pre-wrap rounded bg-zinc-50 border border-zinc-200 p-2 text-[11px] text-zinc-800 overflow-x-auto">
                        {apiErrorDetails.rawBodySnippet}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => void runGeneration()}
                  className="text-sm font-semibold text-red-900 underline hover:no-underline cursor-pointer"
                >
                  Riprova generazione
                </button>
                {apiErrorDetails?.isProxyCookieCheck && (
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="text-sm font-semibold text-zinc-800 underline hover:no-underline cursor-pointer"
                  >
                    Ricarica la pagina
                  </button>
                )}
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isGenerating}
              className="inline-flex items-center justify-center gap-2 min-h-[50px] px-8 py-3.5 rounded-xl bg-[#B83B1F] hover:bg-[#9E3119] disabled:bg-zinc-400 text-white font-semibold text-base transition-colors cursor-pointer disabled:cursor-wait whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B83B1F]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  <span>Generazione in corso...</span>
                </>
              ) : (
                <span>Genera pagina da colorare</span>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Risultato subito sotto allo step Genera */}
      {result && photo && (
        <div
          ref={resultRef}
          className="rounded-2xl border border-zinc-200 bg-[#FBFBF9] p-6 sm:p-8 space-y-6"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold text-zinc-900">
                La tua pagina da colorare è pronta
              </h3>
              <p className="text-sm text-zinc-600">{result.sceneSummary}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => void downloadColoringResultAsPng(result)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#B83B1F] hover:bg-[#9E3119] text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                Scarica PNG da stampare
              </button>
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-800 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                Prova un’altra foto
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <figure className="space-y-2">
              <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-zinc-200 bg-white">
                <img
                  src={photo.previewUrl}
                  alt="Fotografia originale caricata"
                  className="w-full h-full object-cover"
                />
              </div>
              <figcaption className="text-xs font-medium text-zinc-600">
                1. Foto originale
              </figcaption>
            </figure>

            <figure className="space-y-2">
              <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-zinc-200 bg-white flex items-center justify-center p-3">
                <img
                  src={result.imageDataUrl}
                  alt="Pagina da colorare generata dalla foto"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              </div>
              <figcaption className="text-xs font-medium text-zinc-600">
                2. Pagina da colorare ({selectedTheme?.name})
              </figcaption>
            </figure>
          </div>
        </div>
      )}

      {/* Telemetria costi e storico Firestore visibile solo all'Admin autenticato */}
      {isAdmin && (
        <AdminTelemetryPanel latestTelemetry={result?.adminTelemetry ?? null} />
      )}
    </div>
  );
}
