import { useState, useRef } from 'react';
import { ArrowLeftRight, Columns2, Image as ImageIcon } from 'lucide-react';
import { VISUAL_PLACEHOLDERS } from '../config/orderConfig';

type ViewMode = 'slider' | 'side-by-side';

export function HeroComparison() {
  const [viewMode, setViewMode] = useState<ViewMode>('slider');
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [originalError, setOriginalError] = useState(false);
  const [coloringError, setColoringError] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);

  const updateFromClientX = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(6, Math.min(94, Math.round(pct))));
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-4 mb-3">
        <p className="text-sm text-zinc-600">
          Esempio reale: da fotografia a pagina da colorare
        </p>
        <div
          className="inline-flex items-center p-1 rounded-lg bg-zinc-100 border border-zinc-200"
          role="group"
          aria-label="Modalità di visualizzazione del confronto"
        >
          <button
            type="button"
            onClick={() => setViewMode('slider')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B83B1F] ${
              viewMode === 'slider'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
            Confronta
          </button>
          <button
            type="button"
            onClick={() => setViewMode('side-by-side')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B83B1F] ${
              viewMode === 'side-by-side'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" aria-hidden="true" />
            Affiancate
          </button>
        </div>
      </div>

      {viewMode === 'slider' ? (
        <div className="space-y-3">
          <div
            ref={containerRef}
            onPointerDown={(e) => {
              isDraggingRef.current = true;
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              updateFromClientX(e.clientX);
            }}
            onPointerMove={(e) => {
              if (isDraggingRef.current) {
                updateFromClientX(e.clientX);
              }
            }}
            onPointerUp={(e) => {
              isDraggingRef.current = false;
              try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
              } catch {
                // Ignore if pointer capture already released
              }
            }}
            className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-50 select-none touch-pan-y cursor-ew-resize"
          >
            {/* Base Layer: Coloring Page (Right side) */}
            <div className="absolute inset-0 w-full h-full bg-white">
              {!coloringError ? (
                <img
                  src={VISUAL_PLACEHOLDERS.heroColoringPage.src}
                  alt={VISUAL_PLACEHOLDERS.heroColoringPage.alt}
                  referrerPolicy="no-referrer"
                  draggable={false}
                  onError={() => setColoringError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-white text-zinc-500 p-6 text-center">
                  <ImageIcon className="w-8 h-8 mb-2" aria-hidden="true" />
                  <span className="text-sm font-medium">
                    {VISUAL_PLACEHOLDERS.heroColoringPage.label}
                  </span>
                </div>
              )}
            </div>

            {/* Clipped Layer: Original Photo (Left side) */}
            <div
              className="absolute inset-0 w-full h-full overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
            >
              {!originalError ? (
                <img
                  src={VISUAL_PLACEHOLDERS.heroOriginalPhoto.src}
                  alt={VISUAL_PLACEHOLDERS.heroOriginalPhoto.alt}
                  referrerPolicy="no-referrer"
                  draggable={false}
                  onError={() => setOriginalError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100 text-zinc-500 p-6 text-center">
                  <ImageIcon className="w-8 h-8 mb-2" aria-hidden="true" />
                  <span className="text-sm font-medium">
                    {VISUAL_PLACEHOLDERS.heroOriginalPhoto.label}
                  </span>
                </div>
              )}
            </div>

            {/* Subtle Edge Labels with Measured Contrast Scrim */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-4 bg-gradient-to-t from-black/55 via-black/15 to-transparent text-white text-xs font-medium">
              <span>{VISUAL_PLACEHOLDERS.heroOriginalPhoto.label}</span>
              <span>{VISUAL_PLACEHOLDERS.heroColoringPage.label}</span>
            </div>

            {/* Vertical Divider & Handle */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(24,24,27,0.18)]"
              style={{ left: `${sliderPos}%` }}
              aria-hidden="true"
            >
              <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white border border-zinc-300 shadow-md flex items-center justify-center text-zinc-900">
                <ArrowLeftRight className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Accessible Range Slider Fallback & Keyboard Control */}
          <div className="flex items-center gap-3 px-1">
            <label htmlFor="hero-comparison-range" className="text-xs text-zinc-600 whitespace-nowrap shrink-0">
              Foto originale
            </label>
            <input
              id="hero-comparison-range"
              type="range"
              min={6}
              max={94}
              value={sliderPos}
              onChange={(e) => setSliderPos(Number(e.target.value))}
              aria-label="Scorri per confrontare la foto originale con la pagina da colorare"
              className="w-full accent-[#B83B1F] cursor-pointer h-2 bg-zinc-200 rounded-lg"
            />
            <span className="text-xs text-zinc-600 whitespace-nowrap shrink-0">
              Pagina da colorare
            </span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <figure className="space-y-2">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-50">
              {!originalError ? (
                <img
                  src={VISUAL_PLACEHOLDERS.heroOriginalPhoto.src}
                  alt={VISUAL_PLACEHOLDERS.heroOriginalPhoto.alt}
                  referrerPolicy="no-referrer"
                  onError={() => setOriginalError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">
                  {VISUAL_PLACEHOLDERS.heroOriginalPhoto.label}
                </div>
              )}
            </div>
            <figcaption className="text-xs font-medium text-zinc-600">
              1. {VISUAL_PLACEHOLDERS.heroOriginalPhoto.label}
            </figcaption>
          </figure>

          <figure className="space-y-2">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-zinc-200 bg-white">
              {!coloringError ? (
                <img
                  src={VISUAL_PLACEHOLDERS.heroColoringPage.src}
                  alt={VISUAL_PLACEHOLDERS.heroColoringPage.alt}
                  referrerPolicy="no-referrer"
                  onError={() => setColoringError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">
                  {VISUAL_PLACEHOLDERS.heroColoringPage.label}
                </div>
              )}
            </div>
            <figcaption className="text-xs font-medium text-zinc-600">
              2. {VISUAL_PLACEHOLDERS.heroColoringPage.label}
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
