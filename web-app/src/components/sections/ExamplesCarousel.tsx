import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SITE_TEMPLATE } from '../../config/siteTemplate';
import { ModalDialog, UiBadge } from '../ui';
import { ExampleTrio, type ExampleTilePreview } from './ExampleTrio';

interface PendingScrollTarget {
  index: number;
  startLeft: number;
}

export function ExamplesCarousel() {
  const { examplesGallery } = SITE_TEMPLATE;
  const items = examplesGallery.items;

  const [activeIndex, setActiveIndex] = useState(0);
  const [settledAnnouncement, setSettledAnnouncement] = useState('');
  const [zoomedTile, setZoomedTile] = useState<ExampleTilePreview | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const pendingScrollRef = useRef<PendingScrollTarget | null>(null);
  const lastSettledIndexRef = useRef(0);

  const commitSettledSlide = useCallback(
    (settledIdx: number) => {
      pendingScrollRef.current = null;
      setActiveIndex((prev) => (prev === settledIdx ? prev : settledIdx));
      if (settledIdx !== lastSettledIndexRef.current) {
        lastSettledIndexRef.current = settledIdx;
        const settledItem = items[settledIdx];
        setSettledAnnouncement(
          `Esempio ${settledIdx + 1} di ${items.length}: ${settledItem?.title ?? settledItem?.id ?? ''}`
        );
      }
    },
    [items]
  );

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const handleSettled = () => {
      if (track.clientWidth <= 0) return;

      const pending = pendingScrollRef.current;
      const rawIdx = Math.round(track.scrollLeft / track.clientWidth);
      const clampedIdx = Math.max(0, Math.min(items.length - 1, rawIdx));

      // Ignore an obsolete settle emitted before a newly requested scroll moves off startLeft.
      if (
        pending &&
        Math.abs(track.scrollLeft - pending.startLeft) < 2 &&
        clampedIdx !== pending.index
      ) {
        return;
      }

      commitSettledSlide(clampedIdx);
    };

    const supportsScrollEnd = 'onscrollend' in window;
    if (supportsScrollEnd) {
      track.addEventListener('scrollend', handleSettled);
      return () => {
        track.removeEventListener('scrollend', handleSettled);
      };
    }

    let debounceTimer: number | null = null;
    const onFallbackScroll = () => {
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
      }
      debounceTimer = window.setTimeout(handleSettled, 150);
    };

    track.addEventListener('scroll', onFallbackScroll, { passive: true });
    return () => {
      track.removeEventListener('scroll', onFallbackScroll);
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
      }
    };
  }, [commitSettledSlide, items.length]);

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
    const targetLeft = wrapped * track.clientWidth;

    if (prefersReducedMotion || Math.abs(track.scrollLeft - targetLeft) < 2) {
      if (Math.abs(track.scrollLeft - targetLeft) >= 2) {
        track.scrollTo({ left: targetLeft, behavior: 'auto' });
      }
      commitSettledSlide(wrapped);
      return;
    }

    pendingScrollRef.current = { index: wrapped, startLeft: track.scrollLeft };
    track.scrollTo({
      left: targetLeft,
      behavior: 'smooth',
    });
  };

  const stepSlide = (delta: number) => {
    const baseIndex = pendingScrollRef.current?.index ?? activeIndex;
    scrollToIndex(baseIndex + delta);
  };

  const handleScroll = () => {
    // Skip frame reads during programmatic smooth scrolling so rapid updates do not stutter.
    if (pendingScrollRef.current !== null) return;

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

  const handleTrackKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      stepSlide(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      stepSlide(-1);
    }
  };

  const activeItem = items[activeIndex] ?? items[0];

  return (
    <section
      className="min-w-0 w-full max-w-[440px] justify-self-center space-y-2.5"
      aria-roledescription="carousel"
      aria-label={examplesGallery.title}
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
        <span className="font-mono-num shrink-0 text-sm font-bold text-[var(--cs-ink-muted)]">
          {activeIndex + 1} / {items.length}
        </span>
      </div>

      <div
        ref={trackRef}
        onScroll={handleScroll}
        onKeyDown={handleTrackKeyDown}
        tabIndex={0}
        role="group"
        className="cs-carousel-track rounded-[12px] focus-visible:outline-[3px] focus-visible:outline-[var(--cs-pink-strong)] focus-visible:outline-offset-2"
        aria-label={examplesGallery.carouselAriaLabel}
      >
        {items.map((item, index) => (
          <div
            key={item.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} di ${items.length}: ${item.title ?? item.id}`}
            className="cs-carousel-slide"
          >
            <ExampleTrio
              item={item}
              fullWidth
              priority={index === 0 ? 'lcp' : 'hidden-slide'}
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

      <p className="sr-only" role="status" aria-live="polite">
        {settledAnnouncement}
      </p>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <button
          type="button"
          className="cs-carousel-nav"
          aria-label={examplesGallery.prevLabel}
          onClick={() => stepSlide(-1)}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <nav
          aria-label="Scegli un esempio"
          className="flex items-center gap-0.5 sm:gap-1"
        >
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
        </nav>

        <button
          type="button"
          className="cs-carousel-nav"
          aria-label={examplesGallery.nextLabel}
          onClick={() => stepSlide(1)}
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
    </section>
  );
}
