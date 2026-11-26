import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from 'react';
import {
  Camera,
  Check,
  Copy,
  FileDown,
  Share2,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import {
  buildGenerateColoringRequest,
  getGenerationLogThemeId,
} from '../config/generationPayload';
import { ORDER_CONFIG } from '../config/orderConfig';
import {
  renderSampleSceneToFile,
  SAMPLE_SCENES,
} from '../config/sampleScenes';
import { SITE_TEMPLATE } from '../config/siteTemplate';
import { BOOK_THEMES, type ThemeId } from '../data/themes';
import { useAuth } from '../modules/auth';
import {
  logoutInviteApi,
  redeemInviteApi,
  type AccessSessionResponse,
  type BetaInviteQuota,
} from '../modules/beta-access';
import {
  ColoringApiError,
  exportPrintPdfApi,
  generateColoringPageApi,
  type AdminDebugInfo,
  type AdminTelemetry,
  type ColoringAgeGroup,
  type ColoringGenerationResponse,
  type ColoringStyleMode,
  type PrintPdfLayout,
  type ProviderId,
} from '../modules/coloring-api';
import { saveGenerationLog } from '../modules/database';
import {
  validateSinglePhotoFile,
  type ValidatedPhoto,
} from '../modules/media-validation';
import { TURNSTILE_SITE_KEY, TurnstileWidget } from './TurnstileWidget';
import {
  ModalDialog,
  UiBadge,
  UiButton,
  UiCard,
  UiChip,
  UiFileButton,
} from './ui';

const RIGHTS_STORAGE_KEY = 'cs_rights_ack';

const AGE_COMPLEXITY_BARS: Record<ColoringAgeGroup, number> = {
  '1-2': 1,
  '3-4': 2,
  '5-7': 3,
  '8+': 4,
};

export interface CreatorDialogProps {
  open: boolean;
  onClose: () => void;
  accessSession?: AccessSessionResponse | null;
  onAccessSessionChange?: (session: AccessSessionResponse) => void;
  onInviteQuotaUpdate?: (quota: BetaInviteQuota) => void;
  onTelemetryGenerated?: (telemetry: AdminTelemetry | null) => void;
}

function readPersistedRightsAck(): boolean {
  try {
    return (
      typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem(RIGHTS_STORAGE_KEY) === '1'
    );
  } catch {
    return false;
  }
}

function writePersistedRightsAck(value: boolean) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (value) {
      sessionStorage.setItem(RIGHTS_STORAGE_KEY, '1');
    } else {
      sessionStorage.removeItem(RIGHTS_STORAGE_KEY);
    }
  } catch {
    // Ignore restricted storage contexts.
  }
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

function PdfLayoutGraphic({ layout }: { layout: PrintPdfLayout }) {
  return (
    <svg
      width="24"
      height="30"
      viewBox="0 0 24 30"
      fill="none"
      aria-hidden="true"
      className="mx-auto mb-1 block"
    >
      <rect
        x="1.5"
        y="1.5"
        width="21"
        height="27"
        rx="2"
        fill="#FFFFFF"
        stroke="currentColor"
        strokeWidth="2"
      />
      {layout === '1-up' ? (
        <rect
          x="5"
          y="5.5"
          width="14"
          height="19"
          rx="1"
          fill="var(--cs-mint)"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      ) : layout === '2-up' ? (
        <>
          <rect
            x="4.5"
            y="6"
            width="6"
            height="18"
            rx="0.8"
            fill="var(--cs-mint)"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <rect
            x="13.5"
            y="6"
            width="6"
            height="18"
            rx="0.8"
            fill="var(--cs-mint)"
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </>
      ) : (
        <>
          <rect
            x="4.5"
            y="5.5"
            width="6"
            height="8"
            rx="0.8"
            fill="var(--cs-mint)"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <rect
            x="13.5"
            y="5.5"
            width="6"
            height="8"
            rx="0.8"
            fill="var(--cs-mint)"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <rect
            x="4.5"
            y="16.5"
            width="6"
            height="8"
            rx="0.8"
            fill="var(--cs-mint)"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <rect
            x="13.5"
            y="16.5"
            width="6"
            height="8"
            rx="0.8"
            fill="var(--cs-mint)"
            stroke="currentColor"
            strokeWidth="1.3"
          />
        </>
      )}
    </svg>
  );
}

