import { ArrowRight, ZoomIn } from 'lucide-react';
import type { ExampleTrioSlot } from '../../config/siteTemplate';
import { UiBadge } from '../ui';

export interface ExampleTilePreview {
  title?: string;
  label: string;
  badgeTone: 'yellow' | 'mint' | 'pink';
  src: string;
  alt: string;
}

export interface ExampleTrioProps {
  item: ExampleTrioSlot;
  priority?: 'lcp' | 'hidden-slide' | 'default';
  onTileClick?: (tile: ExampleTilePreview) => void;
}

interface DrawingTileProps {
  badgeLabel: string;
  badgeTone: 'mint' | 'pink';
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low';
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
  onClick?: (tile: ExampleTilePreview) => void;
}

function DrawingTile({
  badgeLabel,
  badgeTone,
  loading,
  fetchPriority,
  src,
  alt,
  width,
  height,
  onClick,
}: DrawingTileProps) {
  if (!src) return null;

  const resolvedAlt = alt ?? badgeLabel;
  const imgElement = (
    <img
      src={src}
      alt={resolvedAlt}
      width={width}
      height={height}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      className="block w-full aspect-[3/4] object-contain bg-white"
    />
  );

  return (
    <div className="cs-tile">
      {onClick ? (
        <button
          type="button"
          onClick={() =>
            onClick({
              label: badgeLabel,
              badgeTone,
              src,
              alt: resolvedAlt,
            })
          }
          aria-label={`Ingrandisci ${badgeLabel}: ${resolvedAlt}`}
          className="group relative block w-full cursor-zoom-in text-left focus-visible:outline-[3px] focus-visible:outline-[var(--cs-pink-strong)] focus-visible:outline-offset-[-3px]"
        >
          {imgElement}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-2 bottom-2 inline-grid h-7 w-7 place-items-center rounded-[7px] border-2 border-[var(--cs-border)] bg-[var(--cs-bg)]/95 opacity-85 transition-opacity group-hover:opacity-100"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </span>
        </button>
      ) : (
        imgElement
      )}
      <UiBadge
        tone={badgeTone}
        className="pointer-events-none absolute left-2 top-2"
      >
        {badgeLabel}
      </UiBadge>
    </div>
  );
}

export function ExampleTrio({
  item,
  priority = 'default',
  onTileClick,
}: ExampleTrioProps) {
  const resolvedLoading: 'eager' | 'lazy' | undefined =
    priority === 'lcp' ? undefined : 'lazy';

  const primaryFetchPriority: 'high' | 'low' | undefined =
    priority === 'lcp'
      ? 'high'
      : priority === 'hidden-slide'
        ? 'low'
        : undefined;

  const secondaryFetchPriority: 'low' | undefined =
    priority === 'hidden-slide' ? 'low' : undefined;

  const photoAlt = item.photoAlt ?? item.photoLabel;

  return (
    <figure className="m-0 grid gap-2.5 sm:gap-3" aria-label={item.ariaLabel}>
      {/* Compact horizontal source strip so photo + both A4 drawings fit above the mobile fold */}
      <div className="flex items-center gap-2.5 sm:gap-3 rounded-[12px] border-[3px] border-[var(--cs-border)] bg-[var(--cs-surface)] p-2 shadow-[4px_4px_0_var(--cs-border)]">
        {item.photoSrc ? (
          <button
            type="button"
            onClick={() =>
              onTileClick?.({
                label: item.photoLabel,
                badgeTone: 'yellow',
                src: item.photoSrc!,
                alt: photoAlt,
              })
            }
            aria-label={`Ingrandisci ${item.photoLabel}: ${photoAlt}`}
            className="relative w-[88px] sm:w-[118px] shrink-0 overflow-hidden rounded-[8px] border-2 border-[var(--cs-border)] bg-white cursor-zoom-in focus-visible:outline-[3px] focus-visible:outline-[var(--cs-pink-strong)] focus-visible:outline-offset-2"
          >
            <img
              src={item.photoSrc}
              alt={photoAlt}
              width={item.photoWidth ?? item.width}
              height={item.photoHeight ?? item.height}
              loading={resolvedLoading}
              fetchPriority={primaryFetchPriority}
              decoding="async"
              className="block w-full aspect-[4/3] object-cover"
            />
          </button>
        ) : null}

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <UiBadge tone="yellow">{item.photoLabel}</UiBadge>
            {item.categoryLabel ? (
              <UiBadge tone={item.categoryTone ?? 'yellow'}>
                {item.categoryLabel}
              </UiBadge>
            ) : null}
          </div>
          <p className="truncate text-sm sm:text-base font-bold text-[var(--cs-ink)]">
            {item.title ?? item.ariaLabel}
          </p>
        </div>

        <span
          aria-hidden="true"
          className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-[8px] border-2 border-[var(--cs-border)] bg-[var(--cs-bg)] text-[var(--cs-ink)]"
        >
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>

      {/* Prominent side-by-side A4 coloring outputs */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
        <DrawingTile
          badgeLabel={item.faithfulLabel}
          badgeTone="mint"
          loading={resolvedLoading}
          fetchPriority={primaryFetchPriority}
          src={item.faithfulSrc}
          alt={item.faithfulAlt}
          width={item.drawingWidth ?? item.width}
          height={item.drawingHeight ?? item.height}
          onClick={onTileClick}
        />
        <DrawingTile
          badgeLabel={item.creativeLabel}
          badgeTone="pink"
          loading={resolvedLoading}
          fetchPriority={secondaryFetchPriority}
          src={item.creativeSrc}
          alt={item.creativeAlt}
          width={item.drawingWidth ?? item.width}
          height={item.drawingHeight ?? item.height}
          onClick={onTileClick}
        />
      </div>
    </figure>
  );
}
