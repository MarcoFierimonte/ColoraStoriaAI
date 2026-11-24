import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SITE_TEMPLATE } from '../../config/siteTemplate';
import { ModalDialog, UiBadge } from '../ui';
import { ExampleTrio, type ExampleTilePreview } from './ExampleTrio';

export function ExamplesCarousel() {
  const { examplesGallery } = SITE_TEMPLATE;
  const items = examplesGallery.items;

  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomedTile, setZoomedTile] = useState<ExampleTilePreview | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const scrollToIndex = (nextIndex: number) => {
    const wrapped = ((nextIndex % items.length) + items.length) % items.length;
    setActiveIndex(wrapped);

    const track = trackRef.current;
    if (!track || track.clientWidth <= 0) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    track.scrollTo({
      left: wrapped * track.clientWidth,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };

  const handleScroll = () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      const track = trackRef.current;
      if (!track || track.clientWidth <= 0) return;

      const rawIdx = Math.round(track.scrollLeft / track.clientWidth);
      const clampedIdx = Math.max(0, Math.min(items.length - 1, rawIdx));
      setActiveIndex((prev) => (prev === clampedIdx ? prev : clampedIdx));
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollToIndex(activeIndex + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollToIndex(activeIndex - 1);
    }
  };

  const activeItem = items[activeIndex] ?? items[0];

  return (
    <div
      className="min-w-0 w-full max-w-[440px] justify-self-center space-y-2.5"
      role="region"
      aria-roledescription="carousel"
      aria-label={examplesGallery.title}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[1.05rem] font-bold">
            {activeItem.title ?? activeItem.ariaLabel}
          </span>
          {activeItem.categoryLabel ? (
            <UiBadge tone={activeItem.categoryTone ?? 'yellow'}>
              {activeItem.categoryLabel}
            </UiBadge>
          ) : null}
        </div>
        <span
          className="font-mono-num shrink-0 text-sm font-bold text-[var(--cs-ink-muted)]"
          aria-live="polite"
        >
          {activeIndex + 1} / {items.length}
        </span>
      </div>

      <div
        ref={trackRef}
        onScroll={handleScroll}
        tabIndex={0}
        className="cs-carousel-track rounded-[12px] focus-visible:outline-[3px] focus-visible:outline-[var(--cs-pink-strong)] focus-visible:outline-offset-2"
        aria-label={examplesGallery.carouselAriaLabel}
      >
        {items.map((item, index) => (
          <div key={item.id} className="cs-carousel-slide">
            <ExampleTrio
              item={item}
              fullWidth
              loading={index === 0 ? 'eager' : 'lazy'}
              onTileClick={(tile) =>
                setZoomedTile({
                  ...tile,
                  title: item.title,
                })
              }
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 pt-0.5">
        <button
          type="button"
          className="cs-carousel-nav"
          aria-label={examplesGallery.prevLabel}
          onClick={() => scrollToIndex(activeIndex - 1)}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className="cs-carousel-dot"
              aria-label={`Mostra esempio ${index + 1}: ${item.title ?? item.id}`}
              aria-current={index === activeIndex ? 'true' : undefined}
              onClick={() => scrollToIndex(index)}
            />
          ))}
        </div>

        <button
          type="button"
          className="cs-carousel-nav"
          aria-label={examplesGallery.nextLabel}
          onClick={() => scrollToIndex(activeIndex + 1)}
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <p className="text-center text-xs font-medium text-[var(--cs-ink-muted)]">
        {examplesGallery.sliderHint}
      </p>

      <ModalDialog
        open={zoomedTile !== null}
        size="examples"
        title={zoomedTile?.title ?? examplesGallery.title}
        closeLabel={examplesGallery.zoomCloseLabel}
        onRequestClose={() => setZoomedTile(null)}
      >
        {zoomedTile ? (
          <div className="space-y-3 px-4 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-1">
            <div className="flex items-center gap-2">
              <UiBadge tone={zoomedTile.badgeTone}>{zoomedTile.label}</UiBadge>
            </div>
            <img
              src={zoomedTile.src}
              alt={zoomedTile.alt}
              className="mx-auto max-h-[75dvh] w-auto max-w-full rounded-[10px] border-[3px] border-[var(--cs-border)] bg-white"
            />
            <p className="text-sm text-[var(--cs-ink-muted)]">
              {zoomedTile.alt}
            </p>
          </div>
        ) : null}
      </ModalDialog>
    </div>
  );
}
