import type { ReactNode } from 'react';
import type { ExampleTrioSlot } from '../../config/siteTemplate';
import { UiBadge } from '../ui';

export interface ExampleTrioProps {
  item: ExampleTrioSlot;
  footerSlot?: ReactNode;
  className?: string;
}

interface TrioTileProps {
  badgeLabel: string;
  badgeTone: 'yellow' | 'mint' | 'pink';
  src?: string;
  alt?: string;
  placeholderText?: string;
  width?: number;
  height?: number;
}

function TrioTile({
  badgeLabel,
  badgeTone,
  src,
  alt,
  placeholderText = 'Spazio per l’immagine',
  width,
  height,
}: TrioTileProps) {
  if (!src) {
    return (
      <div className="cs-tile cs-tile-ph">
        <UiBadge tone={badgeTone} className="absolute left-2 top-2">
          {badgeLabel}
        </UiBadge>
        <span className="text-[0.8rem] opacity-60">{placeholderText}</span>
      </div>
    );
  }

  return (
    <div className="cs-tile">
      <img
        src={src}
        alt={alt ?? badgeLabel}
        width={width}
        height={height}
        className="block h-auto w-full"
      />
      <UiBadge tone={badgeTone} className="absolute left-2 top-2">
        {badgeLabel}
      </UiBadge>
    </div>
  );
}

export function ExampleTrio({
  item,
  footerSlot,
  className = '',
}: ExampleTrioProps) {
  return (
    <figure
      className={`cs-trio ${className}`.trim()}
      aria-label={item.ariaLabel}
    >
      <TrioTile
        badgeLabel={item.photoLabel}
        badgeTone="yellow"
        src={item.photoSrc}
        alt={item.photoAlt}
        placeholderText={item.placeholderText}
        width={item.width}
        height={item.height}
      />
      <div className="text-center text-[1.6rem] font-bold leading-none" aria-hidden="true">
        &#8595;
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TrioTile
          badgeLabel={item.faithfulLabel}
          badgeTone="mint"
          src={item.faithfulSrc}
          alt={item.faithfulAlt}
          placeholderText={item.placeholderText}
          width={item.width}
          height={item.height}
        />
        <TrioTile
          badgeLabel={item.creativeLabel}
          badgeTone="pink"
          src={item.creativeSrc}
          alt={item.creativeAlt}
          placeholderText={item.placeholderText}
          width={item.width}
          height={item.height}
        />
      </div>
      {footerSlot}
    </figure>
  );
}
