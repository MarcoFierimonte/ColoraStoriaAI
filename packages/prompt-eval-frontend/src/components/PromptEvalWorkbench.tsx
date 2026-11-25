import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
} from 'react';
import {
  AlertCircle,
  ArrowDown,
  Check,
  Clock,
  Copy,
  Download,
  FileArchive,
  FileJson,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  Mail,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Star,
  Trash2,
  Type as TypeIcon,
  Upload,
  X,
  Zap,
  ZoomIn,
} from 'lucide-react';
import {
  estimateTextTokenCount,
  isTerminalRunStatus,
  type PromptCatalogDefinition,
  type PromptCatalogField,
  type PromptEvalConfigResponse,
  type PromptEvalDatasetDetail,
  type PromptEvalDatasetSummary,
  type PromptEvalItem,
  type PromptEvalModality,
  type PromptEvalModelInfo,
  type PromptEvalRunDetail,
  type PromptEvalRunStatus,
  type PromptEvalRunSummary,
  type PromptEvalVerdict,
  type PromptExecutionMode,
  type ResolvedPromptPreview,
} from '../../../prompt-eval-core/src/index.ts';
import type { PromptEvalApiClient } from '../promptEvalClient.interface.ts';
import {
  downloadItemOutput,
  downloadRunReportJson,
  downloadRunZipArchive,
} from '../utils/download.ts';

export interface PromptEvalQuickSampleOption {
  id: string;
  label: string;
  loadFiles: () => Promise<File[]>;
}

export interface PromptEvalWorkbenchProps {
  client: PromptEvalApiClient;
  getAuthToken: () => Promise<string | null>;
  defaultNotifyEmail?: string | null;
  initialRunId?: string | null;
  onSelectRunId?: (runId: string | null) => void;
  quickSamples?: PromptEvalQuickSampleOption[];
}

interface QueuedImageEntry {
  id: string;
  file: File;
  previewUrl: string;
  sizeKb: number;
}

interface QueuedDatasetImageEntry {
  queueKey: string;
  datasetId: string;
  datasetName: string;
  datasetSource: 'repo' | 'app';
  itemId: string;
  name: string;
  sizeKb: number;
  thumbnailUrl?: string;
}

interface QueuedTextEntry {
  id: string;
  name: string;
  text: string;
}

const RUN_STATUS_META: Record<
  PromptEvalRunStatus,
  { label: string; bg: string }
> = {
  queued: { label: 'In coda Batch', bg: 'bg-[var(--cs-yellow,#ffe680)]' },
  running: { label: 'In elaborazione', bg: 'bg-[var(--cs-blue,#9acfff)]' },
  completed: { label: 'Completato', bg: 'bg-[var(--cs-mint,#b4f0cb)]' },
  partial: { label: 'Parziale', bg: 'bg-[var(--cs-yellow,#ffe680)]' },
  failed: { label: 'Fallito', bg: 'bg-[var(--cs-danger-bg,#ffe4e8)]' },
  cancelled: { label: 'Annullato', bg: 'bg-white' },
};

const VERDICT_OPTIONS: Array<{
  value: PromptEvalVerdict;
  label: string;
  activeBg: string;
}> = [
  {
    value: 'pass',
    label: 'Promosso',
    activeBg: 'bg-[var(--cs-mint,#b4f0cb)]',
  },
  {
    value: 'needs_work',
    label: 'Da migliorare',
    activeBg: 'bg-[var(--cs-yellow,#ffe680)]',
  },
  {
    value: 'fail',
    label: 'Scartato',
    activeBg: 'bg-[var(--cs-danger-bg,#ffe4e8)]',
  },
];

function formatDateTime(ms: number | null | undefined): string {
  if (!ms) return '—';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

function formatUsd(amount: number, digits = 4): string {
  return `$${amount.toFixed(digits)}`;
}

function isFieldVisible(
  field: PromptCatalogField,
  params: Record<string, string>
): boolean {
  if (!field.visibleWhen) return true;
  const currentValue = params[field.visibleWhen.fieldId] ?? '';
  return field.visibleWhen.values.includes(currentValue);
}

function buildDefaultCatalogParams(
  catalog: PromptCatalogDefinition | undefined
): Record<string, string> {
  if (!catalog) return {};
  const defaults: Record<string, string> = {};
  for (const field of catalog.fields) {
    defaults[field.id] =
      field.defaultValue ?? field.options?.[0]?.value ?? '';
  }
  return defaults;
}

function StarRatingInput(props: {
  value: number | null;
  onChange: (next: number | null) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="inline-flex items-center gap-1"
      role="group"
      aria-label={props.ariaLabel}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const active = (props.value ?? 0) >= star;
        return (
          <button
            key={star}
            type="button"
            onClick={() =>
              props.onChange(props.value === star ? null : star)
            }
            aria-label={`${star} su 5 stelle`}
            aria-pressed={active}
            className="p-0.5 cursor-pointer transition-transform hover:scale-110"
          >
            <Star
              className={`h-4 w-4 ${
                active
                  ? 'fill-[var(--cs-yellow,#ffe680)] text-[var(--cs-ink,#24284f)]'
                  : 'text-[var(--cs-ink-muted,#4b5075)]'
              }`}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}

function inferMimeTypeFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.avif')) return 'image/avif';
  return '';
}

function pickValidEmail(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim() ?? '';
    if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return trimmed;
    }
  }
  return '';
}

interface ItemEvaluationCardProps {
  item: PromptEvalItem;
  modality: PromptEvalModality;
  runTitle: string;
  runStatus: PromptEvalRunStatus;
  onZoom: (url: string, label: string) => void;
  onSaveEvaluation: (
    itemId: string,
    patch: {
      rating: number | null;
      verdict: PromptEvalVerdict | null;
      notes: string;
    }
  ) => Promise<boolean>;
}

