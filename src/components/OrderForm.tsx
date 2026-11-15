import { useRef, useState, useEffect, type DragEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  ImagePlus,
  Loader2,
  Sun,
  Trash2,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';
import { ORDER_CONFIG, formatPriceEur } from '../config/orderConfig';
import { BOOK_THEMES, type ThemeId } from '../data/themes';
import {
  validatePhotoFiles,
  type RejectedPhoto,
  type ValidatedPhoto,
} from '../utils/photoValidation';
import {
  OrderSubmissionError,
  submitBookOrder,
  type OrderConfirmationResult,
} from '../services/orderService';
import type { LegalTopic } from './LegalModal';

interface OrderFormProps {
  onOrderConfirmed: (result: OrderConfirmationResult) => void;
  onOpenLegal: (topic: LegalTopic) => void;
  onSummaryChange?: (summary: {
    photoCount: number;
    isReady: boolean;
    isSubmitting: boolean;
  }) => void;
  externalSubmitTrigger?: number;
}

interface FieldErrors {
  theme?: string;
  coverTitle?: string;
  photos?: string;
  email?: string;
  rightsConfirmed?: string;
  privacyAccepted?: string;
  digitalWaiverAccepted?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function OrderForm({
  onOrderConfirmed,
  onOpenLegal,
  onSummaryChange,
  externalSubmitTrigger = 0,
}: OrderFormProps) {
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId | null>(null);
  const [coverTitle, setCoverTitle] = useState('');
  const [photos, setPhotos] = useState<ValidatedPhoto[]>([]);
  const [email, setEmail] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [digitalWaiverAccepted, setDigitalWaiverAccepted] = useState(false);

  const [isValidatingPhotos, setIsValidatingPhotos] = useState(false);
  const [isDragOverDropzone, setIsDragOverDropzone] = useState(false);
  const [rejectedFiles, setRejectedFiles] = useState<RejectedPhoto[]>([]);
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState<number | null>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgressText, setSubmitProgressText] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const themeSectionRef = useRef<HTMLFieldSetElement | null>(null);
  const titleSectionRef = useRef<HTMLDivElement | null>(null);
  const photosSectionRef = useRef<HTMLDivElement | null>(null);
  const emailSectionRef = useRef<HTMLDivElement | null>(null);
  const checkboxesSectionRef = useRef<HTMLFieldSetElement | null>(null);
  const photosRef = useRef<ValidatedPhoto[]>(photos);
  photosRef.current = photos;

  useEffect(() => {
    return () => {
      for (const p of photosRef.current) {
        URL.revokeObjectURL(p.previewUrl);
      }
    };
  }, []);

  const selectedTheme = BOOK_THEMES.find((t) => t.id === selectedThemeId) ?? null;

  const isFormReady =
    selectedTheme !== null &&
    coverTitle.trim().length > 0 &&
    photos.length >= ORDER_CONFIG.minPhotos &&
    photos.length <= ORDER_CONFIG.maxPhotos &&
    EMAIL_REGEX.test(email.trim()) &&
    rightsConfirmed &&
    privacyAccepted &&
    digitalWaiverAccepted;

  useEffect(() => {
    onSummaryChange?.({
      photoCount: photos.length,
      isReady: isFormReady,
      isSubmitting,
    });
  }, [photos.length, isFormReady, isSubmitting, onSummaryChange]);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsValidatingPhotos(true);
    setRejectedFiles([]);

    const filesArray = Array.from(fileList);
    const { accepted, rejected } = await validatePhotoFiles(
      filesArray,
      photos.length
    );

    if (accepted.length > 0) {
      setPhotos((prev) => {
        const next = [...prev, ...accepted];
        if (hasAttemptedSubmit && next.length >= ORDER_CONFIG.minPhotos) {
          setFieldErrors((errs) => ({ ...errs, photos: undefined }));
        }
        return next;
      });
    }

    if (rejected.length > 0) {
      setRejectedFiles(rejected);
    }

    setIsValidatingPhotos(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleMovePhoto = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= photos.length) return;
    setPhotos((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, item);
      return copy;
    });
  };

  const handleThumbnailDrop = (targetIndex: number) => {
    if (draggedPhotoIndex === null || draggedPhotoIndex === targetIndex) {
      setDraggedPhotoIndex(null);
      return;
    }
    setPhotos((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(draggedPhotoIndex, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
    setDraggedPhotoIndex(null);
  };

  const validateAllFields = (): { valid: boolean; errors: FieldErrors } => {
    const errors: FieldErrors = {};

    if (!selectedTheme) {
      errors.theme = 'Scegli uno dei sei mondi illustrati per il libro.';
    }
    if (coverTitle.trim().length === 0) {
      errors.coverTitle = 'Inserisci un titolo breve per la copertina.';
    }
    if (photos.length < ORDER_CONFIG.minPhotos) {
      const missing = ORDER_CONFIG.minPhotos - photos.length;
      errors.photos =
        photos.length === 0
          ? `Carica almeno ${ORDER_CONFIG.minPhotos} foto per creare il libro.`
          : `Mancano ancora ${missing} ${missing === 1 ? 'foto' : 'foto'} per raggiungere il minimo di ${ORDER_CONFIG.minPhotos}.`;
    } else if (photos.length > ORDER_CONFIG.maxPhotos) {
      errors.photos = `Puoi inserire al massimo ${ORDER_CONFIG.maxPhotos} foto.`;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = 'Inserisci l’indirizzo email dove inviare il PDF.';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = 'L’indirizzo email non sembra valido (es. nome@esempio.it).';
    }

    if (!rightsConfirmed) {
      errors.rightsConfirmed =
        'Conferma di avere i diritti e il consenso per le foto caricate.';
    }
    if (!privacyAccepted) {
      errors.privacyAccepted = 'Accetta l’informativa sulla privacy e le condizioni.';
    }
    if (!digitalWaiverAccepted) {
      errors.digitalWaiverAccepted =
        'Accetta la consegna digitale immediata per procedere con l’ordine.';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  };

  const scrollToFirstError = (errors: FieldErrors) => {
    if (errors.theme) {
      themeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (errors.coverTitle) {
      titleSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (errors.photos) {
      photosSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (errors.email) {
      emailSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (
      errors.rightsConfirmed ||
      errors.privacyAccepted ||
      errors.digitalWaiverAccepted
    ) {
      checkboxesSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  };

  const executeOrderSubmit = async () => {
    setHasAttemptedSubmit(true);
    setSubmitError(null);

    const { valid, errors } = validateAllFields();
    setFieldErrors(errors);

    if (!valid || !selectedTheme) {
      scrollToFirstError(errors);
      return;
    }

    setIsSubmitting(true);
    setSubmitProgressText('Invio dell’ordine in corso...');

    try {
      const confirmation = await submitBookOrder(
        {
          themeId: selectedTheme.id,
          themeName: selectedTheme.name,
          coverTitle: coverTitle.trim(),
          photos,
          email: email.trim(),
          rightsConfirmed,
          privacyAccepted,
          digitalWaiverAccepted,
        },
        (progress) => setSubmitProgressText(progress)
      );
      onOrderConfirmed(confirmation);
    } catch (err) {
      if (err instanceof OrderSubmissionError) {
        setSubmitError(err.message);
      } else {
        setSubmitError(
          'Si è verificato un problema temporaneo durante l’invio dell’ordine. I tuoi dati e le tue foto sono rimasti salvati: riprova tra un momento.'
        );
      }
    } finally {
      setIsSubmitting(false);
      setSubmitProgressText('');
    }
  };

  const lastExternalTriggerRef = useRef(externalSubmitTrigger);
  useEffect(() => {
    if (externalSubmitTrigger !== lastExternalTriggerRef.current) {
      lastExternalTriggerRef.current = externalSubmitTrigger;
      if (!isSubmitting) {
        void executeOrderSubmit();
      }
    }
  });

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isSubmitting) {
      void executeOrderSubmit();
    }
  };

  const missingPhotosCount = Math.max(0, ORDER_CONFIG.minPhotos - photos.length);

  return (
    <form onSubmit={handleFormSubmit} noValidate className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
      {/* Left Column: All Form Steps on One Page */}
      <div className="lg:col-span-7 space-y-12">
        {/* Step a: Scelta del tema */}
        <fieldset ref={themeSectionRef} className="space-y-4">
          <legend className="text-xl sm:text-2xl font-semibold text-zinc-900">
            1. Scegli il mondo del libro
          </legend>
          <p className="text-sm text-zinc-600">
            Seleziona uno dei sei temi illustrati: tutte le pagine riprenderanno l’ambientazione scelta.
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
                    if (hasAttemptedSubmit) {
                      setFieldErrors((prev) => ({ ...prev, theme: undefined }));
                    }
                  }}
                  className={`group text-left rounded-2xl border p-3 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B83B1F] ${
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

          {fieldErrors.theme && (
            <p className="flex items-center gap-2 text-sm text-red-700 font-medium" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{fieldErrors.theme}</span>
            </p>
          )}
        </fieldset>

        {/* Step b: Titolo della copertina */}
        <div ref={titleSectionRef} className="pt-8 border-t border-zinc-200 space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <label
              htmlFor="cover-title-input"
              className="text-xl sm:text-2xl font-semibold text-zinc-900"
            >
              2. Titolo della copertina
            </label>
            <span
              className="font-mono-num text-xs text-zinc-500 whitespace-nowrap shrink-0"
              aria-live="polite"
            >
              {coverTitle.length} / {ORDER_CONFIG.coverTitleMaxLength}
            </span>
          </div>
          <p className="text-sm text-zinc-600">
            Comparirà in grande sulla prima pagina del libro (massimo {ORDER_CONFIG.coverTitleMaxLength} caratteri).
          </p>
          <input
            id="cover-title-input"
            type="text"
            value={coverTitle}
            maxLength={ORDER_CONFIG.coverTitleMaxLength}
            onChange={(e) => {
              const value = e.target.value;
              setCoverTitle(value);
              if (hasAttemptedSubmit && value.trim().length > 0) {
                setFieldErrors((prev) => ({ ...prev, coverTitle: undefined }));
              }
            }}
            placeholder="Es. Le avventure di Sofia"
            aria-invalid={Boolean(fieldErrors.coverTitle)}
            aria-describedby={fieldErrors.coverTitle ? 'cover-title-error' : undefined}
            className={`w-full px-4 py-3 text-base rounded-xl border bg-white text-zinc-900 placeholder:text-zinc-400 transition-colors focus:outline-none focus:ring-2 ${
              fieldErrors.coverTitle
                ? 'border-red-600 focus:ring-red-600/20'
                : 'border-zinc-300 focus:border-[#B83B1F] focus:ring-[#B83B1F]/20'
            }`}
          />
          {fieldErrors.coverTitle && (
            <p
              id="cover-title-error"
              className="flex items-center gap-2 text-sm text-red-700 font-medium"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{fieldErrors.coverTitle}</span>
            </p>
          )}
        </div>

        {/* Step c: Caricamento delle foto */}
        <div ref={photosSectionRef} className="pt-8 border-t border-zinc-200 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-xl sm:text-2xl font-semibold text-zinc-900">
              3. Carica le tue foto
            </h3>
            <span
              className={`font-mono-num text-sm font-semibold ${
                photos.length >= ORDER_CONFIG.minPhotos
                  ? 'text-emerald-800'
                  : 'text-zinc-700'
              }`}
              aria-live="polite"
            >
              {photos.length} / {ORDER_CONFIG.minPhotos}–{ORDER_CONFIG.maxPhotos} foto
            </span>
          </div>

          {/* Visible Photo Quality Advice */}
          <div className="rounded-xl bg-[#FBFBF9] border border-zinc-200 p-4 space-y-2 text-sm text-zinc-700">
            <p className="font-semibold text-zinc-900">
              Consigli per ottenere pagine nitide da colorare:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-zinc-600">
              <li className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#B83B1F] shrink-0" aria-hidden="true" />
                <span>Volti ben visibili e non coperti</span>
              </li>
              <li className="flex items-center gap-2">
                <Sun className="w-4 h-4 text-[#B83B1F] shrink-0" aria-hidden="true" />
                <span>Foto nitide, luminose e non mosse</span>
              </li>
            </ul>
            <p className="text-xs text-zinc-500 pt-1">
              Formati: {ORDER_CONFIG.acceptedExtensionsLabel} · Risoluzione minima{' '}
              <span className="font-mono-num">
                {ORDER_CONFIG.minWidthPx}×{ORDER_CONFIG.minHeightPx} px
              </span>{' '}
              · Peso massimo{' '}
              <span className="font-mono-num">{ORDER_CONFIG.maxFileSizeMb} MB</span> per foto.
            </p>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={(e: DragEvent<HTMLDivElement>) => {
              e.preventDefault();
              setIsDragOverDropzone(true);
            }}
            onDragLeave={() => setIsDragOverDropzone(false)}
            onDrop={(e: DragEvent<HTMLDivElement>) => {
              e.preventDefault();
              setIsDragOverDropzone(false);
              void handleFilesSelected(e.dataTransfer.files);
            }}
            className={`rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-colors ${
              isDragOverDropzone
                ? 'border-[#B83B1F] bg-[#FDF1ED]/60'
                : fieldErrors.photos
                  ? 'border-red-400 bg-red-50/30'
                  : 'border-zinc-300 bg-[#FBFBF9]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ORDER_CONFIG.acceptedMimeTypes.join(',')}
              onChange={(e) => void handleFilesSelected(e.target.files)}
              className="sr-only"
              id="photo-upload-input"
              disabled={photos.length >= ORDER_CONFIG.maxPhotos || isValidatingPhotos}
            />

            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-[#B83B1F]">
                {isValidatingPhotos ? (
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                ) : (
                  <ImagePlus className="w-5 h-5" aria-hidden="true" />
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm sm:text-base font-medium text-zinc-900">
                  {photos.length >= ORDER_CONFIG.maxPhotos
                    ? `Hai raggiunto il limite massimo di ${ORDER_CONFIG.maxPhotos} foto`
                    : 'Trascina qui le tue foto oppure selezionale dal dispositivo'}
                </p>
                <p className="text-xs sm:text-sm text-zinc-600">
                  {photos.length < ORDER_CONFIG.minPhotos
                    ? `Servono ancora ${missingPhotosCount} ${missingPhotosCount === 1 ? 'foto' : 'foto'} (minimo ${ORDER_CONFIG.minPhotos}, massimo ${ORDER_CONFIG.maxPhotos})`
                    : `Puoi aggiungere ancora ${ORDER_CONFIG.maxPhotos - photos.length} foto o riordinarle qui sotto`}
                </p>
              </div>

              <label
                htmlFor="photo-upload-input"
                className={`mt-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  photos.length >= ORDER_CONFIG.maxPhotos
                    ? 'bg-zinc-200 text-zinc-500 cursor-not-allowed'
                    : 'bg-zinc-900 text-white hover:bg-zinc-800 cursor-pointer'
                }`}
              >
                {isValidatingPhotos ? 'Controllo foto...' : 'Carica foto'}
              </label>
            </div>
          </div>

          {/* Rejected files validation errors */}
          {rejectedFiles.length > 0 && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2"
              role="alert"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Alcune foto non sono state aggiunte:</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRejectedFiles([])}
                  className="text-xs font-medium text-red-800 underline hover:no-underline cursor-pointer"
                >
                  Nascondi
                </button>
              </div>
              <ul className="space-y-1 text-xs sm:text-sm text-red-700 list-disc pl-5">
                {rejectedFiles.map((item, idx) => (
                  <li key={`${item.fileName}-${idx}`}>
                    <span className="font-medium">{item.fileName}:</span> {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {fieldErrors.photos && (
            <p className="flex items-center gap-2 text-sm text-red-700 font-medium" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{fieldErrors.photos}</span>
            </p>
          )}

          {/* Thumbnails Grid with Reorder & Remove */}
          {photos.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs text-zinc-600">
                <span>Ordine delle pagine nel libro (puoi trascinare o usare le frecce)</span>
              </div>

              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((photo, index) => (
                  <li
                    key={photo.id}
                    draggable
                    onDragStart={() => setDraggedPhotoIndex(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleThumbnailDrop(index)}
                    onDragEnd={() => setDraggedPhotoIndex(null)}
                    className={`rounded-xl border bg-white p-2 space-y-2 transition-opacity ${
                      draggedPhotoIndex === index
                        ? 'opacity-50 border-[#B83B1F]'
                        : 'border-zinc-200'
                    }`}
                  >
                    <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-zinc-100">
                      <img
                        src={photo.previewUrl}
                        alt={`Anteprima pagina ${index + 1}: ${photo.name}`}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono-num text-xs font-medium text-zinc-700">
                        Pag. {index + 1}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMovePhoto(index, -1)}
                          disabled={index === 0}
                          aria-label={`Sposta pagina ${index + 1} prima`}
                          className="w-8 h-8 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-700 hover:bg-zinc-100 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-2 focus-visible:outline-[#B83B1F]"
                        >
                          <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMovePhoto(index, 1)}
                          disabled={index === photos.length - 1}
                          aria-label={`Sposta pagina ${index + 1} dopo`}
                          className="w-8 h-8 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-700 hover:bg-zinc-100 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-2 focus-visible:outline-[#B83B1F]"
                        >
                          <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(photo.id)}
                          aria-label={`Rimuovi foto ${index + 1}`}
                          className="w-8 h-8 rounded-lg border border-zinc-200 flex items-center justify-center text-red-700 hover:bg-red-50 hover:border-red-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#B83B1F]"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Step d: Email per ricevere il PDF */}
        <div ref={emailSectionRef} className="pt-8 border-t border-zinc-200 space-y-3">
          <label
            htmlFor="delivery-email-input"
            className="block text-xl sm:text-2xl font-semibold text-zinc-900"
          >
            4. Email per ricevere il PDF
          </label>
          <p className="text-sm text-zinc-600">
            Ti invieremo il file PDF pronto da stampare direttamente a questo indirizzo.
          </p>
          <input
            id="delivery-email-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              const value = e.target.value;
              setEmail(value);
              if (hasAttemptedSubmit && EMAIL_REGEX.test(value.trim())) {
                setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }
            }}
            placeholder="nome@esempio.it"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'delivery-email-error' : undefined}
            className={`w-full px-4 py-3 text-base rounded-xl border bg-white text-zinc-900 placeholder:text-zinc-400 transition-colors focus:outline-none focus:ring-2 ${
              fieldErrors.email
                ? 'border-red-600 focus:ring-red-600/20'
                : 'border-zinc-300 focus:border-[#B83B1F] focus:ring-[#B83B1F]/20'
            }`}
          />
          {fieldErrors.email && (
            <p
              id="delivery-email-error"
              className="flex items-center gap-2 text-sm text-red-700 font-medium"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{fieldErrors.email}</span>
            </p>
          )}
        </div>

        {/* Step e: Tre caselle obbligatorie */}
        <fieldset ref={checkboxesSectionRef} className="pt-8 border-t border-zinc-200 space-y-4">
          <legend className="text-xl sm:text-2xl font-semibold text-zinc-900">
            5. Conferme obbligatorie
          </legend>

          <div className="space-y-3 pt-1">
            {/* Checkbox 1 */}
            <div className="space-y-1">
              <label className="flex items-start gap-3.5 p-3.5 rounded-xl border border-zinc-200 bg-[#FBFBF9] hover:border-zinc-300 transition-colors cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={rightsConfirmed}
                  onChange={(e) => {
                    setRightsConfirmed(e.target.checked);
                    if (e.target.checked && hasAttemptedSubmit) {
                      setFieldErrors((prev) => ({ ...prev, rightsConfirmed: undefined }));
                    }
                  }}
                  className="mt-0.5 w-5 h-5 rounded border-zinc-300 accent-[#B83B1F] shrink-0 cursor-pointer"
                />
                <span className="text-sm text-zinc-800 leading-relaxed">
                  Dichiaro di avere il diritto di usare le foto caricate e il consenso delle persone ritratte, in particolare dei minori eventualmente presenti.
                </span>
              </label>
              {fieldErrors.rightsConfirmed && (
                <p className="flex items-center gap-1.5 text-xs sm:text-sm text-red-700 font-medium pl-1" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{fieldErrors.rightsConfirmed}</span>
                </p>
              )}
            </div>

            {/* Checkbox 2 */}
            <div className="space-y-1">
              <label className="flex items-start gap-3.5 p-3.5 rounded-xl border border-zinc-200 bg-[#FBFBF9] hover:border-zinc-300 transition-colors cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => {
                    setPrivacyAccepted(e.target.checked);
                    if (e.target.checked && hasAttemptedSubmit) {
                      setFieldErrors((prev) => ({ ...prev, privacyAccepted: undefined }));
                    }
                  }}
                  className="mt-0.5 w-5 h-5 rounded border-zinc-300 accent-[#B83B1F] shrink-0 cursor-pointer"
                />
                <span className="text-sm text-zinc-800 leading-relaxed">
                  Accetto la{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onOpenLegal('privacy');
                    }}
                    className="underline text-[#B83B1F] hover:text-[#962D16] font-medium cursor-pointer"
                  >
                    Privacy
                  </button>{' '}
                  e le{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onOpenLegal('condizioni');
                    }}
                    className="underline text-[#B83B1F] hover:text-[#962D16] font-medium cursor-pointer"
                  >
                    Condizioni di Servizio
                  </button>
                  .
                </span>
              </label>
              {fieldErrors.privacyAccepted && (
                <p className="flex items-center gap-1.5 text-xs sm:text-sm text-red-700 font-medium pl-1" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{fieldErrors.privacyAccepted}</span>
                </p>
              )}
            </div>

            {/* Checkbox 3 */}
            <div className="space-y-1">
              <label className="flex items-start gap-3.5 p-3.5 rounded-xl border border-zinc-200 bg-[#FBFBF9] hover:border-zinc-300 transition-colors cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={digitalWaiverAccepted}
                  onChange={(e) => {
                    setDigitalWaiverAccepted(e.target.checked);
                    if (e.target.checked && hasAttemptedSubmit) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        digitalWaiverAccepted: undefined,
                      }));
                    }
                  }}
                  className="mt-0.5 w-5 h-5 rounded border-zinc-300 accent-[#B83B1F] shrink-0 cursor-pointer"
                />
                <span className="text-sm text-zinc-800 leading-relaxed">
                  Accetto la consegna digitale immediata e la perdita del diritto di recesso una volta avviata la realizzazione del libro (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onOpenLegal('recesso');
                    }}
                    className="underline text-[#B83B1F] hover:text-[#962D16] font-medium cursor-pointer"
                  >
                    informazioni sul recesso
                  </button>
                  ).
                </span>
              </label>
              {fieldErrors.digitalWaiverAccepted && (
                <p className="flex items-center gap-1.5 text-xs sm:text-sm text-red-700 font-medium pl-1" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{fieldErrors.digitalWaiverAccepted}</span>
                </p>
              )}
            </div>
          </div>
        </fieldset>
      </div>

      {/* Right Column: Sticky Riepilogo Ordine & Cover Preview */}
      <aside className="lg:col-span-5 lg:sticky lg:top-24">
        <div className="rounded-2xl border border-zinc-200 bg-[#FBFBF9] p-6 sm:p-7 space-y-6">
          <h3 className="text-xl font-semibold text-zinc-900">Riepilogo ordine</h3>

          {/* Live Mini Cover Preview */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 flex items-center gap-4">
            <div className="w-20 aspect-[18/13] rounded-lg border border-zinc-200 overflow-hidden bg-white shrink-0">
              {selectedTheme ? (
                selectedTheme.renderIllustration('w-full h-full')
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-50 text-[11px] text-zinc-400 text-center px-1">
                  Copertina
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-zinc-500">Anteprima copertina</p>
              <p className="text-sm font-semibold text-zinc-900 truncate">
                {coverTitle.trim() || 'Il tuo titolo apparirà qui'}
              </p>
              <p className="text-xs text-zinc-600 mt-0.5">
                {selectedTheme ? `Mondo: ${selectedTheme.name}` : 'Nessun mondo selezionato'}
              </p>
            </div>
          </div>

          <dl className="divide-y divide-zinc-200/80 text-sm">
            <div className="py-2.5 flex items-center justify-between gap-4">
              <dt className="text-zinc-600">Mondo illustrato</dt>
              <dd className="font-medium text-zinc-900">
                {selectedTheme ? selectedTheme.name : 'Da scegliere'}
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-4">
              <dt className="text-zinc-600">Foto caricate</dt>
              <dd className="font-medium text-zinc-900 font-mono-num">
                {photos.length} / {ORDER_CONFIG.minPhotos}–{ORDER_CONFIG.maxPhotos}
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-4">
              <dt className="text-zinc-600">Formato consegna</dt>
              <dd className="font-medium text-zinc-900">PDF via email</dd>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-4">
              <dt className="text-zinc-600">Tempi stimati</dt>
              <dd className="font-medium text-zinc-900">
                Entro {ORDER_CONFIG.estimatedDelivery}
              </dd>
            </div>
            <div className="pt-4 flex items-baseline justify-between gap-4">
              <dt className="text-base font-semibold text-zinc-900">Totale</dt>
              <dd className="text-2xl font-semibold text-zinc-900 font-mono-num">
                {formatPriceEur(ORDER_CONFIG.priceEur)}
              </dd>
            </div>
          </dl>

          {/* Submission Error State with Retry */}
          {submitError && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2"
              role="alert"
            >
              <div className="flex items-start gap-2 text-sm text-red-800">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{submitError}</span>
              </div>
              <button
                type="button"
                onClick={() => void executeOrderSubmit()}
                className="text-sm font-semibold text-red-900 underline hover:no-underline cursor-pointer"
              >
                Riprova adesso
              </button>
            </div>
          )}

          {/* Primary Submit CTA */}
          <div className="space-y-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[48px] px-6 py-3.5 rounded-xl bg-[#B83B1F] hover:bg-[#9E3119] disabled:bg-zinc-400 text-white font-semibold text-base transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-wait focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B83B1F]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  <span>Invio in corso...</span>
                </>
              ) : (
                <span>Paga e crea il mio libro</span>
              )}
            </button>

            {isSubmitting && submitProgressText && (
              <p className="text-xs text-center text-zinc-600" aria-live="polite">
                {submitProgressText}
              </p>
            )}

            <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 pt-1">
              <ShieldCheck className="w-4 h-4 text-zinc-500 shrink-0" aria-hidden="true" />
              <span>Le foto vengono cancellate dopo la creazione del PDF</span>
            </div>
          </div>
        </div>
      </aside>
    </form>
  );
}
