import type { ReactNode } from 'react';
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
  footerSlot?: ReactNode;
  className?: string;
  loading?: 'eager' | 'lazy';
  priority?: 'lcp' | 'hidden-slide' | 'default';
  fullWidth?: boolean;
  onTileClick?: (tile: ExampleTilePreview) => void;
}

interface TrioTileProps {
  badgeLabel: string;
  badgeTone: 'yellow' | 'mint' | 'pink';
  aspectClass: 'aspect-[4/3]' | 'aspect-[3/4]';
  fitClass: 'object-cover' | 'object-contain bg-white';
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low';
  src?: string;
  alt?: string;
  placeholderText?: string;
  width?: number;
  height?: number;
  onClick?: (tile: ExampleTilePreview) => void;
}

function TrioTile({
  badgeLabel,
  badgeTone,
  aspectClass,
  fitClass,
  loading,
  fetchPriority,
  src,
  alt,
  placeholderText = 'Spazio per l’immagine',
  width,
  height,
  onClick,
}: TrioTileProps) {
  if (!src) {
    return (
      <div className="cs-tile cs-tile-ph">
        <UiBadge tone={badgeTone} className="pointer-events-none absolute left-2 top-2">
          {badgeLabel}
        </UiBadge>
        <span className="text-[0.8rem] opacity-60">{placeholderText}</span>
      </div>
    );
  }

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
      className={`block w-full ${aspectClass} ${fitClass}`}
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
          className="block w-full cursor-zoom-in text-left focus-visible:outline-[3px] focus-visible:outline-[var(--cs-pink-strong)] focus-visible:outline-offset-[-3px]"
        >
          {imgElement}
        </button>
      ) : (
        imgElement
      )}
      <UiBadge tone={badgeTone} className="pointer-events-none absolute left-2 top-2">
        {badgeLabel}
      </UiBadge>
    </div>
  );
}

export function ExampleTrio({
  item,
  footerSlot,
  className = '',
  loading = 'lazy',
  priority = 'default',
  fullWidth = false,
  onTileClick,
}: ExampleTrioProps) {
  const figureClassName = [
    'cs-trio',
    fullWidth ? 'cs-trio-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const resolvedLoading: 'eager' | 'lazy' | undefined =
    priority === 'lcp'
      ? undefined
      : priority === 'hidden-slide'
        ? 'lazy'
        : loading;
  const primaryFetchPriority: 'high' | 'low' | undefined =
    priority === 'lcp'
      ? 'high'
      : priority === 'hidden-slide'
        ? 'low'
        : undefined;
  const secondaryFetchPriority: 'low' | undefined =
    priority === 'hidden-slide' ? 'low' : undefined;

  return (
    <figure className={figureClassName} aria-label={item.ariaLabel}>
      <TrioTile
        badgeLabel={item.photoLabel}
        badgeTone="yellow"
        aspectClass="aspect-[4/3]"
        fitClass="object-cover"
        loading={resolvedLoading}
        fetchPriority={primaryFetchPriority}
        src={item.photoSrc}
        alt={item.photoAlt}
        placeholderText={item.placeholderText}
        width={item.photoWidth ?? item.width}
        height={item.photoHeight ?? item.height}
        onClick={onTileClick}
      />
      <div
        className="text-center text-[1.6rem] font-bold leading-none"
        aria-hidden="true"
      >
        &#8595;
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TrioTile
          badgeLabel={item.faithfulLabel}
          badgeTone="mint"
          aspectClass="aspect-[3/4]"
          fitClass="object-contain bg-white"
          loading={resolvedLoading}
          fetchPriority={secondaryFetchPriority}
          src={item.faithfulSrc}
          alt={item.faithfulAlt}
          placeholderText={item.placeholderText}
          width={item.drawingWidth ?? item.width}
          height={item.drawingHeight ?? item.height}
          onClick={onTileClick}
        />
        <TrioTile
          badgeLabel={item.creativeLabel}
          badgeTone="pink"
          aspectClass="aspect-[3/4]"
          fitClass="object-contain bg-white"
          loading={resolvedLoading}
          fetchPriority={secondaryFetchPriority}
          src={item.creativeSrc}
          alt={item.creativeAlt}
          placeholderText={item.placeholderText}
          width={item.drawingWidth ?? item.width}
          height={item.drawingHeight ?? item.height}
          onClick={onTileClick}
        />
      </div>
      {footerSlot}
    </figure>
  );
}