export function CreatorDialog({
  open,
  onClose,
  accessSession = null,
  onAccessSessionChange,
  onInviteQuotaUpdate,
  onTelemetryGenerated,
}: CreatorDialogProps) {
  const { creator } = SITE_TEMPLATE;
  const {
    user,
    isAdmin,
    hasAdminClaim,
    idToken,
    promptVersions,
    activePromptVersion,
    providers,
    refreshIdToken,
  } = useAuth();

  const [photo, setPhoto] = useState<ValidatedPhoto | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<ColoringStyleMode>('fedele');
  const [themeId, setThemeId] = useState<ThemeId>('pirati');
  const [ageGroup, setAgeGroup] = useState<ColoringAgeGroup>(
    creator.defaultAgeGroup
  );
  const [acceptedRights, setAcceptedRights] = useState<boolean>(() =>
    readPersistedRightsAck()
  );

  const [isValidatingPhoto, setIsValidatingPhoto] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ColoringGenerationResponse | null>(null);
  const [askConfirmClose, setAskConfirmClose] = useState(false);

  const [pdfLayout, setPdfLayout] = useState<PrintPdfLayout>('1-up');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isSharingPdf, setIsSharingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<AdminDebugInfo | null>(null);
  const [copiedError, setCopiedError] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const [selectedPromptVersion, setSelectedPromptVersion] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId | ''>('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetCounter, setTurnstileResetCounter] = useState(0);

  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [isRedeemingInvite, setIsRedeemingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const photoRef = useRef<ValidatedPhoto | null>(null);
  photoRef.current = photo;
  const runCounterRef = useRef(0);
  const statusTimerRef = useRef<number | null>(null);
  const cachedPdfRef = useRef<{ key: string; blob: Blob } | null>(null);

  const supportsWebShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!isAdmin) {
      setSelectedPromptVersion('');
      setSelectedProviderId('');
      return;
    }

    if (activePromptVersion && !selectedPromptVersion) {
      setSelectedPromptVersion(activePromptVersion);
    }
    const defaultProvider = providers.find((provider) => provider.isDefault);
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
      if (statusTimerRef.current !== null) {
        window.clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  const showStatusNotice = (message: string) => {
    setStatusBanner(message);
    if (statusTimerRef.current !== null) {
      window.clearTimeout(statusTimerRef.current);
    }
    statusTimerRef.current = window.setTimeout(() => {
      setStatusBanner(null);
    }, 3500);
  };

  const resetCreator = () => {
    runCounterRef.current += 1;
    if (photoRef.current) {
      URL.revokeObjectURL(photoRef.current.previewUrl);
    }
    if (statusTimerRef.current !== null) {
      window.clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
    cachedPdfRef.current = null;
    setPhoto(null);
    setIsDragging(false);
    setMode('fedele');
    setThemeId('pirati');
    setAgeGroup(creator.defaultAgeGroup);
    setIsValidatingPhoto(false);
    setIsGenerating(false);
    setResult(null);
    setAskConfirmClose(false);
    setPdfLayout('1-up');
    setIsExportingPdf(false);
    setIsSharingPdf(false);
    setPdfError(null);
    setErrorBanner(null);
    setErrorDetails(null);
    setStatusBanner(null);
    setCopiedError(false);
  };

  const acceptValidatedFile = async (
    file: File,
    suggestedThemeId?: ThemeId
  ) => {
    setIsValidatingPhoto(true);
    setErrorBanner(null);
    setErrorDetails(null);
    setPdfError(null);
    setStatusBanner(null);

    try {
      const { accepted, rejected } = await validateSinglePhotoFile(file);
      if (rejected) {
        setErrorBanner(rejected.reason);
        return;
      }

      if (accepted) {
        if (photoRef.current) {
          URL.revokeObjectURL(photoRef.current.previewUrl);
        }
        cachedPdfRef.current = null;
        setPhoto(accepted);
        setResult(null);
        setAskConfirmClose(false);
        if (suggestedThemeId) {
          setThemeId(suggestedThemeId);
        }
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Impossibile leggere questa immagine.';
      setErrorBanner(message);
    } finally {
      setIsValidatingPhoto(false);
    }
  };

  const handleSampleClick = async (sceneId: string) => {
    setIsValidatingPhoto(true);
    setErrorBanner(null);
    setStatusBanner(null);
    try {
      const { file, scene } = await renderSampleSceneToFile(sceneId);
      await acceptValidatedFile(file, scene.suggestedThemeId);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Impossibile caricare l’esempio selezionato.';
      setErrorBanner(message);
      setIsValidatingPhoto(false);
    }
  };

  const handleDropFile = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (isValidatingPhoto || isGenerating) return;
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
      void acceptValidatedFile(droppedFile);
    }
  };

  const handleRightsToggle = (checked: boolean) => {
    setAcceptedRights(checked);
    writePersistedRightsAck(checked);
  };

  const handleRequestClose = () => {
    if (askConfirmClose) {
      setAskConfirmClose(false);
      return;
    }
    if (photo || result || isGenerating) {
      setAskConfirmClose(true);
      return;
    }
    resetCreator();
    onClose();
  };

  const handleConfirmClose = () => {
    resetCreator();
    onClose();
  };

  const handleGenerate = async () => {
    if (!photo || !acceptedRights || isGenerating) return;

    if (TURNSTILE_SITE_KEY && !isAdmin && !turnstileToken) {
      setErrorBanner('Completa la verifica di sicurezza prima di generare.');
      return;
    }

    const currentRun = ++runCounterRef.current;
    cachedPdfRef.current = null;
    setErrorBanner(null);
    setErrorDetails(null);
    setCopiedError(false);
    setPdfError(null);
    setStatusBanner(null);
    setAskConfirmClose(false);
    setIsGenerating(true);

    try {
      const freshToken = isAdmin && user ? await refreshIdToken() : idToken;
      const generated = await generateColoringPageApi(
        buildGenerateColoringRequest({
          file: photo.file,
          mode,
          themeId,
          ageGroup,
          isAdmin,
          selectedProviderId,
          selectedPromptVersion,
          idToken: freshToken,
          turnstileToken,
        })
      );

      if (runCounterRef.current !== currentRun) return;

      setResult(generated);
      onTelemetryGenerated?.(generated.adminTelemetry ?? null);
      if (generated.inviteQuota) {
        onInviteQuotaUpdate?.(generated.inviteQuota);
      }

      if (isAdmin && hasAdminClaim && user && generated.adminTelemetry) {
        void saveGenerationLog({
          adminUid: user.uid,
          themeId: getGenerationLogThemeId(mode, themeId),
          telemetry: generated.adminTelemetry,
        }).catch((err) => {
          console.warn('Firestore generation log save failed:', err);
        });
      }
    } catch (err) {
      if (runCounterRef.current !== currentRun) return;

      if (err instanceof ColoringApiError) {
        setErrorBanner(err.message);
        setErrorDetails(err.adminDebugInfo ?? null);
      } else {
        const message =
          err instanceof Error
            ? err.message
            : 'Errore imprevisto durante la generazione. Riprova.';
        setErrorBanner(message);
        setErrorDetails(
          err instanceof Error
            ? { rawBodySnippet: `${err.name}: ${err.message}` }
            : { rawBodySnippet: String(err) }
        );
      }
    } finally {
      if (runCounterRef.current === currentRun) {
        setIsGenerating(false);
      }
      if (TURNSTILE_SITE_KEY) {
        setTurnstileResetCounter((counter) => counter + 1);
      }
    }
  };

  const ensurePdfBlob = async (): Promise<Blob> => {
    if (!result) {
      throw new Error('Risultato non disponibile.');
    }
    const cacheKey = `${result.imageDataUrl}|${pdfLayout}`;
    if (cachedPdfRef.current?.key === cacheKey) {
      return cachedPdfRef.current.blob;
    }
    const freshToken = isAdmin && user ? await refreshIdToken() : idToken;
    const pdfBlob = await exportPrintPdfApi(
      {
        imageDataUrl: result.imageDataUrl,
        layout: pdfLayout,
      },
      freshToken
    );
    cachedPdfRef.current = { key: cacheKey, blob: pdfBlob };
    return pdfBlob;
  };

  const triggerPdfBlobDownload = (pdfBlob: Blob) => {
    const blobUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `colorastoria-stampa-${pdfLayout}.pdf`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  };

  const handleDownloadPdf = async () => {
    if (!result || isExportingPdf || isSharingPdf) return;
    setIsExportingPdf(true);
    setPdfError(null);
    setStatusBanner(null);

    try {
      const pdfBlob = await ensurePdfBlob();
      triggerPdfBlobDownload(pdfBlob);
      showStatusNotice('PDF pronto per la stampa!');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Impossibile generare il PDF per la stampa. Riprova.';
      setPdfError(message);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleSharePdf = async () => {
    if (!result || isExportingPdf || isSharingPdf || !supportsWebShare) return;
    setIsSharingPdf(true);
    setPdfError(null);
    setStatusBanner(null);

    try {
      const pdfBlob = await ensurePdfBlob();
      const file = new File([pdfBlob], `colorastoria-stampa-${pdfLayout}.pdf`, {
        type: 'application/pdf',
      });
      if (
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: SITE_TEMPLATE.brand.name,
        });
      } else {
        triggerPdfBlobDownload(pdfBlob);
        showStatusNotice('PDF pronto per la stampa!');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const message =
        err instanceof Error
          ? err.message
          : 'Impossibile generare il PDF per la stampa. Riprova.';
      setPdfError(message);
    } finally {
      setIsSharingPdf(false);
    }
  };

  const handleDownloadPng = async () => {
    if (!result) return;
    setPdfError(null);
    setStatusBanner(null);
    try {
      await downloadColoringResultAsPng(result);
      showStatusNotice('Immagine PNG scaricata!');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Impossibile esportare l’immagine PNG.';
      setPdfError(message);
    }
  };

  const handleCopyAdminError = async () => {
    if (!errorBanner) return;
    const lines: string[] = [`Errore: ${errorBanner}`];
    if (errorDetails) {
      if (errorDetails.statusCode !== undefined) {
        lines.push(
          `HTTP: ${errorDetails.statusCode} ${errorDetails.statusText ?? ''} (${errorDetails.contentType ?? 'unknown'})`.trim()
        );
      }
      if (errorDetails.backendDetails) {
        lines.push(
          `Classe: ${errorDetails.backendDetails.errorName ?? 'Error'} · Provider: ${errorDetails.backendDetails.provider ?? 'default'}`
        );
        if (errorDetails.backendDetails.rawMessage) {
          lines.push(`Raw message:\n${errorDetails.backendDetails.rawMessage}`);
        }
      }
      if (errorDetails.rawBodySnippet) {
        lines.push(`Raw response:\n${errorDetails.rawBodySnippet}`);
      }
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n\n'));
      setCopiedError(true);
      window.setTimeout(() => setCopiedError(false), 2000);
    } catch {
      // Clipboard API may be blocked by browser permissions.
    }
  };

  const handleRedeemInvite = async (event: FormEvent) => {
    event.preventDefault();
    if (isRedeemingInvite) return;
    const trimmed = inviteCodeInput.trim();
    if (!trimmed) {
      setInviteError('Inserisci il codice invito.');
      return;
    }

    setIsRedeemingInvite(true);
    setInviteError(null);
    try {
      const session = await redeemInviteApi(trimmed);
      setInviteCodeInput('');
      onAccessSessionChange?.(session);
      if (session.invite) {
        showStatusNotice(
          `Invito attivo! Hai ${session.invite.remainingGenerations} generazioni disponibili.`
        );
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Impossibile verificare il codice invito.';
      setInviteError(message);
    } finally {
      setIsRedeemingInvite(false);
    }
  };

  const handleLogoutInvite = async () => {
    await logoutInviteApi().catch(() => {});
    resetCreator();
    onAccessSessionChange?.({
      inviteRequired: accessSession?.inviteRequired ?? true,
      hasAccess: false,
      accessSource: 'none',
      invite: null,
    });
  };

  const selectedTheme = BOOK_THEMES.find((item) => item.id === themeId);
  const isInviteGated = Boolean(
    accessSession?.inviteRequired &&
      !isAdmin &&
      !accessSession.hasAccess &&
      !result
  );
  const activeInvite =
    accessSession?.accessSource === 'invite' ? accessSession.invite : null;
  const useWideStudio = !isInviteGated && Boolean(photo || result);

  return (
    <ModalDialog
      open={open}
      size={useWideStudio ? 'wide' : 'default'}
      closedByMode={
        isGenerating ? 'none' : photo || result ? 'closerequest' : 'any'
      }
      title={
        isInviteGated
          ? creator.inviteGateTitle
          : result
            ? creator.titleReady
            : creator.titleCreate
      }
      closeLabel={creator.closeLabel}
      titleAs="h1"
      scrollTopKey={
        askConfirmClose
          ? 'ask'
          : isInviteGated
            ? 'gate'
            : result
              ? 'ready'
              : photo
                ? 'studio'
                : 'upload'
      }
      onRequestClose={handleRequestClose}
    >
      {askConfirmClose ? (
        <UiCard className="mx-4 mb-3">
          <p className="mb-2.5">
            <b>{creator.closeConfirmTitle}</b> {creator.closeConfirmBody}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <UiButton
              variant="secondary"
              onClick={() => setAskConfirmClose(false)}
            >
              {creator.closeConfirmStay}
            </UiButton>
            <UiButton onClick={handleConfirmClose}>
              {creator.closeConfirmLeave}
            </UiButton>
          </div>
        </UiCard>
      ) : null}

      {!isInviteGated && activeInvite ? (
        <div className="mx-4 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[10px] border-2 border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">Invito: {activeInvite.label}</span>
            <UiBadge tone="mint" className="font-mono-num">
              {activeInvite.remainingGenerations}/{activeInvite.maxGenerations}{' '}
              rimaste
            </UiBadge>
            {activeInvite.expiresAtMs ? (
              <span className="text-[var(--cs-ink-muted)] font-mono-num">
                Scade il{' '}
                {new Intl.DateTimeFormat('it-IT', {
                  day: '2-digit',
                  month: '2-digit',
                }).format(new Date(activeInvite.expiresAtMs))}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void handleLogoutInvite()}
            className="font-bold text-[var(--cs-ink-muted)] underline underline-offset-2 hover:text-[var(--cs-ink)] cursor-pointer"
          >
            {creator.inviteLogoutCta}
          </button>
        </div>
      ) : null}

      <div
        className="px-4 pb-[calc(20px+env(safe-area-inset-bottom,0px))]"
        aria-live="polite"
      >
        {statusBanner ? (
          <UiCard
            tone="mint"
            className="mb-3 !p-2.5 text-xs font-bold"
            role="status"
          >
            {statusBanner}
          </UiCard>
        ) : null}

        {isInviteGated ? (
          <UiCard className="space-y-3">
            {accessSession?.invite &&
            accessSession.invite.remainingGenerations === 0 ? (
              <UiCard tone="yellow" className="!p-3 text-sm font-bold">
                {creator.inviteExhaustedPrefix} «{accessSession.invite.label}» (
                {accessSession.invite.usedGenerations}/
                {accessSession.invite.maxGenerations}). {creator.inviteExhaustedHint}
              </UiCard>
            ) : (
              <p className="text-sm leading-relaxed">{creator.inviteGateHint}</p>
            )}

            <form
              onSubmit={(event) => void handleRedeemInvite(event)}
              className="space-y-2.5"
            >
              <label
                htmlFor="creator-invite-code"
                className="block space-y-1"
              >
                <span className="text-xs font-bold uppercase tracking-wide">
                  {creator.inviteInputLabel}
                </span>
                <input
                  id="creator-invite-code"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  enterKeyHint="done"
                  placeholder={creator.inviteInputPlaceholder}
                  value={inviteCodeInput}
                  disabled={isRedeemingInvite}
                  onChange={(event) =>
                    setInviteCodeInput(event.target.value.toUpperCase())
                  }
                  className="w-full rounded-[10px] border-[3px] border-[var(--cs-border)] bg-white px-3 py-2.5 text-base font-mono-num font-bold uppercase"
                />
              </label>

              {inviteError ? (
                <UiCard
                  tone="danger"
                  className="!p-3 text-sm font-bold"
                  role="alert"
                >
                  {inviteError}
                </UiCard>
              ) : null}

              <UiButton type="submit" disabled={isRedeemingInvite}>
                {isRedeemingInvite
                  ? creator.inviteUnlockingCta
                  : creator.inviteUnlockCta}
              </UiButton>
            </form>
          </UiCard>
        ) : !photo && !result ? (
          <div className="space-y-3.5">
            {errorBanner ? (
              <UiCard
                tone="danger"
                className="!p-3 text-sm font-bold"
                role="alert"
              >
                {errorBanner}
              </UiCard>
            ) : null}

            {/* Unified clickable + drag-and-drop A4 sheet */}
            <label
              htmlFor="creator-photo-input"
              data-dragging={isDragging ? 'true' : undefined}
              onDragOver={(event) => {
                event.preventDefault();
                if (!isValidatingPhoto) setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDropFile}
              className="cs-dropzone"
            >
              <input
                id="creator-photo-input"
                type="file"
                accept={ORDER_CONFIG.acceptedMimeTypes.join(',')}
                disabled={isValidatingPhoto}
                onChange={(event) => {
                  const selectedFile = event.target.files?.[0];
                  if (selectedFile) {
                    void acceptValidatedFile(selectedFile);
                  }
                  event.target.value = '';
                }}
                className="sr-only"
              />
              <span className="cs-dropzone-inner">
                <Camera className="h-7 w-7 text-[var(--cs-ink)]" aria-hidden="true" />
                <span className="text-sm font-bold text-[var(--cs-ink)]">
                  {creator.emptyCanvasLabel}
                </span>
                <span className="text-xs text-[var(--cs-ink-muted)]">
                  {creator.uploadHint}
                </span>
                <span className="cs-btn cs-btn-compact mt-1 pointer-events-none">
                  {isValidatingPhoto ? 'Controllo la foto…' : creator.uploadCta}
                </span>
                <span className="text-[11px] text-[var(--cs-ink-muted)]">
                  {ORDER_CONFIG.acceptedExtensionsLabel} · Min{' '}
                  <span className="font-mono-num">
                    {ORDER_CONFIG.minWidthPx}×{ORDER_CONFIG.minHeightPx} px
                  </span>{' '}
                  · Max{' '}
                  <span className="font-mono-num">
                    {ORDER_CONFIG.maxFileSizeMb} MB
                  </span>
                </span>
              </span>
            </label>

            <div>
              <div className="mb-1.5 text-[0.85rem] font-bold">
                {creator.samplesLabel}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SAMPLE_SCENES.map((scene) => (
                  <UiChip
                    key={scene.id}
                    disabled={isValidatingPhoto}
                    onClick={() => void handleSampleClick(scene.id)}
                  >
                    {scene.label}
                  </UiChip>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Desktop 2-column studio + full-screen mobile flow */
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(230px,290px)_1fr] md:gap-5 md:items-start">
            {/* Left column: A4 Preview + Native progress bar during generation */}
            <div className="space-y-2.5">
              <div
                onDragOver={(event) => {
                  if (!result && !isGenerating && !isValidatingPhoto) {
                    event.preventDefault();
                  }
                }}
                onDrop={(event) => {
                  if (result || isGenerating || isValidatingPhoto) return;
                  event.preventDefault();
                  const droppedFile = event.dataTransfer.files?.[0];
                  if (droppedFile) {
                    void acceptValidatedFile(droppedFile);
                  }
                }}
                className={`relative mx-auto aspect-[1/1.414] h-[28dvh] md:h-auto md:w-full border-[3px] border-[var(--cs-border)] bg-[var(--cs-surface)] shadow-[5px_5px_0_var(--cs-border)] overflow-hidden ${
                  isGenerating ? 'cs-sheet-loading' : ''
                }`}
                role="img"
                aria-label={creator.sheetAriaLabel}
              >
                {result ? (
                  <img
                    src={result.imageDataUrl}
                    alt={
                      mode === 'creativa'
                        ? `Pagina da colorare (${selectedTheme?.name ?? themeId})`
                        : 'Pagina da colorare (Fedele alla foto)'
                    }
                    referrerPolicy="no-referrer"
                    className="cs-sheet-media block h-full w-full bg-white object-contain"
                  />
                ) : photo ? (
                  <img
                    src={photo.previewUrl}
                    alt={`Anteprima della foto ${photo.name}`}
                    className="cs-sheet-media block h-full w-full bg-white object-cover"
                  />
                ) : null}
              </div>

              {isGenerating ? (
                <div className="space-y-2 rounded-[10px] border-2 border-[var(--cs-border)] bg-[var(--cs-surface)] p-2.5">
                  <div
                    aria-hidden="true"
                    className="flex items-center justify-between gap-2 text-xs font-bold text-[var(--cs-ink)]"
                  >
                    <span className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--cs-border)] bg-[var(--cs-yellow)] px-1.5 py-0.5">
                      <Camera className="h-3 w-3" />
                      <span>1</span>
                    </span>
                    <span className="h-0.5 flex-1 bg-[var(--cs-border)]/25" />
                    <span className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--cs-border)] bg-[var(--cs-mint)] px-1.5 py-0.5">
                      <Sparkles className="h-3 w-3" />
                      <span>2</span>
                    </span>
                    <span className="h-0.5 flex-1 bg-[var(--cs-border)]/25" />
                    <span className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--cs-border)] bg-[var(--cs-surface)] px-1.5 py-0.5">
                      <FileDown className="h-3 w-3" />
                      <span>3</span>
                    </span>
                  </div>
                  <progress
                    className="cs-progress"
                    aria-label={creator.generatingCta}
                  />
                </div>
              ) : null}

              {!result && photo ? (
                <UiFileButton
                  id="creator-photo-change"
                  variant="secondary"
                  size="compact"
                  className="w-full"
                  accept={ORDER_CONFIG.acceptedMimeTypes.join(',')}
                  disabled={isValidatingPhoto || isGenerating}
                  onFileSelect={(file) => void acceptValidatedFile(file)}
                >
                  {isValidatingPhoto ? 'Controllo la foto…' : creator.changePhotoCta}
                </UiFileButton>
              ) : null}
            </div>

            {/* Right column: Settings or Result Actions */}
            {result ? (
              <div className="space-y-3">
                {result.sceneSummary ? (
                  <p className="text-sm font-medium text-[var(--cs-ink-muted)]">
                    {result.sceneSummary}
                  </p>
                ) : null}

                <div>
                  <div className="mb-1.5 text-[0.85rem] font-bold">
                    {creator.pdfLayoutLabel}
                  </div>
                  <div
                    className="grid grid-cols-3 gap-2"
                    role="radiogroup"
                    aria-label={creator.pdfLayoutLabel}
                  >
                    {creator.pdfLayouts.map((layoutOption) => (
                      <UiChip
                        key={layoutOption.id}
                        centered
                        pressed={pdfLayout === layoutOption.id}
                        onClick={() => {
                          setPdfLayout(layoutOption.id);
                          setPdfError(null);
                        }}
                      >
                        <PdfLayoutGraphic layout={layoutOption.id} />
                        <span className="block text-xs">{layoutOption.label}</span>
                      </UiChip>
                    ))}
                  </div>
                </div>

                {pdfError ? (
                  <UiCard
                    tone="danger"
                    className="!p-3 text-sm font-bold"
                    role="alert"
                  >
                    {pdfError}
                  </UiCard>
                ) : null}

                <div className="space-y-2.5 pt-1">
                  <div className="flex items-stretch gap-2">
                    <UiButton
                      variant="mint"
                      disabled={isExportingPdf || isSharingPdf}
                      onClick={() => void handleDownloadPdf()}
                      className="flex-1"
                    >
                      {isExportingPdf
                        ? creator.exportingPdfCta
                        : creator.downloadPdfCta}
                    </UiButton>
                    {supportsWebShare ? (
                      <UiButton
                        variant="secondary"
                        size="compact"
                        disabled={isExportingPdf || isSharingPdf}
                        onClick={() => void handleSharePdf()}
                        aria-label="Condividi PDF"
                        className="shrink-0"
                      >
                        <Share2 className="h-4 w-4" aria-hidden="true" />
                      </UiButton>
                    ) : null}
                  </div>

                  <UiButton
                    variant="secondary"
                    onClick={() => void handleDownloadPng()}
                  >
                    {creator.downloadPngCta}
                  </UiButton>
                  {photo ? (
                    <UiButton
                      variant="secondary"
                      onClick={() => {
                        setResult(null);
                        setPdfError(null);
                        setStatusBanner(null);
                        setErrorBanner(null);
                        setErrorDetails(null);
                      }}
                    >
                      {creator.retrySamePhotoCta}
                    </UiButton>
                  ) : null}
                  <UiButton variant="secondary" onClick={resetCreator}>
                    {creator.resetCta}
                  </UiButton>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {photo?.qualityWarning ? (
                  <UiCard tone="yellow" className="!p-3 text-xs font-bold">
                    {photo.qualityWarning}
                  </UiCard>
                ) : null}

                <fieldset className="border-0 p-0 m-0">
                  <legend className="mb-1.5 text-[0.85rem] font-bold">
                    {creator.modeLabel}
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    {creator.modeOptions.map((option) => (
                      <UiChip
                        key={option.id}
                        pressed={mode === option.id}
                        subtitle={option.description}
                        disabled={isGenerating}
                        onClick={() => setMode(option.id)}
                      >
                        {option.label}
                      </UiChip>
                    ))}
                  </div>
                </fieldset>

                {mode === 'creativa' ? (
                  <div className="space-y-3">
                    <fieldset className="border-0 p-0 m-0">
                      <legend className="mb-1.5 text-[0.85rem] font-bold">
                        {creator.themeLabel}
                      </legend>
                      <div className="grid grid-cols-2 gap-2">
                        {BOOK_THEMES.map((theme) => {
                          const selected = themeId === theme.id;
                          return (
                            <button
                              key={theme.id}
                              type="button"
                              aria-pressed={selected}
                              disabled={isGenerating}
                              onClick={() => setThemeId(theme.id)}
                              className="cs-chip flex items-center gap-2 !p-2"
                            >
                              <span className="h-10 w-14 shrink-0 overflow-hidden rounded-[6px] border-2 border-[var(--cs-border)] bg-white">
                                {theme.renderIllustration('h-full w-full')}
                              </span>
                              <span className="min-w-0 truncate text-sm font-bold">
                                {theme.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>

                    <fieldset className="border-0 p-0 m-0">
                      <legend className="mb-1.5 text-[0.85rem] font-bold">
                        {creator.ageLabel}
                      </legend>
                      <div className="grid grid-cols-4 gap-2">
                        {creator.ageOptions.map((ageOption) => {
                          const bars = AGE_COMPLEXITY_BARS[ageOption.id];
                          return (
                            <UiChip
                              key={ageOption.id}
                              centered
                              pressed={ageGroup === ageOption.id}
                              disabled={isGenerating}
                              onClick={() => setAgeGroup(ageOption.id)}
                            >
                              <span>{ageOption.label}</span>
                              <span
                                aria-hidden="true"
                                className="mt-1 flex items-center justify-center gap-0.5"
                              >
                                {[1, 2, 3, 4].map((level) => (
                                  <span
                                    key={level}
                                    className={`h-1.5 w-2.5 rounded-full border border-[var(--cs-border)] ${
                                      level <= bars
                                        ? 'bg-[var(--cs-ink)]'
                                        : 'bg-white/60'
                                    }`}
                                  />
                                ))}
                              </span>
                            </UiChip>
                          );
                        })}
                      </div>
                    </fieldset>
                  </div>
                ) : null}

                {isAdmin ? (
                  <UiCard tone="sky" className="!p-3 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                      <SlidersHorizontal
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      <span>Controlli Admin</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-xs font-bold">Versione prompt</span>
                        <select
                          value={selectedPromptVersion}
                          onChange={(event) =>
                            setSelectedPromptVersion(event.target.value)
                          }
                          className="w-full rounded-[8px] border-2 border-[var(--cs-border)] bg-white px-2.5 py-1.5 text-xs font-bold"
                        >
                          {promptVersions.map((version) => (
                            <option key={version} value={version}>
                              {version}
                              {version === activePromptVersion
                                ? ' (attiva)'
                                : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-bold">Provider AI</span>
                        <select
                          value={selectedProviderId}
                          onChange={(event) =>
                            setSelectedProviderId(
                              event.target.value as ProviderId
                            )
                          }
                          className="w-full rounded-[8px] border-2 border-[var(--cs-border)] bg-white px-2.5 py-1.5 text-xs font-bold"
                        >
                          {providers.map((provider) => (
                            <option
                              key={provider.id}
                              value={provider.id}
                              disabled={!provider.configured}
                            >
                              {provider.label} · {provider.model}
                              {!provider.configured ? ' (non config.)' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </UiCard>
                ) : null}

                {TURNSTILE_SITE_KEY && !isAdmin ? (
                  <div className="rounded-[10px] border-2 border-[var(--cs-border)] bg-white p-2.5">
                    <TurnstileWidget
                      resetCounter={turnstileResetCounter}
                      onTokenChange={setTurnstileToken}
                    />
                  </div>
                ) : null}

                <label className="flex cursor-pointer items-start gap-2.5 text-[0.92rem]">
                  <input
                    type="checkbox"
                    checked={acceptedRights}
                    disabled={isGenerating}
                    onChange={(event) => handleRightsToggle(event.target.checked)}
                    className="m-0 h-6 w-6 flex-none accent-[var(--cs-ink)]"
                  />
                  <span>{creator.rightsLabel}</span>
                </label>

                {errorBanner ? (
                  <UiCard
                    tone="danger"
                    className="!p-3 space-y-2"
                    role="alert"
                  >
                    <p className="text-sm font-bold">{errorBanner}</p>
                    {isAdmin && errorDetails ? (
                      <div className="rounded-[8px] border-2 border-[var(--cs-border)] bg-white p-2.5 text-xs text-[var(--cs-ink)] space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold uppercase tracking-wider text-[11px]">
                            Dettaglio Admin
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleCopyAdminError()}
                            className="inline-flex items-center gap-1 rounded-[6px] border-2 border-[var(--cs-border)] bg-[var(--cs-yellow)] px-2 py-0.5 text-[11px] font-bold cursor-pointer"
                          >
                            {copiedError ? (
                              <>
                                <Check className="h-3 w-3" aria-hidden="true" />
                                <span>Copiato</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" aria-hidden="true" />
                                <span>Copia</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="font-mono-num space-y-1 break-words text-[11px]">
                          {errorDetails.statusCode !== undefined ? (
                            <p>
                              HTTP: {errorDetails.statusCode}{' '}
                              {errorDetails.statusText ?? ''}{' '}
                              {errorDetails.contentType
                                ? `(${errorDetails.contentType})`
                                : ''}
                            </p>
                          ) : null}
                          {errorDetails.backendDetails ? (
                            <>
                              <p>
                                Classe:{' '}
                                {errorDetails.backendDetails.errorName ??
                                  'Error'}{' '}
                                · Provider:{' '}
                                {errorDetails.backendDetails.provider ??
                                  'default'}
                              </p>
                              {errorDetails.backendDetails.rawMessage ? (
                                <pre className="whitespace-pre-wrap break-all">
                                  {errorDetails.backendDetails.rawMessage}
                                </pre>
                              ) : null}
                            </>
                          ) : null}
                          {errorDetails.rawBodySnippet ? (
                            <pre className="whitespace-pre-wrap break-all">
                              {errorDetails.rawBodySnippet}
                            </pre>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </UiCard>
                ) : null}

                <UiButton
                  disabled={
                    !acceptedRights || isGenerating || isValidatingPhoto
                  }
                  onClick={() => void handleGenerate()}
                >
                  {isGenerating ? creator.generatingCta : creator.generateCta}
                </UiButton>
              </div>
            )}
          </div>
        )}
      </div>
    </ModalDialog>
  );
}