function ItemEvaluationCard({
  item,
  modality,
  runTitle,
  runStatus,
  onZoom,
  onSaveEvaluation,
}: ItemEvaluationCardProps) {
  const [rating, setRating] = useState<number | null>(
    item.evaluation?.rating ?? null
  );
  const [verdict, setVerdict] = useState<PromptEvalVerdict | null>(
    item.evaluation?.verdict ?? null
  );
  const [notes, setNotes] = useState<string>(item.evaluation?.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setRating(item.evaluation?.rating ?? null);
    setVerdict(item.evaluation?.verdict ?? null);
    setNotes(item.evaluation?.notes ?? '');
    setSaveError(null);
  }, [
    item.id,
    item.evaluation?.rating,
    item.evaluation?.verdict,
    item.evaluation?.notes,
  ]);

  const isDirty =
    rating !== (item.evaluation?.rating ?? null) ||
    verdict !== (item.evaluation?.verdict ?? null) ||
    notes.trim() !== (item.evaluation?.notes ?? '').trim();

  const handleSave = async () => {
    setIsSaving(true);
    setSavedNotice(false);
    setSaveError(null);
    try {
      const ok = await onSaveEvaluation(item.id, { rating, verdict, notes });
      if (ok) {
        setSavedNotice(true);
        window.setTimeout(() => setSavedNotice(false), 2000);
      } else {
        setSaveError('Salvataggio non riuscito.');
      }
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Salvataggio non riuscito.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className="rounded-[12px] border-[3px] border-[var(--cs-border,#24284f)] bg-white p-3.5 shadow-[4px_4px_0_var(--cs-border,#24284f)] flex flex-col gap-3 [content-visibility:auto] [contain-intrinsic-size:auto_none_auto_420px]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-mono-num font-bold text-[var(--cs-ink-muted,#4b5075)]">
            #{item.index + 1}
            {item.inputWidth && item.inputHeight
              ? ` · ${item.inputWidth}×${item.inputHeight}px`
              : ''}
          </p>
          <h5 className="text-sm font-bold text-[var(--cs-ink,#24284f)] truncate">
            {item.inputName}
          </h5>
        </div>

        <span
          className={`inline-block rounded-[8px] border-2 border-[var(--cs-border,#24284f)] px-2 py-0.5 text-[11px] font-bold ${
            item.status === 'completed'
              ? 'bg-[var(--cs-mint,#b4f0cb)]'
              : item.status === 'failed'
                ? 'bg-[var(--cs-danger-bg,#ffe4e8)] text-[var(--cs-danger-ink,#8f1d2c)]'
                : 'bg-[var(--cs-yellow,#ffe680)]'
          }`}
        >
          {item.status === 'completed'
            ? 'Completato'
            : item.status === 'failed'
              ? 'Errore'
              : item.status === 'running'
                ? 'In corso'
                : 'In coda'}
        </span>
      </div>

      {/* Media comparison / output */}
      {item.outputImageDataUrl || item.inputThumbnailDataUrl ? (
        <div className="grid grid-cols-1 sm:grid-cols-[96px_1fr] gap-2.5 items-start">
          {item.inputThumbnailDataUrl ? (
            <div className="space-y-1">
              <span className="block text-[10px] font-bold uppercase text-[var(--cs-ink-muted,#4b5075)]">
                Originale
              </span>
              <button
                type="button"
                onClick={() =>
                  onZoom(
                    item.inputThumbnailDataUrl!,
                    `Originale · ${item.inputName}`
                  )
                }
                className="w-full aspect-[3/4] rounded-[8px] border-2 border-[var(--cs-border,#24284f)] overflow-hidden bg-[var(--cs-bg,#fff8d9)] cursor-pointer"
              >
                <img
                  src={item.inputThumbnailDataUrl}
                  alt={`Input ${item.inputName}`}
                  className="w-full h-full object-cover"
                />
              </button>
            </div>
          ) : null}

          <div className="space-y-1">
            <span className="block text-[10px] font-bold uppercase text-[var(--cs-ink-muted,#4b5075)]">
              Output AI
            </span>
            {item.outputImageDataUrl ? (
              <div className="relative group rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-white overflow-hidden aspect-[3/4] max-h-[300px] mx-auto">
                <img
                  src={item.outputImageDataUrl}
                  alt={`Risultato ${item.inputName}`}
                  className="w-full h-full object-contain bg-white"
                />
                <button
                  type="button"
                  onClick={() =>
                    onZoom(item.outputImageDataUrl!, `Output · ${item.inputName}`)
                  }
                  aria-label={`Ingrandisci risultato ${item.inputName}`}
                  className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-yellow,#ffe680)] px-2 py-1 text-[11px] font-bold cursor-pointer"
                >
                  <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Zoom</span>
                </button>
              </div>
            ) : item.status === 'failed' ? (
              <div className="rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-danger-bg,#ffe4e8)] p-3 text-xs font-bold text-[var(--cs-danger-ink,#8f1d2c)]">
                {item.errorMessage ?? 'Generazione fallita.'}
              </div>
            ) : (
              <div className="rounded-[8px] border-2 border-dashed border-[var(--cs-border,#24284f)] bg-[var(--cs-bg,#fff8d9)] p-4 text-xs text-[var(--cs-ink-muted,#4b5075)] text-center">
                {runStatus === 'cancelled'
                  ? 'Job Batch annullato prima del completamento.'
                  : isTerminalRunStatus(runStatus)
                    ? modality === 'text'
                      ? 'Nessun output generato per questo input.'
                      : 'Nessun output generato per questa immagine.'
                    : 'In attesa di risposta dal job Batch…'}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {item.inputText ? (
        <div className="rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-bg,#fff8d9)] p-2.5 text-xs">
          <p className="font-bold text-[10px] uppercase text-[var(--cs-ink-muted,#4b5075)] mb-1">
            Input testo
          </p>
          <p className="whitespace-pre-wrap">{item.inputText}</p>
        </div>
      ) : null}

      {item.outputText ? (
        <div className="rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-sky,#e4f3ff)]/50 p-2.5 text-xs">
          <p className="font-bold text-[10px] uppercase text-[var(--cs-ink-muted,#4b5075)] mb-1">
            Risposta testuale
          </p>
          <p className="whitespace-pre-wrap max-h-48 overflow-y-auto">
            {item.outputText}
          </p>
        </div>
      ) : null}

      {!item.outputImageDataUrl &&
      !item.inputThumbnailDataUrl &&
      !item.outputText &&
      item.status !== 'failed' ? (
        <div className="rounded-[8px] border-2 border-dashed border-[var(--cs-border,#24284f)] bg-[var(--cs-bg,#fff8d9)] p-4 text-xs text-[var(--cs-ink-muted,#4b5075)] text-center">
          {runStatus === 'cancelled'
            ? 'Job Batch annullato prima del completamento.'
            : isTerminalRunStatus(runStatus)
              ? modality === 'text'
                ? 'Nessun output generato per questo input.'
                : 'Nessun output generato per questa immagine.'
              : 'In attesa di risposta dal job Batch…'}
        </div>
      ) : null}

      {item.status === 'failed' && !item.outputImageDataUrl && !item.inputThumbnailDataUrl ? (
        <div className="rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-danger-bg,#ffe4e8)] p-2.5 text-xs font-bold text-[var(--cs-danger-ink,#8f1d2c)]">
          {item.errorMessage ?? 'Elaborazione fallita.'}
        </div>
      ) : null}

      {/* Telemetry + Download */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-num text-[var(--cs-ink-muted,#4b5075)]">
        <div className="flex flex-wrap items-center gap-2">
          {item.usage ? (
            <span>
              {formatUsd(item.usage.estimatedCostUsd, 5)}
              {item.usage.batchDiscountApplied ? ' (-50%)' : ''}
            </span>
          ) : null}
          {item.usage ? (
            <span>
              tok {item.usage.inputTokens}/
              {item.usage.textOutputTokens + item.usage.imageOutputTokens}
            </span>
          ) : null}
          {typeof item.latencyMs === 'number' ? (
            <span>{item.latencyMs} ms</span>
          ) : null}
        </div>

        {item.outputImageDataUrl || item.outputText ? (
          <button
            type="button"
            onClick={() => void downloadItemOutput(item, runTitle)}
            className="inline-flex items-center gap-1 rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-sky,#e4f3ff)] px-2.5 py-1 text-xs font-bold text-[var(--cs-ink,#24284f)] cursor-pointer hover:bg-[var(--cs-blue,#9acfff)]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Salva su dispositivo</span>
          </button>
        ) : null}
      </div>

      {/* Per-item evaluation */}
      <div className="border-t-2 border-[var(--cs-border,#24284f)]/20 pt-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StarRatingInput
            value={rating}
            onChange={setRating}
            ariaLabel={`Valutazione in stelle per ${item.inputName}`}
          />
          <div className="flex flex-wrap items-center gap-1">
            {VERDICT_OPTIONS.map((opt) => {
              const selected = verdict === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setVerdict(selected ? null : opt.value)
                  }
                  className={`rounded-[6px] border-2 border-[var(--cs-border,#24284f)] px-2 py-0.5 text-[11px] font-bold cursor-pointer ${
                    selected ? opt.activeBg : 'bg-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <textarea
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={
            modality === 'text'
              ? 'Note su questo output (es. accuratezza, chiarezza, aderenza al prompt…)'
              : 'Note su questa immagine (es. aderenza al prompt, qualità visiva, dettagli…)'
          }
          className="h-auto w-full min-h-[3lh] max-h-[10lh] [field-sizing:content] rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-bg,#fff8d9)]/50 px-2.5 py-1.5 text-xs focus:bg-white focus:outline-none"
        />

        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-[11px] ${
              saveError
                ? 'font-bold text-[var(--cs-danger-ink,#8f1d2c)]'
                : 'text-[var(--cs-ink-muted,#4b5075)]'
            }`}
          >
            {saveError
              ? saveError
              : savedNotice
                ? 'Valutazione salvata!'
                : item.evaluation?.updatedAtMs
                  ? `Salvata: ${formatDateTime(item.evaluation.updatedAtMs)}`
                  : 'Non ancora valutata'}
          </span>
          <button
            type="button"
            disabled={isSaving || !isDirty}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-1 rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-mint,#b4f0cb)] px-2.5 py-1 text-xs font-bold text-[var(--cs-ink,#24284f)] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isSaving ? 'Salvo…' : 'Salva nota'}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

interface ZoomLightboxDialogProps {
  media: { url: string; label: string } | null;
  onClose: () => void;
}

function isPointerOutsideLightbox(
  event: PointerEvent<HTMLDialogElement>,
  dialog: HTMLDialogElement
): boolean {
  const rect = dialog.getBoundingClientRect();
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}

function ZoomLightboxDialog({ media, onClose }: ZoomLightboxDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedOutsideRef = useRef(false);
  const openRef = useRef(media !== null);
  openRef.current = media !== null;
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (media && !dialog.open) {
      dialog.showModal();
    } else if (!media && dialog.open) {
      dialog.close();
    }
  }, [media]);

  const supportsClosedBy =
    typeof HTMLDialogElement !== 'undefined' &&
    'closedBy' in HTMLDialogElement.prototype;

  const handlePointerDown = (event: PointerEvent<HTMLDialogElement>) => {
    if (supportsClosedBy) {
      pressedOutsideRef.current = false;
      return;
    }
    const dialog = dialogRef.current;
    pressedOutsideRef.current = dialog
      ? isPointerOutsideLightbox(event, dialog)
      : false;
  };

  const handlePointerUp = (event: PointerEvent<HTMLDialogElement>) => {
    const wasPressedOutside = pressedOutsideRef.current;
    pressedOutsideRef.current = false;
    if (supportsClosedBy || !wasPressedOutside) return;
    const dialog = dialogRef.current;
    if (dialog && isPointerOutsideLightbox(event, dialog)) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby={titleId}
      onClose={() => {
        if (dialogRef.current) {
          dialogRef.current.returnValue = '';
        }
        if (openRef.current) {
          onClose();
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className="m-auto w-[min(48rem,calc(100%-2rem))] max-h-[90dvh] rounded-[14px] border-[3px] border-[var(--cs-border,#24284f)] bg-white p-0 text-[var(--cs-ink,#24284f)] shadow-[6px_6px_0_var(--cs-border,#24284f)] overflow-y-auto [overscroll-behavior:contain] backdrop:bg-black/70 backdrop:overflow-hidden backdrop:[overscroll-behavior:contain]"
    >
      {media ? (
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h1 id={titleId} className="text-sm font-bold truncate">
              {media.label}
            </h1>
            <button
              type="button"
              autoFocus
              onClick={onClose}
              aria-label="Chiudi anteprima ingrandita"
              className="rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-bg,#fff8d9)] p-1.5 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="overflow-auto flex items-center justify-center bg-[var(--cs-bg,#fff8d9)]/40 rounded-[10px] border-2 border-[var(--cs-border,#24284f)] p-2">
            <img
              src={media.url}
              alt={media.label}
              className="max-h-[75dvh] w-auto object-contain bg-white"
            />
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

export function PromptEvalWorkbench({
  client,
  getAuthToken,
  defaultNotifyEmail = null,
  initialRunId = null,
  onSelectRunId,
  quickSamples = [],
}: PromptEvalWorkbenchProps) {
  const [config, setConfig] = useState<PromptEvalConfigResponse | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Prompt & execution composer state
  const [modality, setModality] = useState<PromptEvalModality>('image');
  const [executionMode, setExecutionMode] =
    useState<PromptExecutionMode>('batch');
  const [providerId, setProviderId] = useState<string>('gemini');
  const [modelId, setModelId] = useState<string>('');
  const [promptSource, setPromptSource] = useState<'catalog' | 'custom'>(
    'catalog'
  );
  const [catalogId, setCatalogId] = useState<string>('');
  const [catalogParams, setCatalogParams] = useState<Record<string, string>>(
    {}
  );
  const [resolvedPrompt, setResolvedPrompt] =
    useState<ResolvedPromptPreview | null>(null);
  const [isResolvingPrompt, setIsResolvingPrompt] = useState(false);
  const [customPromptText, setCustomPromptText] = useState<string>('');
  const [runTitle, setRunTitle] = useState<string>('');
  const [notifyEmail, setNotifyEmail] = useState<string>(
    defaultNotifyEmail ?? ''
  );
  const [autoEmailOnComplete, setAutoEmailOnComplete] = useState<boolean>(true);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Datasets (repo + app) & multi-image / text inputs
  const [datasets, setDatasets] = useState<PromptEvalDatasetSummary[]>([]);
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(false);
  const [loadingDatasetId, setLoadingDatasetId] = useState<string | null>(null);
  const [exportingDatasetId, setExportingDatasetId] = useState<string | null>(
    null
  );
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [confirmDeleteDatasetId, setConfirmDeleteDatasetId] = useState<
    string | null
  >(null);
  const [isDeletingDataset, setIsDeletingDataset] = useState(false);
  const [showCreateDatasetForm, setShowCreateDatasetForm] = useState(false);
  const [newDatasetName, setNewDatasetName] = useState('');
  const [newDatasetDescription, setNewDatasetDescription] = useState('');
  const [isSavingDataset, setIsSavingDataset] = useState(false);

  const [queuedDatasetItems, setQueuedDatasetItems] = useState<
    QueuedDatasetImageEntry[]
  >([]);
  const [queuedImages, setQueuedImages] = useState<QueuedImageEntry[]>([]);
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);
  const [queuedTexts, setQueuedTexts] = useState<QueuedTextEntry[]>([
    { id: 'txt-1', name: 'Testo #1', text: '' },
  ]);
  const [isSubmittingRun, setIsSubmittingRun] = useState(false);

  // Runs history & active run detail
  const [runs, setRuns] = useState<PromptEvalRunSummary[]>([]);
  const [historyFilter, setHistoryFilter] = useState<
    'all' | 'batch' | 'standard' | 'active'
  >('all');
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [selectedRun, setSelectedRun] = useState<PromptEvalRunDetail | null>(
    null
  );
  const [isLoadingRunDetail, setIsLoadingRunDetail] = useState(false);
  const [isRefreshingBatch, setIsRefreshingBatch] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [detailEmail, setDetailEmail] = useState<string>(
    defaultNotifyEmail ?? ''
  );
  const [confirmDeleteRunId, setConfirmDeleteRunId] = useState<string | null>(
    null
  );
  const [isDeletingRun, setIsDeletingRun] = useState(false);
  const [copiedRunPrompt, setCopiedRunPrompt] = useState(false);
  const [showRunPrompt, setShowRunPrompt] = useState(false);

  // Run-level evaluation form state
  const [runRating, setRunRating] = useState<number | null>(null);
  const [runNotes, setRunNotes] = useState<string>('');
  const [runTagsText, setRunTagsText] = useState<string>('');
  const [isSavingRunEval, setIsSavingRunEval] = useState(false);
  const [runEvalSavedMsg, setRunEvalSavedMsg] = useState<string | null>(null);

  // Lightbox zoom state
  const [zoomedMedia, setZoomedMedia] = useState<{
    url: string;
    label: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composerSectionRef = useRef<HTMLElement | null>(null);
  const resultsSectionRef = useRef<HTMLElement | null>(null);
  const queuedDatasetItemsRef = useRef<QueuedDatasetImageEntry[]>([]);
  const queuedImagesRef = useRef<QueuedImageEntry[]>([]);
  const getAuthTokenRef = useRef(getAuthToken);
  const onSelectRunIdRef = useRef(onSelectRunId);
  const selectedRunIdRef = useRef<string | null>(null);
  const initialRunIdOnMountRef = useRef<string | null>(initialRunId);
  const hasAppliedDefaultEmailRef = useRef<boolean>(Boolean(defaultNotifyEmail));
  const hasInitializedRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const textEntrySeqRef = useRef<number>(1);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    getAuthTokenRef.current = getAuthToken;
  }, [getAuthToken]);

  useEffect(() => {
    onSelectRunIdRef.current = onSelectRunId;
  }, [onSelectRunId]);

  useEffect(() => {
    selectedRunIdRef.current = selectedRun?.id ?? null;
  }, [selectedRun?.id]);

  useEffect(() => {
    queuedDatasetItemsRef.current = queuedDatasetItems;
  }, [queuedDatasetItems]);

  useEffect(() => {
    queuedImagesRef.current = queuedImages;
  }, [queuedImages]);

  useEffect(() => {
    return () => {
      for (const item of queuedImagesRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  // Apply defaultNotifyEmail at most once when auth email first arrives,
  // without preventing the user from clearing or editing the field.
  useEffect(() => {
    if (defaultNotifyEmail && !hasAppliedDefaultEmailRef.current) {
      hasAppliedDefaultEmailRef.current = true;
      setNotifyEmail(defaultNotifyEmail);
    }
  }, [defaultNotifyEmail]);

  const modalityCatalogs = useMemo(
    () =>
      (config?.catalogs ?? []).filter((cat) =>
        cat.supportedModalities.includes(modality)
      ),
    [config, modality]
  );

  const activeCatalog = useMemo(
    () =>
      modalityCatalogs.find((cat) => cat.id === catalogId) ??
      modalityCatalogs[0],
    [modalityCatalogs, catalogId]
  );

  const activeProvider = useMemo(
    () =>
      config?.providers.find((p) => p.id === providerId) ??
      config?.providers[0],
    [config, providerId]
  );

  const modalityModels = useMemo(
    () =>
      (activeProvider?.models ?? []).filter((m) => m.modality === modality),
    [activeProvider, modality]
  );

  const activeModel: PromptEvalModelInfo | undefined = useMemo(
    () =>
      modalityModels.find((m) => m.id === modelId) ?? modalityModels[0],
    [modalityModels, modelId]
  );

  const loadDatasetsList = useCallback(async () => {
    setIsLoadingDatasets(true);
    try {
      const token = await getAuthTokenRef.current();
      const list = await client.listDatasets(token);
      if (isMountedRef.current) {
        setDatasets(list);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setGlobalError(
          err instanceof Error
            ? err.message
            : 'Impossibile caricare i dataset disponibili.'
        );
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingDatasets(false);
      }
    }
  }, [client]);

  const loadRunsList = useCallback(async () => {
    setIsLoadingRuns(true);
    try {
      const token = await getAuthTokenRef.current();
      const items = await client.listRuns(token, 50);
      setRuns(items);
    } catch (err) {
      setGlobalError(
        err instanceof Error
          ? err.message
          : 'Impossibile caricare lo storico dei test.'
      );
    } finally {
      setIsLoadingRuns(false);
    }
  }, [client]);

  const selectRun = useCallback(
    async (runId: string, syncUrl = true) => {
      setIsLoadingRunDetail(true);
      setConfirmDeleteRunId(null);
      setGlobalError(null);
      try {
        const token = await getAuthTokenRef.current();
        const detail = await client.getRun(runId, token);
        selectedRunIdRef.current = detail.id;
        setSelectedRun(detail);
        if (syncUrl) {
          onSelectRunIdRef.current?.(detail.id);
        }
      } catch (err) {
        setGlobalError(
          err instanceof Error
            ? err.message
            : 'Impossibile caricare i dettagli del test.'
        );
      } finally {
        setIsLoadingRunDetail(false);
      }
    },
    [client]
  );

  // One-time initial load: config + runs list + initial deep-linked run.
  // Intentionally decoupled from `initialRunId` and `getAuthToken` so selecting runs
  // or refreshing Firebase ID tokens never unmounts the workbench or resets composer state.
  useEffect(() => {
    let cancelled = false;
    setIsLoadingConfig(true);
    setGlobalError(null);

    void (async () => {
      try {
        const token = await getAuthTokenRef.current();
        const [cfg, runList, datasetList] = await Promise.all([
          client.fetchConfig(token),
          client.listRuns(token, 50),
          client.listDatasets(token).catch(() => []),
        ]);
        if (cancelled) return;
        setConfig(cfg);
        setRuns(runList);
        setDatasets(datasetList);

        const defaultProvider =
          cfg.providers.find((p) => p.isDefault && p.configured) ??
          cfg.providers.find((p) => p.configured) ??
          cfg.providers[0];
        let initialModelFormat: 'raster' | 'svg' | 'text' | undefined;
        if (defaultProvider) {
          setProviderId(defaultProvider.id);
          const firstImageModel =
            defaultProvider.models.find(
              (m) => m.id === defaultProvider.defaultModel && m.modality === 'image'
            ) ?? defaultProvider.models.find((m) => m.modality === 'image');
          if (firstImageModel) {
            setModelId(firstImageModel.id);
            initialModelFormat = firstImageModel.outputFormat;
          }
        }

        const firstCatalog = cfg.catalogs[0];
        if (firstCatalog) {
          setCatalogId(firstCatalog.id);
          const defaults = buildDefaultCatalogParams(firstCatalog);
          const outputFormatField = firstCatalog.fields.find(
            (f) => f.id === 'outputFormat'
          );
          if (
            outputFormatField &&
            initialModelFormat &&
            outputFormatField.options?.some((o) => o.value === initialModelFormat)
          ) {
            defaults.outputFormat = initialModelFormat;
          }
          setCatalogParams(defaults);
          setPromptSource('catalog');
        } else {
          setPromptSource('custom');
        }

        const requestedRunId = initialRunIdOnMountRef.current;
        let loadedDetail: PromptEvalRunDetail | null = null;
        if (requestedRunId) {
          try {
            loadedDetail = await client.getRun(requestedRunId, token);
          } catch {
            loadedDetail = null;
          }
        }
        if (!loadedDetail && runList[0]?.id) {
          loadedDetail = await client.getRun(runList[0].id, token);
        }
        if (!cancelled && loadedDetail) {
          setSelectedRun(loadedDetail);
          if (!runList.some((r) => r.id === loadedDetail.id)) {
            const { items: _items, ...summary } = loadedDetail;
            setRuns((prev) => [summary, ...prev]);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setGlobalError(
            err instanceof Error
              ? err.message
              : 'Impossibile inizializzare il Laboratorio Prompt.'
          );
        }
      } finally {
        if (!cancelled) {
          hasInitializedRef.current = true;
          setIsLoadingConfig(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client]);

  // Sync external URL navigation (e.g. browser back/forward or email deep link)
  // without re-initializing the workbench or wiping composer state.
  useEffect(() => {
    if (!hasInitializedRef.current || !initialRunId) return;
    if (initialRunId === selectedRunIdRef.current) return;
    void selectRun(initialRunId, false);
  }, [initialRunId, selectRun]);

  // Keep promptSource valid when switching between modalities (e.g. text without a text catalog)
  useEffect(() => {
    if (modalityCatalogs.length === 0 && promptSource === 'catalog') {
      setPromptSource('custom');
    } else if (
      modalityCatalogs.length > 0 &&
      !modalityCatalogs.some((cat) => cat.id === catalogId)
    ) {
      setCatalogId(modalityCatalogs[0].id);
      setCatalogParams(buildDefaultCatalogParams(modalityCatalogs[0]));
    }
  }, [modalityCatalogs, promptSource, catalogId]);

  // Keep selected model valid whenever provider or modality changes
  useEffect(() => {
    if (!activeProvider) return;
    const valid = activeProvider.models.filter((m) => m.modality === modality);
    if (valid.length > 0 && !valid.some((m) => m.id === modelId)) {
      setModelId(valid[0].id);
    }
  }, [activeProvider, modality, modelId]);

  // Automatically sync catalog outputFormat (raster vs svg) when the selected model changes
  const activeModelOutputFormat = activeModel?.outputFormat;
  const activeCatalogHasOutputFormat = useMemo(
    () =>
      Boolean(
        activeCatalog?.fields.some(
          (f) =>
            f.id === 'outputFormat' &&
            activeModelOutputFormat &&
            f.options?.some((opt) => opt.value === activeModelOutputFormat)
        )
      ),
    [activeCatalog, activeModelOutputFormat]
  );

  useEffect(() => {
    if (
      modality !== 'image' ||
      !activeCatalogHasOutputFormat ||
      !activeModelOutputFormat ||
      (activeModelOutputFormat !== 'raster' && activeModelOutputFormat !== 'svg')
    ) {
      return;
    }
    setCatalogParams((prev) =>
      prev.outputFormat === activeModelOutputFormat
        ? prev
        : { ...prev, outputFormat: activeModelOutputFormat }
    );
  }, [modality, activeCatalogHasOutputFormat, activeModelOutputFormat]);

  // If user switches to a model that does not support batch, automatically switch to standard
  useEffect(() => {
    if (activeModel && !activeModel.supportsBatch && executionMode === 'batch') {
      setExecutionMode('standard');
      setAutoEmailOnComplete(false);
    }
  }, [activeModel, executionMode]);

  // Resolve full prompt preview whenever catalog selection changes
  useEffect(() => {
    if (promptSource !== 'catalog' || !activeCatalog) return;
    let cancelled = false;
    setIsResolvingPrompt(true);

    void (async () => {
      try {
        const token = await getAuthTokenRef.current();
        const preview = await client.resolveCatalogPrompt(
          activeCatalog.id,
          catalogParams,
          token
        );
        if (!cancelled) {
          setResolvedPrompt(preview);
          setGlobalError((prev) =>
            prev?.includes('anteprima del prompt') ? null : prev
          );
        }
      } catch (err) {
        if (!cancelled) {
          setGlobalError(
            err instanceof Error
              ? err.message
              : 'Impossibile generare l’anteprima del prompt.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsResolvingPrompt(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [promptSource, activeCatalog, catalogParams, client]);

  // Sync run-level evaluation & email fields when selectedRun changes
  useEffect(() => {
    setRunRating(selectedRun?.evaluation?.overallRating ?? null);
    setRunNotes(selectedRun?.evaluation?.notes ?? '');
    setRunTagsText((selectedRun?.evaluation?.tags ?? []).join(', '));
    setRunEvalSavedMsg(null);
    setConfirmDeleteRunId(null);
    setDetailEmail(
      pickValidEmail(
        selectedRun?.notifyEmail,
        selectedRun?.createdByEmail,
        defaultNotifyEmail
      )
    );
  }, [
    selectedRun?.id,
    selectedRun?.notifyEmail,
    selectedRun?.createdByEmail,
    selectedRun?.evaluation?.overallRating,
    selectedRun?.evaluation?.notes,
    selectedRun?.evaluation?.updatedAtMs,
    defaultNotifyEmail,
  ]);

  // Auto-poll active batch run every 25s while viewing it
  const selectedRunId = selectedRun?.id ?? null;
  const selectedRunIsActiveBatch = Boolean(
    selectedRun &&
      selectedRun.executionMode === 'batch' &&
      !isTerminalRunStatus(selectedRun.status)
  );

  const handleRefreshBatch = useCallback(
    async (runId: string, silent = false) => {
      if (!silent) setIsRefreshingBatch(true);
      try {
        const token = await getAuthTokenRef.current();
        const updated = await client.refreshBatchRun(runId, token);
        setSelectedRun(updated);
        setRuns((prev) =>
          prev.map((entry) =>
            entry.id === updated.id
              ? {
                  ...entry,
                  status: updated.status,
                  completedItems: updated.completedItems,
                  failedItems: updated.failedItems,
                  totalEstimatedCostUsd: updated.totalEstimatedCostUsd,
                  notificationStatus: updated.notificationStatus,
                  updatedAtMs: updated.updatedAtMs,
                  completedAtMs: updated.completedAtMs,
                }
              : entry
          )
        );
        if (!silent) {
          setStatusNotice(
            isTerminalRunStatus(updated.status)
              ? `Batch aggiornato: stato ${RUN_STATUS_META[updated.status].label} (${updated.completedItems}/${updated.totalItems}).`
              : `Batch ancora in corso (${updated.externalBatchState ?? updated.status}).`
          );
        }
      } catch (err) {
        if (!silent) {
          setGlobalError(
            err instanceof Error
              ? err.message
              : 'Impossibile aggiornare lo stato del job batch.'
          );
        }
      } finally {
        if (!silent) setIsRefreshingBatch(false);
      }
    },
    [client]
  );

  useEffect(() => {
    if (!selectedRunId || !selectedRunIsActiveBatch) return;
    const timer = window.setInterval(() => {
      void handleRefreshBatch(selectedRunId, true);
    }, 25_000);
    return () => window.clearInterval(timer);
  }, [selectedRunId, selectedRunIsActiveBatch, handleRefreshBatch]);

  const addFilesToQueue = useCallback(
    async (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      if (list.length === 0) return;

      const maxImages = config?.limits.maxImagesPerRun ?? 20;
      const accepted = new Set(
        config?.limits.acceptedMimeTypes ?? [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/avif',
        ]
      );
      const maxBytes = (config?.limits.maxFileSizeMb ?? 12) * 1024 * 1024;
      const errors: string[] = [];
      const additions: QueuedImageEntry[] = [];

      setIsReadingFiles(true);
      try {
        for (const rawFile of list) {
          if (
            queuedDatasetItemsRef.current.length +
              queuedImagesRef.current.length +
              additions.length >=
            maxImages
          ) {
            errors.push(
              `Limite massimo raggiunto (${maxImages} immagini per run).`
            );
            break;
          }
          const effectiveMime =
            rawFile.type || inferMimeTypeFromFilename(rawFile.name);
          if (!effectiveMime || !accepted.has(effectiveMime)) {
            errors.push(
              `"${rawFile.name}": formato ${rawFile.type || 'sconosciuto'} non ammesso.`
            );
            continue;
          }
          if (rawFile.size > maxBytes) {
            errors.push(
              `"${rawFile.name}": supera il limite di ${config?.limits.maxFileSizeMb ?? 12} MB.`
            );
            continue;
          }

          // Snapshot file bytes into RAM immediately so subsequent runs never fail
          // with net::ERR_UPLOAD_FILE_CHANGED if the user moves/renames local files.
          let inMemoryFile: File;
          try {
            const buffer = await rawFile.arrayBuffer();
            inMemoryFile = new File([buffer], rawFile.name, {
              type: effectiveMime,
              lastModified: rawFile.lastModified,
            });
          } catch {
            errors.push(
              `"${rawFile.name}": impossibile leggere il file dal disco.`
            );
            continue;
          }

          additions.push({
            id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            file: inMemoryFile,
            previewUrl: URL.createObjectURL(inMemoryFile),
            sizeKb: Math.max(1, Math.round(inMemoryFile.size / 1024)),
          });
        }

        if (!isMountedRef.current) {
          for (const item of additions) {
            URL.revokeObjectURL(item.previewUrl);
          }
          return;
        }

        if (additions.length > 0) {
          const next = [...queuedImagesRef.current, ...additions];
          queuedImagesRef.current = next;
          setQueuedImages(next);
          if (queuedDatasetItemsRef.current.length === 0) {
            setActiveDatasetId(null);
          }
        }

        if (errors.length > 0) {
          setGlobalError(errors.join(' '));
        } else {
          setGlobalError(null);
        }
      } finally {
        if (isMountedRef.current) {
          setIsReadingFiles(false);
        }
      }
    },
    [config]
  );

  const removeQueuedDatasetItem = (queueKey: string) => {
    const next = queuedDatasetItemsRef.current.filter(
      (item) => item.queueKey !== queueKey
    );
    queuedDatasetItemsRef.current = next;
    setQueuedDatasetItems(next);
    if (next.length === 0) {
      setActiveDatasetId(null);
    }
  };

  const removeQueuedImage = (id: string) => {
    const target = queuedImagesRef.current.find((item) => item.id === id);
    if (target) {
      URL.revokeObjectURL(target.previewUrl);
    }
    const next = queuedImagesRef.current.filter((item) => item.id !== id);
    queuedImagesRef.current = next;
    setQueuedImages(next);
  };

  const clearQueuedImages = () => {
    for (const item of queuedImagesRef.current) {
      URL.revokeObjectURL(item.previewUrl);
    }
    queuedImagesRef.current = [];
    setQueuedImages([]);
    queuedDatasetItemsRef.current = [];
    setQueuedDatasetItems([]);
    setActiveDatasetId(null);
  };

  const mapDatasetDetailToQueueEntries = (
    detail: PromptEvalDatasetDetail
  ): QueuedDatasetImageEntry[] =>
    detail.items.map((item) => ({
      queueKey: `${detail.id}::${item.id}`,
      datasetId: detail.id,
      datasetName: detail.name,
      datasetSource: detail.source,
      itemId: item.id,
      name: item.name,
      sizeKb: Math.max(1, Math.round(item.sizeBytes / 1024)),
      thumbnailUrl: item.thumbnailDataUrl,
    }));

  const handleSelectDataset = async (
    datasetId: string,
    mode: 'replace' | 'append'
  ) => {
    setLoadingDatasetId(datasetId);
    setGlobalError(null);
    try {
      const token = await getAuthTokenRef.current();
      const detail = await client.getDataset(datasetId, token);
      if (!isMountedRef.current) return;

      const maxImages = config?.limits.maxImagesPerRun ?? 20;
      const incomingEntries = mapDatasetDetailToQueueEntries(detail);

      if (mode === 'replace') {
        for (const item of queuedImagesRef.current) {
          URL.revokeObjectURL(item.previewUrl);
        }
        queuedImagesRef.current = [];
        setQueuedImages([]);
        const capped = incomingEntries.slice(0, maxImages);
        queuedDatasetItemsRef.current = capped;
        setQueuedDatasetItems(capped);
        setActiveDatasetId(detail.id);
        setStatusNotice(
          `Dataset "${detail.name}" (${capped.length} foto · ${detail.source === 'repo' ? 'Repository' : 'App'}) caricato nella coda di test.`
        );
      } else {
        const existingKeys = new Set(
          queuedDatasetItemsRef.current.map((entry) => entry.queueKey)
        );
        const remainingSlots = Math.max(
          0,
          maxImages -
            (queuedDatasetItemsRef.current.length +
              queuedImagesRef.current.length)
        );
        const toAppend = incomingEntries
          .filter((entry) => !existingKeys.has(entry.queueKey))
          .slice(0, remainingSlots);
        const next = [...queuedDatasetItemsRef.current, ...toAppend];
        queuedDatasetItemsRef.current = next;
        setQueuedDatasetItems(next);
        if (toAppend.length === 0) {
          setGlobalError(
            remainingSlots === 0
              ? `Limite massimo di ${maxImages} immagini già raggiunto nella coda.`
              : `Tutte le immagini di "${detail.name}" sono già presenti nella coda.`
          );
        } else {
          setStatusNotice(
            `Aggiunte ${toAppend.length} foto dal dataset "${detail.name}".`
          );
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        setGlobalError(
          err instanceof Error
            ? err.message
            : 'Impossibile caricare le immagini del dataset selezionato.'
        );
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingDatasetId(null);
      }
    }
  };

  const handleCreateDatasetFromQueue = async () => {
    if (isSavingDataset) return;
    const trimmedName = newDatasetName.trim();
    if (!trimmedName) {
      setGlobalError('Inserisci un nome per il nuovo dataset prima di salvarlo.');
      return;
    }
    if (
      queuedDatasetItemsRef.current.length === 0 &&
      queuedImagesRef.current.length === 0
    ) {
      setGlobalError(
        'Seleziona o carica almeno una foto nella coda prima di creare il dataset.'
      );
      return;
    }

    setIsSavingDataset(true);
    setGlobalError(null);
    setStatusNotice(null);
    try {
      const token = await getAuthTokenRef.current();
      const created = await client.createDataset(
        {
          name: trimmedName,
          description: newDatasetDescription.trim() || undefined,
          sourceItems:
            queuedDatasetItemsRef.current.length > 0
              ? queuedDatasetItemsRef.current.map((entry) => ({
                  datasetId: entry.datasetId,
                  itemId: entry.itemId,
                }))
              : undefined,
          files:
            queuedImagesRef.current.length > 0
              ? queuedImagesRef.current.map((entry) => entry.file)
              : undefined,
        },
        token
      );
      if (!isMountedRef.current) return;

      const { items: _items, ...summary } = created;
      setDatasets((prev) => [
        ...prev.filter((d) => d.source === 'repo'),
        summary,
        ...prev.filter((d) => d.source !== 'repo' && d.id !== summary.id),
      ]);

      for (const local of queuedImagesRef.current) {
        URL.revokeObjectURL(local.previewUrl);
      }
      queuedImagesRef.current = [];
      setQueuedImages([]);

      const savedEntries = mapDatasetDetailToQueueEntries(created);
      queuedDatasetItemsRef.current = savedEntries;
      setQueuedDatasetItems(savedEntries);
      setActiveDatasetId(created.id);
      setNewDatasetName('');
      setNewDatasetDescription('');
      setShowCreateDatasetForm(false);
      setStatusNotice(
        `Nuovo dataset "${created.name}" (${created.itemCount} foto) creato nell’app e selezionato per i test!`
      );
    } catch (err) {
      if (isMountedRef.current) {
        setGlobalError(
          err instanceof Error
            ? err.message
            : 'Errore durante il salvataggio del dataset.'
        );
      }
    } finally {
      if (isMountedRef.current) {
        setIsSavingDataset(false);
      }
    }
  };

  const handleDeleteDataset = async (datasetId: string) => {
    setIsDeletingDataset(true);
    setGlobalError(null);
    try {
      const token = await getAuthTokenRef.current();
      await client.deleteDataset(datasetId, token);
      if (!isMountedRef.current) return;

      setDatasets((prev) => prev.filter((d) => d.id !== datasetId));
      const remainingQueue = queuedDatasetItemsRef.current.filter(
        (entry) => entry.datasetId !== datasetId
      );
      queuedDatasetItemsRef.current = remainingQueue;
      setQueuedDatasetItems(remainingQueue);
      if (activeDatasetId === datasetId) {
        setActiveDatasetId(null);
      }
      setConfirmDeleteDatasetId(null);
      setStatusNotice('Dataset eliminato.');
    } catch (err) {
      if (isMountedRef.current) {
        setGlobalError(
          err instanceof Error
            ? err.message
            : 'Impossibile eliminare il dataset.'
        );
      }
    } finally {
      if (isMountedRef.current) {
        setIsDeletingDataset(false);
      }
    }
  };

  const handleDownloadDatasetZip = async (dataset: PromptEvalDatasetSummary) => {
    setExportingDatasetId(dataset.id);
    setGlobalError(null);
    try {
      const token = await getAuthTokenRef.current();
      const { blob, filename } = await client.exportDatasetArchive(
        dataset.id,
        token
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (err) {
      setGlobalError(
        err instanceof Error
          ? err.message
          : 'Impossibile scaricare l’archivio ZIP del dataset.'
      );
    } finally {
      if (isMountedRef.current) {
        setExportingDatasetId(null);
      }
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer?.files?.length) {
      const droppedFiles = Array.from(event.dataTransfer.files);
      void addFilesToQueue(droppedFiles);
    }
  };

  const handleLoadQuickSample = async (sample: PromptEvalQuickSampleOption) => {
    setLoadingSampleId(sample.id);
    setGlobalError(null);
    try {
      const files = await sample.loadFiles();
      await addFilesToQueue(files);
    } catch (err) {
      setGlobalError(
        err instanceof Error
          ? err.message
          : 'Impossibile caricare le immagini di esempio.'
      );
    } finally {
      setLoadingSampleId(null);
    }
  };

  const activePromptText =
    promptSource === 'catalog'
      ? (resolvedPrompt?.promptText ?? '')
      : customPromptText;

  const activeImageQueueCount =
    queuedDatasetItems.length + queuedImages.length;

  const activeItemCount =
    modality === 'image'
      ? activeImageQueueCount
      : queuedTexts.filter((t) => t.text.trim().length > 0).length;

  const estimatedStandardTotal =
    (activeModel?.estimatedStandardCostPerItemUsd ?? 0) * activeItemCount;
  const estimatedBatchTotal =
    (activeModel?.estimatedBatchCostPerItemUsd ?? 0) * activeItemCount;

  const handleCopyPrompt = async (text: string, target: 'composer' | 'run') => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (target === 'composer') {
        setCopiedPrompt(true);
        window.setTimeout(() => setCopiedPrompt(false), 2000);
      } else {
        setCopiedRunPrompt(true);
        window.setTimeout(() => setCopiedRunPrompt(false), 2000);
      }
    } catch {
      setStatusNotice('Impossibile accedere agli appunti: seleziona e copia il testo manualmente.');
    }
  };

  const handleStartRun = async () => {
    if (isSubmittingRun) return;
    setGlobalError(null);
    setStatusNotice(null);

    if (modality === 'image' && activeImageQueueCount === 0) {
      setGlobalError(
        'Seleziona un dataset oppure carica almeno un’immagine prima di avviare il test.'
      );
      return;
    }
    if (modality === 'text' && activeItemCount === 0) {
      setGlobalError('Inserisci almeno un testo di input prima di avviare il test.');
      return;
    }
    if (!activePromptText.trim()) {
      setGlobalError('Il prompt selezionato è vuoto.');
      return;
    }

    setIsSubmittingRun(true);
    try {
      const token = await getAuthTokenRef.current();
      const effectiveNotifyEmail =
        autoEmailOnComplete && notifyEmail.trim()
          ? notifyEmail.trim()
          : undefined;
      const created = await client.createRun(
        {
          title: runTitle.trim() || undefined,
          modality,
          executionMode,
          providerId: activeProvider?.id,
          model: activeModel?.id,
          promptSource,
          catalogId: promptSource === 'catalog' ? activeCatalog?.id : undefined,
          promptParams: promptSource === 'catalog' ? catalogParams : undefined,
          customPromptText:
            promptSource === 'custom' ? customPromptText : undefined,
          notifyEmail: effectiveNotifyEmail,
          datasetItems:
            modality === 'image' && queuedDatasetItems.length > 0
              ? queuedDatasetItems.map((entry) => ({
                  datasetId: entry.datasetId,
                  itemId: entry.itemId,
                }))
              : undefined,
          files:
            modality === 'image' && queuedImages.length > 0
              ? queuedImages.map((entry) => entry.file)
              : undefined,
          textInputs:
            modality === 'text'
              ? queuedTexts
                  .filter((t) => t.text.trim().length > 0)
                  .map((t) => ({ name: t.name, text: t.text }))
              : undefined,
        },
        token
      );

      selectedRunIdRef.current = created.id;
      setSelectedRun(created);
      onSelectRunIdRef.current?.(created.id);
      setRuns((prev) => {
        const { items: _items, ...summary } = created;
        return [summary, ...prev.filter((r) => r.id !== summary.id)];
      });
      setRunTitle('');

      if (created.executionMode === 'batch') {
        setStatusNotice(
          `Job Batch API inviato (${created.externalBatchJobId ?? created.id}). Lo stato verrà aggiornato automaticamente e riceverai i risultati via email al completamento (se configurata).`
        );
      } else {
        setStatusNotice(
          `Valutazione completata: ${created.completedItems}/${created.totalItems} elaborate con successo.`
        );
      }
    } catch (err) {
      setGlobalError(
        err instanceof Error
          ? err.message
          : 'Errore durante l’esecuzione della valutazione.'
      );
      void getAuthTokenRef
        .current()
        .then((token) => client.listRuns(token, 50))
        .then((items) => {
          if (isMountedRef.current) {
            setRuns(items);
          }
        })
        .catch(() => undefined);
    } finally {
      setIsSubmittingRun(false);
    }
  };

  const handleReuseRunInComposer = (run: PromptEvalRunDetail) => {
    setGlobalError(null);
    setModality(run.modality);
    setProviderId(run.providerId);
    setModelId(run.model);
    setExecutionMode(run.executionMode);
    if (
      run.promptSource === 'catalog' &&
      run.catalogId &&
      config?.catalogs.some((c) => c.id === run.catalogId)
    ) {
      const matchedCatalog = config.catalogs.find((c) => c.id === run.catalogId);
      setPromptSource('catalog');
      setCatalogId(run.catalogId);
      setCatalogParams({
        ...(matchedCatalog ? buildDefaultCatalogParams(matchedCatalog) : {}),
        ...(run.promptParams ?? {}),
      });
    } else {
      setPromptSource('custom');
      setCustomPromptText(run.promptText);
    }
    setStatusNotice(
      `Impostazioni di "${run.title}" ricaricate nel composer. Modifica il prompt o le immagini e avvia un nuovo test.`
    );
    composerSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const handleSaveRunEvaluation = async () => {
    if (!selectedRun) return;
    setIsSavingRunEval(true);
    setRunEvalSavedMsg(null);
    setGlobalError(null);
    try {
      const token = await getAuthTokenRef.current();
      const tags = runTagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const updated = await client.updateRunEvaluation(
        selectedRun.id,
        {
          overallRating: runRating,
          notes: runNotes,
          tags,
        },
        token
      );
      setSelectedRun(updated);
      setRuns((prev) =>
        prev.map((r) =>
          r.id === updated.id
            ? { ...r, evaluation: updated.evaluation, updatedAtMs: updated.updatedAtMs }
            : r
        )
      );
      setRunEvalSavedMsg('Note e valutazione del run salvate!');
    } catch (err) {
      setGlobalError(
        err instanceof Error
          ? err.message
          : 'Impossibile salvare la valutazione del run.'
      );
    } finally {
      setIsSavingRunEval(false);
    }
  };

  const handleSaveItemEvaluation = async (
    itemId: string,
    patch: {
      rating: number | null;
      verdict: PromptEvalVerdict | null;
      notes: string;
    }
  ): Promise<boolean> => {
    if (!selectedRun) return false;
    setGlobalError(null);
    try {
      const token = await getAuthTokenRef.current();
      const updated = await client.updateItemEvaluation(
        selectedRun.id,
        itemId,
        patch,
        token
      );
      setSelectedRun(updated);
      return true;
    } catch (err) {
      setGlobalError(
        err instanceof Error
          ? err.message
          : 'Impossibile salvare la valutazione dell’elemento.'
      );
      return false;
    }
  };

  const handleCancelBatch = async () => {
    if (!selectedRun) return;
    setGlobalError(null);
    try {
      const token = await getAuthTokenRef.current();
      const updated = await client.cancelBatchRun(selectedRun.id, token);
      setSelectedRun(updated);
      setRuns((prev) =>
        prev.map((r) =>
          r.id === updated.id
            ? {
                ...r,
                status: updated.status,
                failedItems: updated.failedItems,
                notificationStatus: updated.notificationStatus,
                completedAtMs: updated.completedAtMs,
                updatedAtMs: updated.updatedAtMs,
              }
            : r
        )
      );
      setStatusNotice('Job Batch annullato.');
    } catch (err) {
      setGlobalError(
        err instanceof Error
          ? err.message
          : 'Impossibile annullare il job Batch.'
      );
    }
  };

  const handleSendEmail = async () => {
    if (!selectedRun) return;
    setIsSendingEmail(true);
    setGlobalError(null);
    try {
      const token = await getAuthTokenRef.current();
      const updated = await client.notifyRunByEmail(
        selectedRun.id,
        { email: detailEmail.trim() || undefined },
        token
      );
      setSelectedRun(updated);
      setRuns((prev) =>
        prev.map((r) =>
          r.id === updated.id
            ? {
                ...r,
                notifyEmail: updated.notifyEmail,
                notificationStatus: updated.notificationStatus,
                notificationSentAtMs: updated.notificationSentAtMs,
              }
            : r
        )
      );
      setStatusNotice(
        `Email con risultati inviata a ${updated.notifyEmail ?? 'destinatario'}!`
      );
    } catch (err) {
      setGlobalError(
        err instanceof Error
          ? err.message
          : 'Impossibile inviare l’email con i risultati.'
      );
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleDeleteRun = async (runId: string) => {
    if (isDeletingRun) return;
    setIsDeletingRun(true);
    setGlobalError(null);
    try {
      const token = await getAuthTokenRef.current();
      await client.deleteRun(runId, token);
      setConfirmDeleteRunId(null);
      const remaining = runs.filter((r) => r.id !== runId);
      setRuns(remaining);
      if (selectedRun?.id === runId) {
        setSelectedRun(null);
        onSelectRunIdRef.current?.(null);
        if (remaining[0]) {
          void selectRun(remaining[0].id);
        }
      }
      setStatusNotice('Esecuzione eliminata dallo storico.');
    } catch (err) {
      setGlobalError(
        err instanceof Error
          ? err.message
          : 'Impossibile eliminare l’esecuzione.'
      );
    } finally {
      setIsDeletingRun(false);
    }
  };

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      if (historyFilter === 'batch') return run.executionMode === 'batch';
      if (historyFilter === 'standard') return run.executionMode === 'standard';
      if (historyFilter === 'active') return !isTerminalRunStatus(run.status);
      return true;
    });
  }, [runs, historyFilter]);

  if (isLoadingConfig) {
    return (
      <div className="rounded-[14px] border-[3px] border-[var(--cs-border,#24284f)] bg-white p-6 shadow-[5px_5px_0_var(--cs-border,#24284f)] text-sm font-bold">
        Caricamento Laboratorio Prompt &amp; Batch API…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {globalError ? (
        <div
          role="alert"
          className="rounded-[12px] border-[3px] border-[var(--cs-border,#24284f)] bg-[var(--cs-danger-bg,#ffe4e8)] p-3.5 text-sm font-bold text-[var(--cs-danger-ink,#8f1d2c)] flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{globalError}</span>
          </div>
          <button
            type="button"
            onClick={() => setGlobalError(null)}
            aria-label="Chiudi errore"
            className="rounded-[6px] border-2 border-[var(--cs-border,#24284f)] bg-white p-1 cursor-pointer shrink-0"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {statusNotice ? (
        <div
          role="status"
          className="rounded-[12px] border-[3px] border-[var(--cs-border,#24284f)] bg-[var(--cs-mint,#b4f0cb)] p-3.5 text-sm font-bold text-[var(--cs-ink,#24284f)] flex items-start justify-between gap-3"
        >
          <span>{statusNotice}</span>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            aria-label="Chiudi avviso"
            className="rounded-[6px] border-2 border-[var(--cs-border,#24284f)] bg-white p-1 cursor-pointer shrink-0"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* COMPOSER CARD */}
      <section
        ref={composerSectionRef}
        aria-label="Configura nuova valutazione prompt"
        className="rounded-[14px] border-[3px] border-[var(--cs-border,#24284f)] bg-white p-5 shadow-[5px_5px_0_var(--cs-border,#24284f)] space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--cs-ink-muted,#4b5075)]">
              {modality === 'image'
                ? 'Nuova Valutazione · Multi-Immagine & Batch API'
                : 'Nuova Valutazione · Multi-Input Testo & Batch API'}
            </p>
            <h3 className="text-xl font-bold text-[var(--cs-ink,#24284f)]">
              Testa i prompt su più input e salva note e giudizi
            </h3>
          </div>

          {/* Modality toggle (makes package generic for image + text) */}
          <div
            role="group"
            aria-label="Tipo di test"
            className="inline-flex rounded-[10px] border-[3px] border-[var(--cs-border,#24284f)] bg-[var(--cs-bg,#fff8d9)] p-0.5 gap-1"
          >
            <button
              type="button"
              onClick={() => {
                setModality('image');
                if (
                  !customPromptText.trim() &&
                  (config?.catalogs ?? []).some((cat) =>
                    cat.supportedModalities.includes('image')
                  )
                ) {
                  setPromptSource('catalog');
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-xs font-bold cursor-pointer ${
                modality === 'image'
                  ? 'bg-[var(--cs-mint,#b4f0cb)] text-[var(--cs-ink,#24284f)]'
                  : 'text-[var(--cs-ink-muted,#4b5075)]'
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Immagini</span>
            </button>
            <button
              type="button"
              onClick={() => setModality('text')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-xs font-bold cursor-pointer ${
                modality === 'text'
                  ? 'bg-[var(--cs-mint,#b4f0cb)] text-[var(--cs-ink,#24284f)]'
                  : 'text-[var(--cs-ink-muted,#4b5075)]'
              }`}
            >
              <TypeIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Testo</span>
            </button>
          </div>
        </div>

        {/* STEP 1: PROMPT SELECTION + FULL TEXT PREVIEW + COPY */}
        <div className="rounded-[12px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-bg,#fff8d9)] p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-[var(--cs-ink,#24284f)] flex items-center gap-2">
              <span className="inline-grid place-items-center h-6 w-6 rounded-full border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-lavender,#d9ccff)] text-xs">
                1
              </span>
              <span>Seleziona e ispeziona il prompt completo</span>
            </h4>

            {modalityCatalogs.length > 0 ? (
              <div className="inline-flex rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-white p-0.5 gap-0.5">
                <button
                  type="button"
                  onClick={() => setPromptSource('catalog')}
                  className={`px-2.5 py-1 rounded-[6px] text-xs font-bold cursor-pointer ${
                    promptSource === 'catalog'
                      ? 'bg-[var(--cs-yellow,#ffe680)]'
                      : 'text-[var(--cs-ink-muted,#4b5075)]'
                  }`}
                >
                  Combinazioni app
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!customPromptText && resolvedPrompt?.promptText) {
                      setCustomPromptText(resolvedPrompt.promptText);
                    }
                    setPromptSource('custom');
                  }}
                  className={`px-2.5 py-1 rounded-[6px] text-xs font-bold cursor-pointer ${
                    promptSource === 'custom'
                      ? 'bg-[var(--cs-yellow,#ffe680)]'
                      : 'text-[var(--cs-ink-muted,#4b5075)]'
                  }`}
                >
                  Prompt personalizzato
                </button>
              </div>
            ) : null}
          </div>

          {promptSource === 'catalog' && activeCatalog ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeCatalog.fields
                .filter((field) => isFieldVisible(field, catalogParams))
                .map((field) => (
                  <div key={field.id} className="space-y-1.5">
                    <label
                      htmlFor={`pe-field-${field.id}`}
                      className="block text-xs font-bold text-[var(--cs-ink,#24284f)]"
                    >
                      {field.label}
                    </label>
                    {field.type === 'chips' && field.options ? (
                      <div className="flex flex-wrap gap-1.5">
                        {field.options.map((opt) => {
                          const selected = catalogParams[field.id] === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              aria-pressed={selected}
                              onClick={() =>
                                setCatalogParams((prev) => ({
                                  ...prev,
                                  [field.id]: opt.value,
                                }))
                              }
                              className={`rounded-[8px] border-2 border-[var(--cs-border,#24284f)] px-2.5 py-1 text-xs font-bold cursor-pointer transition-colors ${
                                selected
                                  ? 'bg-[var(--cs-mint,#b4f0cb)]'
                                  : 'bg-white hover:bg-[var(--cs-sky,#e4f3ff)]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : field.type === 'select' && field.options ? (
                      <select
                        id={`pe-field-${field.id}`}
                        value={catalogParams[field.id] ?? ''}
                        onChange={(event) =>
                          setCatalogParams((prev) => ({
                            ...prev,
                            [field.id]: event.target.value,
                          }))
                        }
                        className="w-full rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-white px-2.5 py-2 text-xs font-bold"
                      >
                        {field.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`pe-field-${field.id}`}
                        type="text"
                        placeholder={field.placeholder}
                        value={catalogParams[field.id] ?? ''}
                        onChange={(event) =>
                          setCatalogParams((prev) => ({
                            ...prev,
                            [field.id]: event.target.value,
                          }))
                        }
                        className="w-full rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-white px-2.5 py-2 text-xs font-bold"
                      />
                    )}
                  </div>
                ))}
            </div>
          ) : null}

          {/* Full Prompt Text Preview + Copy Button */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-[var(--cs-ink,#24284f)]">
                  Prompt completo{' '}
                  {promptSource === 'catalog' && resolvedPrompt
                    ? `(${resolvedPrompt.label})`
                    : '(modificabile)'}
                </span>
                <span className="font-mono-num text-[11px] text-[var(--cs-ink-muted,#4b5075)]">
                  {activePromptText.length} caratteri · ~
                  {estimateTextTokenCount(activePromptText)} token
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {promptSource === 'catalog' && resolvedPrompt ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomPromptText(resolvedPrompt.promptText);
                      setPromptSource('custom');
                    }}
                    className="inline-flex items-center gap-1 rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-white px-2.5 py-1 text-xs font-bold cursor-pointer hover:bg-[var(--cs-sky,#e4f3ff)]"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Modifica copia</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  disabled={!activePromptText}
                  onClick={() =>
                    void handleCopyPrompt(activePromptText, 'composer')
                  }
                  className="inline-flex items-center gap-1.5 rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-yellow,#ffe680)] px-3 py-1 text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Prompt copiato!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Copia prompt</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {promptSource === 'catalog' ? (
              <pre className="w-full max-h-60 overflow-y-auto whitespace-pre-wrap rounded-[10px] border-2 border-[var(--cs-border,#24284f)] bg-white p-3 text-xs font-mono-num leading-relaxed text-[var(--cs-ink,#24284f)]">
                {isResolvingPrompt
                  ? 'Composizione prompt in corso…'
                  : resolvedPrompt?.promptText || 'Seleziona una combinazione.'}
              </pre>
            ) : (
              <textarea
                rows={7}
                value={customPromptText}
                onChange={(event) => setCustomPromptText(event.target.value)}
                placeholder={
                  modality === 'image'
                    ? 'Scrivi o incolla il prompt completo da testare su ogni immagine…'
                    : 'Scrivi o incolla il prompt completo da testare su ogni input testuale…'
                }
                className="h-auto w-full min-h-[7lh] max-h-[18lh] [field-sizing:content] rounded-[10px] border-2 border-[var(--cs-border,#24284f)] bg-white p-3 text-xs font-mono-num leading-relaxed text-[var(--cs-ink,#24284f)]"
              />
            )}
          </div>
        </div>

        {/* STEP 2: SELECT REPO/APP DATASET OR UPLOAD PHOTOS & CREATE NEW DATASET */}
        <div className="rounded-[12px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-sky,#e4f3ff)]/45 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-[var(--cs-ink,#24284f)] flex items-center gap-2">
              <span className="inline-grid place-items-center h-6 w-6 rounded-full border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-lavender,#d9ccff)] text-xs">
                2
              </span>
              <span>
                {modality === 'image'
                  ? `Dataset & Immagini di test (${activeImageQueueCount}/${config?.limits.maxImagesPerRun ?? 20})`
                  : `Inserisci gli input testuali (${activeItemCount}/${config?.limits.maxTextInputsPerRun ?? 50})`}
              </span>
            </h4>

            {modality === 'image' ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateDatasetForm((prev) => !prev)}
                  className={`inline-flex items-center gap-1 rounded-[8px] border-2 border-[var(--cs-border,#24284f)] px-2.5 py-1 text-xs font-bold cursor-pointer ${
                    showCreateDatasetForm
                      ? 'bg-[var(--cs-lavender,#d9ccff)]'
                      : 'bg-white hover:bg-[var(--cs-yellow,#ffe680)]'
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {showCreateDatasetForm
                      ? 'Chiudi creazione dataset'
                      : 'Crea dataset dall’app'}
                  </span>
                </button>

                {activeImageQueueCount > 0 ? (
                  <button
                    type="button"
                    onClick={clearQueuedImages}
                    className="text-xs font-bold underline decoration-2 text-[var(--cs-danger-ink,#8f1d2c)] cursor-pointer"
                  >
                    Svuota coda
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {modality === 'image' ? (
            <>
              {/* SAVED DATASETS: REPO + APP */}
              <div className="rounded-[10px] border-2 border-[var(--cs-border,#24284f)] bg-white p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FolderOpen
                      className="h-4 w-4 text-[var(--cs-ink,#24284f)]"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--cs-ink,#24284f)]">
                      Dataset disponibili ({datasets.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isLoadingDatasets}
                    onClick={() => void loadDatasetsList()}
                    aria-label="Aggiorna elenco dataset"
                    className="inline-flex items-center gap-1 rounded-[6px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-bg,#fff8d9)] px-2 py-0.5 text-[11px] font-bold cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${isLoadingDatasets ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    <span>Aggiorna</span>
                  </button>
                </div>

                {datasets.length === 0 ? (
                  <p className="text-xs text-[var(--cs-ink-muted,#4b5075)]">
                    Nessun dataset salvato. Aggiungi una cartella{' '}
                    <code className="font-mono-num font-bold">
                      dataset/&lt;nome&gt;/input/
                    </code>{' '}
                    nel repository oppure carica delle foto qui sotto e clicca{' '}
                    <strong>Crea dataset dall’app</strong>.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {datasets.map((ds) => {
                      const isSelectedDataset = activeDatasetId === ds.id;
                      const isLoadingThis = loadingDatasetId === ds.id;
                      return (
                        <div
                          key={ds.id}
                          className={`rounded-[10px] border-2 border-[var(--cs-border,#24284f)] p-3 flex flex-col justify-between gap-2.5 transition-colors ${
                            isSelectedDataset
                              ? 'bg-[var(--cs-mint,#b4f0cb)]/35'
                              : 'bg-[var(--cs-bg,#fff8d9)]/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`rounded-[6px] border border-[var(--cs-border,#24284f)] px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                    ds.source === 'repo'
                                      ? 'bg-[var(--cs-blue,#9acfff)]'
                                      : 'bg-[var(--cs-lavender,#d9ccff)]'
                                  }`}
                                >
                                  {ds.source === 'repo'
                                    ? `REPO · dataset/${ds.slug}`
                                    : 'APP'}
                                </span>
                                <span className="text-[11px] font-mono-num font-bold text-[var(--cs-ink-muted,#4b5075)]">
                                  {ds.itemCount}{' '}
                                  {ds.itemCount === 1 ? 'foto' : 'foto'}
                                </span>
                              </div>
                              <p className="text-sm font-bold text-[var(--cs-ink,#24284f)] truncate">
                                {ds.name}
                              </p>
                              {ds.description ? (
                                <p className="text-[11px] text-[var(--cs-ink-muted,#4b5075)] line-clamp-2">
                                  {ds.description}
                                </p>
                              ) : null}
                            </div>

                            {ds.previewThumbnails.length > 0 ? (
                              <div className="flex items-center gap-1 shrink-0">
                                {ds.previewThumbnails.slice(0, 3).map((thumb, idx) => (
                                  <img
                                    key={`${ds.id}-thumb-${idx}`}
                                    src={thumb}
                                    alt=""
                                    aria-hidden="true"
                                    className="h-10 w-8 rounded-[5px] border border-[var(--cs-border,#24284f)] object-cover bg-white"
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isLoadingThis}
                                onClick={() =>
                                  void handleSelectDataset(ds.id, 'replace')
                                }
                                className="inline-flex items-center gap-1 rounded-[7px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-mint,#b4f0cb)] px-2.5 py-1 text-xs font-bold cursor-pointer disabled:opacity-50"
                              >
                                <span>
                                  {isLoadingThis
                                    ? 'Carico…'
                                    : isSelectedDataset
                                      ? 'Ricarica dataset'
                                      : 'Usa dataset'}
                                </span>
                              </button>

                              {activeImageQueueCount > 0 && !isSelectedDataset ? (
                                <button
                                  type="button"
                                  disabled={isLoadingThis}
                                  onClick={() =>
                                    void handleSelectDataset(ds.id, 'append')
                                  }
                                  className="inline-flex items-center gap-1 rounded-[7px] border-2 border-[var(--cs-border,#24284f)] bg-white px-2 py-1 text-xs font-bold cursor-pointer disabled:opacity-50"
                                >
                                  <Plus className="h-3 w-3" aria-hidden="true" />
                                  <span>Aggiungi</span>
                                </button>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={exportingDatasetId === ds.id}
                                onClick={() => void handleDownloadDatasetZip(ds)}
                                title="Scarica dataset in formato .zip (struttura pronta per dataset/<nome>/input/)"
                                className="inline-flex items-center gap-1 rounded-[7px] border-2 border-[var(--cs-border,#24284f)] bg-white px-2 py-1 text-[11px] font-bold cursor-pointer disabled:opacity-50"
                              >
                                <Download className="h-3 w-3" aria-hidden="true" />
                                <span>
                                  {exportingDatasetId === ds.id ? '…' : 'ZIP'}
                                </span>
                              </button>

                              {!ds.readOnly ? (
                                confirmDeleteDatasetId === ds.id ? (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={isDeletingDataset}
                                      onClick={() =>
                                        void handleDeleteDataset(ds.id)
                                      }
                                      className="rounded-[7px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-danger-bg,#ffe4e8)] px-2 py-1 text-[11px] font-bold text-[var(--cs-danger-ink,#8f1d2c)] cursor-pointer disabled:opacity-50"
                                    >
                                      {isDeletingDataset ? '…' : 'Conferma'}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isDeletingDataset}
                                      onClick={() =>
                                        setConfirmDeleteDatasetId(null)
                                      }
                                      className="rounded-[7px] border-2 border-[var(--cs-border,#24284f)] bg-white px-1.5 py-1 text-[11px] font-bold cursor-pointer"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    aria-label={`Elimina dataset ${ds.name}`}
                                    onClick={() =>
                                      setConfirmDeleteDatasetId(ds.id)
                                    }
                                    className="rounded-[7px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-danger-bg,#ffe4e8)] p-1 text-[var(--cs-danger-ink,#8f1d2c)] cursor-pointer"
                                  >
                                    <Trash2
                                      className="h-3 w-3"
                                      aria-hidden="true"
                                    />
                                  </button>
                                )
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="text-[11px] text-[var(--cs-ink-muted,#4b5075)]">
                  Puoi creare nuovi dataset sia <strong>dal repository</strong>{' '}
                  (cartella <code className="font-mono-num">dataset/&lt;nome&gt;/input/</code>)
                  sia <strong>direttamente dall’app</strong> caricando le foto qui sotto e salvandole.
                </p>
              </div>

              {/* CREATE NEW APP DATASET PANEL (shown on toggle OR whenever local uploaded files are queued) */}
              {showCreateDatasetForm || queuedImages.length > 0 ? (
                <div className="rounded-[10px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-lavender,#d9ccff)]/45 p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--cs-ink,#24284f)]">
                      Salva le foto in coda come nuovo dataset riutilizzabile nell’app (
                      {activeImageQueueCount}{' '}
                      {activeImageQueueCount === 1 ? 'foto' : 'foto'})
                    </span>
                    {activeImageQueueCount === 0 ? (
                      <button
                        type="button"
                        disabled={isReadingFiles}
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1 rounded-[7px] border-2 border-[var(--cs-border,#24284f)] bg-white px-2.5 py-1 text-xs font-bold cursor-pointer"
                      >
                        <Upload className="h-3 w-3" aria-hidden="true" />
                        <span>Scegli foto per il nuovo dataset</span>
                      </button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                    <input
                      type="text"
                      aria-label="Nome del nuovo dataset"
                      placeholder="Nome dataset (es. Giocattoli Set 2)"
                      value={newDatasetName}
                      onChange={(e) => setNewDatasetName(e.target.value)}
                      className="rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                    <input
                      type="text"
                      aria-label="Descrizione opzionale del dataset"
                      placeholder="Descrizione opzionale (es. foto indoor)"
                      value={newDatasetDescription}
                      onChange={(e) => setNewDatasetDescription(e.target.value)}
                      className="rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-white px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      disabled={
                        isSavingDataset ||
                        isReadingFiles ||
                        activeImageQueueCount === 0 ||
                        !newDatasetName.trim()
                      }
                      onClick={() => void handleCreateDatasetFromQueue()}
                      className="inline-flex items-center justify-center gap-1.5 rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-mint,#b4f0cb)] px-3.5 py-1.5 text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {isSavingDataset
                          ? 'Salvataggio…'
                          : `Salva dataset (${activeImageQueueCount})`}
                      </span>
                    </button>
                  </div>
                </div>
              ) : null}

              {/* UPLOAD / ADD LOCAL PHOTOS */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`rounded-[12px] border-[3px] border-dashed border-[var(--cs-border,#24284f)] p-5 text-center transition-colors ${
                  isDragging ? 'bg-[var(--cs-mint,#b4f0cb)]/40' : 'bg-white'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  aria-label="Seleziona immagini da valutare o salvare in un dataset"
                  accept={(
                    config?.limits.acceptedMimeTypes ?? [
                      'image/jpeg',
                      'image/png',
                      'image/webp',
                      'image/avif',
                    ]
                  ).join(',')}
                  onChange={(event) => {
                    if (event.target.files?.length) {
                      const selectedFiles = Array.from(event.target.files);
                      event.target.value = '';
                      void addFilesToQueue(selectedFiles);
                    }
                  }}
                  className="sr-only"
                />
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-6 w-6 text-[var(--cs-ink,#24284f)]" aria-hidden="true" />
                  <p className="text-sm font-bold text-[var(--cs-ink,#24284f)]">
                    Oppure carica foto dal dispositivo (per un test rapido o per creare un nuovo dataset)
                  </p>
                  <p className="text-xs text-[var(--cs-ink-muted,#4b5075)]">
                    Formati: {config?.limits.acceptedExtensionsLabel ?? 'JPG, PNG, WebP o AVIF'} · max{' '}
                    {config?.limits.maxFileSizeMb ?? 12} MB ciascuna · puoi combinare dataset e nuove foto
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isReadingFiles}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-[10px] border-[3px] border-[var(--cs-border,#24284f)] bg-[var(--cs-blue,#9acfff)] px-4 py-2 text-xs font-bold shadow-[3px_3px_0_var(--cs-border,#24284f)] cursor-pointer active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      <span>
                        {isReadingFiles ? 'Lettura file…' : 'Carica foto dal dispositivo'}
                      </span>
                    </button>

                    {quickSamples.map((sample) => (
                      <button
                        key={sample.id}
                        type="button"
                        disabled={loadingSampleId !== null}
                        onClick={() => void handleLoadQuickSample(sample)}
                        className="inline-flex items-center gap-1.5 rounded-[10px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-yellow,#ffe680)] px-3 py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>
                          {loadingSampleId === sample.id
                            ? 'Carico…'
                            : sample.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {activeImageQueueCount > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-[var(--cs-ink,#24284f)]">
                    Coda attiva per il prossimo test ({activeImageQueueCount}{' '}
                    {activeImageQueueCount === 1 ? 'immagine' : 'immagini'})
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                    {queuedDatasetItems.map((item, idx) => (
                      <div
                        key={item.queueKey}
                        className="relative rounded-[10px] border-2 border-[var(--cs-border,#24284f)] bg-white p-1.5 space-y-1"
                      >
                        <button
                          type="button"
                          onClick={() => removeQueuedDatasetItem(item.queueKey)}
                          aria-label={`Rimuovi ${item.name}`}
                          className="absolute right-2 top-2 z-10 rounded-[6px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-danger-bg,#ffe4e8)] p-0.5 text-[var(--cs-danger-ink,#8f1d2c)] cursor-pointer"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                        <div className="aspect-[3/4] rounded-[6px] overflow-hidden bg-[var(--cs-bg,#fff8d9)] flex items-center justify-center">
                          {item.thumbnailUrl ? (
                            <img
                              src={item.thumbnailUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon
                              className="h-6 w-6 text-[var(--cs-ink-muted,#4b5075)]"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <p className="text-[11px] font-bold truncate">
                          #{idx + 1} {item.name}
                        </p>
                        <div className="flex items-center justify-between gap-1 text-[10px] font-mono-num text-[var(--cs-ink-muted,#4b5075)]">
                          <span className="truncate font-bold text-[var(--cs-ink,#24284f)]">
                            {item.datasetSource === 'repo' ? 'REPO' : 'APP'} ·{' '}
                            {item.datasetName}
                          </span>
                          <span className="shrink-0">{item.sizeKb} KB</span>
                        </div>
                      </div>
                    ))}

                    {queuedImages.map((img, idx) => {
                      const displayIndex = queuedDatasetItems.length + idx + 1;
                      return (
                        <div
                          key={img.id}
                          className="relative rounded-[10px] border-2 border-[var(--cs-border,#24284f)] bg-white p-1.5 space-y-1"
                        >
                          <button
                            type="button"
                            onClick={() => removeQueuedImage(img.id)}
                            aria-label={`Rimuovi ${img.file.name}`}
                            className="absolute right-2 top-2 z-10 rounded-[6px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-danger-bg,#ffe4e8)] p-0.5 text-[var(--cs-danger-ink,#8f1d2c)] cursor-pointer"
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                          </button>
                          <div className="aspect-[3/4] rounded-[6px] overflow-hidden bg-[var(--cs-bg,#fff8d9)]">
                            <img
                              src={img.previewUrl}
                              alt={img.file.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <p className="text-[11px] font-bold truncate">
                            #{displayIndex} {img.file.name}
                          </p>
                          <div className="flex items-center justify-between gap-1 text-[10px] font-mono-num text-[var(--cs-ink-muted,#4b5075)]">
                            <span className="font-bold text-[var(--cs-ink,#24284f)]">
                              LOCALE
                            </span>
                            <span>{img.sizeKb} KB</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="space-y-2.5">
              {queuedTexts.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="rounded-[10px] border-2 border-[var(--cs-border,#24284f)] bg-white p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={entry.name}
                      onChange={(e) =>
                        setQueuedTexts((prev) =>
                          prev.map((item) =>
                            item.id === entry.id
                              ? { ...item, name: e.target.value }
                              : item
                          )
                        )
                      }
                      className="rounded-[6px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-bg,#fff8d9)] px-2 py-1 text-xs font-bold"
                    />
                    {queuedTexts.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setQueuedTexts((prev) =>
                            prev.filter((item) => item.id !== entry.id)
                          )
                        }
                        aria-label={`Rimuovi input ${idx + 1}`}
                        className="rounded-[6px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-danger-bg,#ffe4e8)] p-1 text-[var(--cs-danger-ink,#8f1d2c)] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  <textarea
                    rows={2}
                    value={entry.text}
                    placeholder="Testo di input da valutare con il prompt…"
                    onChange={(e) =>
                      setQueuedTexts((prev) =>
                        prev.map((item) =>
                          item.id === entry.id
                            ? { ...item, text: e.target.value }
                            : item
                        )
                      )
                    }
                    className="h-auto w-full min-h-[3lh] max-h-[10lh] [field-sizing:content] rounded-[8px] border-2 border-[var(--cs-border,#24284f)] px-2.5 py-1.5 text-xs"
                  />
                </div>
              ))}
              <button
                type="button"
                disabled={
                  queuedTexts.length >=
                  (config?.limits.maxTextInputsPerRun ?? 50)
                }
                onClick={() =>
                  setQueuedTexts((prev) => [
                    ...prev,
                    {
                      id: `txt-${++textEntrySeqRef.current}`,
                      name: `Testo #${prev.length + 1}`,
                      text: '',
                    },
                  ])
                }
                className="inline-flex items-center gap-1 rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-white px-3 py-1.5 text-xs font-bold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Aggiungi input testo</span>
              </button>
            </div>
          )}
        </div>

        {/* STEP 3: API MODE (STANDARD vs BATCH -50%), MODEL & EMAIL */}
        <div className="rounded-[12px] border-2 border-[var(--cs-border,#24284f)] bg-white p-4 space-y-4">
          <h4 className="text-sm font-bold text-[var(--cs-ink,#24284f)] flex items-center gap-2">
            <span className="inline-grid place-items-center h-6 w-6 rounded-full border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-lavender,#d9ccff)] text-xs">
              3
            </span>
            <span>Modalità API (Standard vs Batch -50%), modello &amp; notifica</span>
          </h4>

          {/* Execution mode cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setExecutionMode('batch');
                setAutoEmailOnComplete(true);
              }}
              disabled={activeModel ? !activeModel.supportsBatch : false}
              aria-pressed={executionMode === 'batch'}
              className={`rounded-[12px] border-[3px] border-[var(--cs-border,#24284f)] p-3.5 text-left transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                executionMode === 'batch'
                  ? 'bg-[var(--cs-mint,#b4f0cb)] shadow-none translate-x-[2px] translate-y-[2px]'
                  : 'bg-white shadow-[4px_4px_0_var(--cs-border,#24284f)]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                  <Layers className="h-4 w-4" aria-hidden="true" />
                  <span>API Batch (-50% costo)</span>
                </span>
                <span className="rounded-[6px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-yellow,#ffe680)] px-1.5 py-0.5 text-[10px] font-bold">
                  Consigliata per test
                </span>
              </div>
              <p className="mt-1.5 text-xs text-[var(--cs-ink-muted,#4b5075)]">
                Elaborazione asincrona ({activeModel?.batchTurnaroundLabel ?? 'entro 24h'}). Riduce del 50% il costo {modality === 'image' ? 'per immagine' : 'per input'} e invia i risultati via email al completamento.
              </p>
              {activeItemCount > 0 ? (
                <p className="mt-2 text-xs font-mono-num font-bold text-[var(--cs-ink,#24284f)]">
                  Stima ({activeItemCount} input): {formatUsd(estimatedBatchTotal, 4)}
                </p>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => {
                setExecutionMode('standard');
                setAutoEmailOnComplete(false);
              }}
              aria-pressed={executionMode === 'standard'}
              className={`rounded-[12px] border-[3px] border-[var(--cs-border,#24284f)] p-3.5 text-left transition-all cursor-pointer ${
                executionMode === 'standard'
                  ? 'bg-[var(--cs-blue,#9acfff)] shadow-none translate-x-[2px] translate-y-[2px]'
                  : 'bg-white shadow-[4px_4px_0_var(--cs-border,#24284f)]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                  <Zap className="h-4 w-4" aria-hidden="true" />
                  <span>API Normali (Standard)</span>
                </span>
                <span className="rounded-[6px] border-2 border-[var(--cs-border,#24284f)] bg-white px-1.5 py-0.5 text-[10px] font-bold">
                  Risultato immediato
                </span>
              </div>
              <p className="mt-1.5 text-xs text-[var(--cs-ink-muted,#4b5075)]">
                Elaborazione sincrona immediata ({activeModel?.standardTurnaroundLabel ?? (modality === 'image' ? '~5–15s/img' : '~1–5s/input')}), {modality === 'image' ? 'un’immagine alla volta' : 'un input alla volta'}, con risultati pronti da scaricare subito sul dispositivo.
              </p>
              {activeItemCount > 0 ? (
                <p className="mt-2 text-xs font-mono-num font-bold text-[var(--cs-ink,#24284f)]">
                  Stima ({activeItemCount} input): {formatUsd(estimatedStandardTotal, 4)}
                </p>
              ) : null}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block space-y-1">
              <span className="text-xs font-bold">Provider AI</span>
              <select
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="w-full rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-white px-2.5 py-2 text-xs font-bold"
              >
                {(config?.providers ?? []).map((provider) => (
                  <option
                    key={provider.id}
                    value={provider.id}
                    disabled={!provider.configured}
                  >
                    {provider.label}
                    {provider.configured ? '' : ' (chiave mancante)'}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs font-bold">Modello</span>
              <select
                value={activeModel?.id ?? ''}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-white px-2.5 py-2 text-xs font-bold font-mono-num"
              >
                {modalityModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                    {model.isFreeTier
                      ? ' · FREE'
                      : ` · Std ~$${model.estimatedStandardCostPerItemUsd.toFixed(3)} / Batch ~$${model.estimatedBatchCostPerItemUsd.toFixed(3)}`}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold">Nome test (opzionale)</span>
              <input
                type="text"
                maxLength={120}
                placeholder="Auto dal prompt"
                value={runTitle}
                onChange={(e) => setRunTitle(e.target.value)}
                className="w-full rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-white px-2.5 py-2 text-xs font-bold"
              />
            </label>
          </div>

          {promptSource === 'catalog' &&
          modality === 'image' &&
          activeModel &&
          catalogParams.outputFormat &&
          catalogParams.outputFormat !== activeModel.outputFormat ? (
            <div className="rounded-[10px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-yellow,#ffe680)] p-2.5 text-xs font-bold text-[var(--cs-ink,#24284f)]">
              Attenzione: l’adattatore prompt selezionato è &laquo;
              {catalogParams.outputFormat.toUpperCase()}&raquo; ma il modello{' '}
              <code className="font-mono-num">{activeModel.id}</code> genera output{' '}
              &laquo;{activeModel.outputFormat.toUpperCase()}&raquo;.
            </div>
          ) : null}

          {/* Async Email Notification Configuration */}
          <div className="rounded-[10px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-bg,#fff8d9)]/65 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-[var(--cs-ink,#24284f)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoEmailOnComplete}
                  onChange={(e) => setAutoEmailOnComplete(e.target.checked)}
                  className="h-4 w-4 accent-[var(--cs-ink,#24284f)] cursor-pointer"
                />
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  Invia email automatica con i risultati{' '}
                  {executionMode === 'batch'
                    ? '(consigliato per Batch asincrono)'
                    : '(opzionale in Standard)'}
                </span>
              </label>

              <span
                className={`rounded-[6px] border-2 border-[var(--cs-border,#24284f)] px-2 py-0.5 text-[10px] font-bold ${
                  config?.emailNotification.configured
                    ? 'bg-[var(--cs-mint,#b4f0cb)]'
                    : 'bg-[var(--cs-yellow,#ffe680)]'
                }`}
              >
                {config?.emailNotification.configured
                  ? `Attivo: ${config.emailNotification.freeTierSummary}`
                  : 'Email server non ancora configurata (free tier pronto)'}
              </span>
            </div>

            {autoEmailOnComplete ? (
              <input
                id="pe-notify-email"
                type="email"
                aria-label="Indirizzo email destinatario risultati"
                placeholder="admin@esempio.it"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                className="w-full sm:max-w-md rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-white px-2.5 py-1.5 text-xs font-bold"
              />
            ) : null}
            {!config?.emailNotification.configured ? (
              <p className="text-[11px] text-[var(--cs-ink-muted,#4b5075)]">
                {config?.emailNotification.freeTierSummary} — anche senza email attiva, tutti i risultati Batch vengono comunque salvati su Firestore e scaricabili da qui.
              </p>
            ) : null}
          </div>

          {globalError ? (
            <div
              role="alert"
              className="rounded-[10px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-danger-bg,#ffe4e8)] p-3 text-xs font-bold text-[var(--cs-danger-ink,#8f1d2c)] flex items-start justify-between gap-2"
            >
              <div className="flex items-start gap-2">
                <AlertCircle
                  className="h-4 w-4 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>{globalError}</span>
              </div>
              <button
                type="button"
                onClick={() => setGlobalError(null)}
                aria-label="Chiudi messaggio di errore"
                className="rounded-[6px] border border-[var(--cs-border,#24284f)] bg-white p-0.5 cursor-pointer shrink-0"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          ) : statusNotice ? (
            <div
              role="status"
              className="rounded-[10px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-mint,#b4f0cb)] p-3 text-xs font-bold text-[var(--cs-ink,#24284f)] flex flex-wrap items-center justify-between gap-2"
            >
              <span>{statusNotice}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {selectedRun ? (
                  <button
                    type="button"
                    onClick={() =>
                      resultsSectionRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-[6px] border-2 border-[var(--cs-border,#24284f)] bg-white px-2 py-0.5 text-[11px] font-bold cursor-pointer"
                  >
                    <span>Vai ai risultati</span>
                    <ArrowDown className="h-3 w-3" aria-hidden="true" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setStatusNotice(null)}
                  aria-label="Chiudi avviso di stato"
                  className="rounded-[6px] border border-[var(--cs-border,#24284f)] bg-white p-0.5 cursor-pointer"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-xs text-[var(--cs-ink-muted,#4b5075)]">
              {activeProvider && !activeProvider.configured
                ? `Chiave API mancante per ${activeProvider.label}: configura la variabile d’ambiente sul server.`
                : modality === 'image'
                  ? 'Le immagini caricate restano in memoria pronte per esecuzioni multiple: puoi cambiare prompt e rilanciare subito un altro test.'
                  : 'Ogni input testuale viene elaborato singolarmente con il prompt selezionato e salvato nello storico valutazioni.'}
            </p>
            <button
              type="button"
              disabled={
                isSubmittingRun ||
                isReadingFiles ||
                activeItemCount === 0 ||
                !activePromptText.trim() ||
                (activeProvider ? !activeProvider.configured : false)
              }
              onClick={() => void handleStartRun()}
              className="inline-flex items-center justify-center gap-2 rounded-[10px] border-[3px] border-[var(--cs-border,#24284f)] bg-[var(--cs-mint,#b4f0cb)] px-5 py-2.5 text-sm font-bold text-[var(--cs-ink,#24284f)] shadow-[4px_4px_0_var(--cs-border,#24284f)] cursor-pointer active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              <span>
                {isSubmittingRun
                  ? executionMode === 'batch'
                    ? 'Invio Batch API…'
                    : `Elaborazione in corso (${activeItemCount})…`
                  : executionMode === 'batch'
                    ? `Avvia Batch API -50% (${activeItemCount})`
                    : `Avvia Standard API (${activeItemCount})`}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* HISTORY + SELECTED RUN RESULTS & EVALUATION */}
      <div className="grid grid-cols-1 lg:grid-cols-[310px_1fr] gap-5 items-start">
        {/* SAVED RUNS HISTORY SIDEBAR */}
        <aside
          aria-label="Storico esecuzioni salvate"
          className="rounded-[14px] border-[3px] border-[var(--cs-border,#24284f)] bg-white p-4 shadow-[5px_5px_0_var(--cs-border,#24284f)] space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-[var(--cs-ink,#24284f)]">
              Esecuzioni salvate ({runs.length})
            </h4>
            <button
              type="button"
              disabled={isLoadingRuns}
              onClick={() => void loadRunsList()}
              aria-label="Aggiorna storico esecuzioni"
              className="rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-bg,#fff8d9)] p-1.5 cursor-pointer"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoadingRuns ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </button>
          </div>

          <div className="flex flex-wrap gap-1">
            {(
              [
                ['all', 'Tutti'],
                ['batch', 'Batch'],
                ['standard', 'Standard'],
                ['active', 'In corso'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setHistoryFilter(key)}
                className={`rounded-[6px] border-2 border-[var(--cs-border,#24284f)] px-2 py-0.5 text-[11px] font-bold cursor-pointer ${
                  historyFilter === key
                    ? 'bg-[var(--cs-yellow,#ffe680)]'
                    : 'bg-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filteredRuns.length === 0 ? (
            <p className="text-xs text-[var(--cs-ink-muted,#4b5075)] py-4 text-center">
              Nessuna esecuzione in questa vista.
            </p>
          ) : (
            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-0.5">
              {filteredRuns.map((run, idx) => {
                const isSelected = selectedRun?.id === run.id;
                const statusMeta = RUN_STATUS_META[run.status];
                return (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => void selectRun(run.id)}
                    className={`w-full text-left rounded-[10px] border-2 border-[var(--cs-border,#24284f)] p-2.5 space-y-1.5 cursor-pointer transition-colors ${
                      idx >= 8
                        ? '[content-visibility:auto] [contain-intrinsic-size:auto_none_auto_84px] '
                        : ''
                    }${
                      isSelected
                        ? 'bg-[var(--cs-sky,#e4f3ff)]'
                        : 'bg-white hover:bg-[var(--cs-bg,#fff8d9)]/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--cs-ink,#24284f)] line-clamp-2">
                        {run.title}
                      </span>
                      <span
                        className={`shrink-0 rounded-[6px] border border-[var(--cs-border,#24284f)] px-1.5 py-0.5 text-[10px] font-bold ${statusMeta.bg}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono-num text-[var(--cs-ink-muted,#4b5075)]">
                      <span className="uppercase font-bold text-[var(--cs-ink,#24284f)]">
                        {run.executionMode === 'batch' ? 'BATCH -50%' : 'STD'}
                      </span>
                      <span>·</span>
                      <span>
                        {run.completedItems}/{run.totalItems} ok
                      </span>
                      <span>·</span>
                      <span>{formatUsd(run.totalEstimatedCostUsd, 4)}</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[var(--cs-ink-muted,#4b5075)]">
                      <span>{formatDateTime(run.createdAtMs)}</span>
                      {run.evaluation?.overallRating ? (
                        <span className="font-bold text-[var(--cs-ink,#24284f)]">
                          ★ {run.evaluation.overallRating}/5
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* SELECTED RUN DETAIL + RESULTS + EVALUATION */}
        <section
          ref={resultsSectionRef}
          aria-label="Dettagli e valutazione esecuzione selezionata"
          className="rounded-[14px] border-[3px] border-[var(--cs-border,#24284f)] bg-white p-5 shadow-[5px_5px_0_var(--cs-border,#24284f)] space-y-5 min-w-0"
        >
          {isLoadingRunDetail ? (
            <p className="text-sm font-bold py-6 text-center">
              Caricamento dettagli esecuzione…
            </p>
          ) : !selectedRun ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-base font-bold text-[var(--cs-ink,#24284f)]">
                Nessuna esecuzione selezionata
              </p>
              <p className="text-xs text-[var(--cs-ink-muted,#4b5075)]">
                Avvia un test qui sopra oppure seleziona un’esecuzione salvata dallo storico a sinistra per ispezionare i risultati, scaricarli o aggiungere note.
              </p>
            </div>
          ) : (
            <>
              {/* Header + Actions */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-[6px] border-2 border-[var(--cs-border,#24284f)] px-2 py-0.5 text-xs font-bold ${RUN_STATUS_META[selectedRun.status].bg}`}
                    >
                      {RUN_STATUS_META[selectedRun.status].label}
                    </span>
                    <span className="rounded-[6px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-bg,#fff8d9)] px-2 py-0.5 text-xs font-mono-num font-bold">
                      {selectedRun.executionMode === 'batch'
                        ? 'Batch API (-50%)'
                        : 'Standard API'}
                    </span>
                    <span className="text-xs font-mono-num text-[var(--cs-ink-muted,#4b5075)]">
                      {selectedRun.providerId} · {selectedRun.model}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-[var(--cs-ink,#24284f)] break-words">
                    {selectedRun.title}
                  </h4>
                  <p className="text-xs text-[var(--cs-ink-muted,#4b5075)] font-mono-num">
                    Creato: {formatDateTime(selectedRun.createdAtMs)} ·{' '}
                    {selectedRun.completedItems}/{selectedRun.totalItems} ok ·{' '}
                    {selectedRun.failedItems} errori · Costo:{' '}
                    <strong className="text-[var(--cs-ink,#24284f)]">
                      {formatUsd(selectedRun.totalEstimatedCostUsd, 5)}
                    </strong>
                    {selectedRun.externalBatchJobId
                      ? ` · Job: ${selectedRun.externalBatchJobId}`
                      : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedRun.executionMode === 'batch' &&
                  !isTerminalRunStatus(selectedRun.status) ? (
                    <>
                      <button
                        type="button"
                        disabled={isRefreshingBatch}
                        onClick={() => void handleRefreshBatch(selectedRun.id)}
                        className="inline-flex items-center gap-1.5 rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-blue,#9acfff)] px-3 py-1.5 text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${isRefreshingBatch ? 'animate-spin' : ''}`}
                          aria-hidden="true"
                        />
                        <span>Verifica stato Batch</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCancelBatch()}
                        className="inline-flex items-center gap-1 rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-danger-bg,#ffe4e8)] px-2.5 py-1.5 text-xs font-bold text-[var(--cs-danger-ink,#8f1d2c)] cursor-pointer"
                      >
                        <span>Annulla</span>
                      </button>
                    </>
                  ) : null}

                  {selectedRun.completedItems > 0 ? (
                    <button
                      type="button"
                      onClick={() => downloadRunZipArchive(selectedRun)}
                      className="inline-flex items-center gap-1.5 rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-mint,#b4f0cb)] px-3 py-1.5 text-xs font-bold cursor-pointer"
                    >
                      <FileArchive className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Scarica tutto (.zip)</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => handleReuseRunInComposer(selectedRun)}
                    className="inline-flex items-center gap-1 rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-lavender,#d9ccff)] px-2.5 py-1.5 text-xs font-bold cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Riusa impostazioni</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadRunReportJson(selectedRun)}
                    className="inline-flex items-center gap-1 rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-white px-2.5 py-1.5 text-xs font-bold cursor-pointer"
                  >
                    <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>JSON</span>
                  </button>

                  {isTerminalRunStatus(selectedRun.status) ? (
                    <div className="inline-flex flex-wrap items-center gap-1.5">
                      <input
                        type="email"
                        aria-label="Destinatario email per questa esecuzione"
                        placeholder="admin@esempio.it"
                        value={detailEmail}
                        onChange={(e) => setDetailEmail(e.target.value)}
                        className="w-44 rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-white px-2 py-1 text-xs font-bold"
                      />
                      <button
                        type="button"
                        disabled={isSendingEmail || !detailEmail.trim()}
                        onClick={() => void handleSendEmail()}
                        className="inline-flex items-center gap-1 rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-yellow,#ffe680)] px-2.5 py-1.5 text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>
                          {isSendingEmail
                            ? 'Invio…'
                            : selectedRun.notificationStatus === 'sent'
                              ? 'Re-invia email'
                              : 'Invia email'}
                        </span>
                      </button>
                    </div>
                  ) : null}

                  {confirmDeleteRunId === selectedRun.id ? (
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isDeletingRun}
                        onClick={() => void handleDeleteRun(selectedRun.id)}
                        className="rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-danger-bg,#ffe4e8)] px-2.5 py-1.5 text-xs font-bold text-[var(--cs-danger-ink,#8f1d2c)] cursor-pointer disabled:opacity-50"
                      >
                        {isDeletingRun ? 'Elimino…' : 'Conferma elimina'}
                      </button>
                      <button
                        type="button"
                        disabled={isDeletingRun}
                        onClick={() => setConfirmDeleteRunId(null)}
                        className="rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-white px-2 py-1.5 text-xs font-bold cursor-pointer"
                      >
                        Annulla
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteRunId(selectedRun.id)}
                      aria-label="Elimina esecuzione"
                      className="inline-flex items-center justify-center rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-danger-bg,#ffe4e8)] p-1.5 text-[var(--cs-danger-ink,#8f1d2c)] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              {/* Email notification & batch status info bar */}
              {selectedRun.notifyEmail ||
              selectedRun.errorMessage ||
              (selectedRun.executionMode === 'batch' &&
                !isTerminalRunStatus(selectedRun.status)) ? (
                <div className="rounded-[10px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-bg,#fff8d9)] p-3 text-xs space-y-1">
                  {selectedRun.executionMode === 'batch' &&
                  !isTerminalRunStatus(selectedRun.status) ? (
                    <p className="flex items-center gap-1.5 font-bold">
                      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        Job Batch asincrono in corso ({selectedRun.externalBatchState ?? selectedRun.status}). Questa schermata ricontrolla ogni 25 secondi; puoi anche chiudere la pagina e ricevere l’email al completamento.
                      </span>
                    </p>
                  ) : null}
                  {selectedRun.notifyEmail ? (
                    <p className="text-[var(--cs-ink-muted,#4b5075)]">
                      Notifica email ({selectedRun.notifyEmail}):{' '}
                      <strong className="text-[var(--cs-ink,#24284f)]">
                        {selectedRun.notificationStatus === 'sent'
                          ? `Inviata il ${formatDateTime(selectedRun.notificationSentAtMs)}`
                          : selectedRun.notificationStatus === 'pending'
                            ? 'In attesa del completamento'
                            : selectedRun.notificationStatus === 'failed'
                              ? `Fallita (${selectedRun.notificationError ?? 'errore'})`
                              : 'Non richiesta'}
                      </strong>
                    </p>
                  ) : null}
                  {selectedRun.errorMessage ? (
                    <p className="font-bold text-[var(--cs-danger-ink,#8f1d2c)]">
                      Errore job: {selectedRun.errorMessage}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Exact prompt used in this run */}
              <div className="rounded-[10px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-sky,#e4f3ff)]/35 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRunPrompt((prev) => !prev)}
                    className="text-xs font-bold underline decoration-2 cursor-pointer"
                  >
                    {showRunPrompt
                      ? `Nascondi prompt usato (${selectedRun.promptLabel})`
                      : `Mostra prompt completo usato (${selectedRun.promptLabel})`}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopyPrompt(selectedRun.promptText, 'run')
                    }
                    className="inline-flex items-center gap-1 rounded-[6px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-yellow,#ffe680)] px-2 py-0.5 text-[11px] font-bold cursor-pointer"
                  >
                    {copiedRunPrompt ? (
                      <>
                        <Check className="h-3 w-3" aria-hidden="true" />
                        <span>Copiato</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" aria-hidden="true" />
                        <span>Copia prompt</span>
                      </>
                    )}
                  </button>
                </div>
                {showRunPrompt ? (
                  <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-white p-2.5 text-xs font-mono-num leading-relaxed">
                    {selectedRun.promptText}
                  </pre>
                ) : null}
              </div>

              {/* Run-level Evaluation & Notes */}
              <div className="rounded-[12px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-bg,#fff8d9)]/65 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-[var(--cs-ink,#24284f)]">
                    Valutazione complessiva &amp; Note dell’esecuzione
                  </h5>
                  <StarRatingInput
                    value={runRating}
                    onChange={setRunRating}
                    ariaLabel="Valutazione complessiva del run"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-2.5">
                  <textarea
                    rows={2}
                    value={runNotes}
                    onChange={(e) => setRunNotes(e.target.value)}
                    placeholder="Annota osservazioni generali su questo prompt (es. casi che riescono meglio, difetti ricorrenti, prossime modifiche…)"
                    className="h-auto w-full min-h-[3lh] max-h-[10lh] [field-sizing:content] rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-white px-2.5 py-1.5 text-xs"
                  />
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={runTagsText}
                      onChange={(e) => setRunTagsText(e.target.value)}
                      placeholder="Tag separati da virgola (es. v2, baseline)"
                      className="w-full rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                    <button
                      type="button"
                      disabled={isSavingRunEval}
                      onClick={() => void handleSaveRunEvaluation()}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-[8px] border-2 border-[var(--cs-border,#24284f)] bg-[var(--cs-mint,#b4f0cb)] px-3 py-1.5 text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {isSavingRunEval
                          ? 'Salvataggio…'
                          : 'Salva note esecuzione'}
                      </span>
                    </button>
                  </div>
                </div>
                {runEvalSavedMsg ? (
                  <p className="text-xs font-bold text-[var(--cs-ink,#24284f)]">
                    {runEvalSavedMsg}
                  </p>
                ) : null}
              </div>

              {/* Per-item results grid */}
              <div className="space-y-2.5">
                <h5 className="text-sm font-bold text-[var(--cs-ink,#24284f)]">
                  {selectedRun.modality === 'image'
                    ? `Risultati per singola immagine (${selectedRun.items.length})`
                    : `Risultati per singolo input testuale (${selectedRun.items.length})`}
                </h5>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {selectedRun.items.map((item) => (
                    <ItemEvaluationCard
                      key={item.id}
                      item={item}
                      modality={selectedRun.modality}
                      runTitle={selectedRun.title}
                      runStatus={selectedRun.status}
                      onZoom={(url, label) => setZoomedMedia({ url, label })}
                      onSaveEvaluation={handleSaveItemEvaluation}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Native <dialog> lightbox zoom overlay */}
      <ZoomLightboxDialog
        media={zoomedMedia}
        onClose={() => setZoomedMedia(null)}
      />
    </div>
  );
}
