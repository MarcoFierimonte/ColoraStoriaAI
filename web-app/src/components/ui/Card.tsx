import type { HTMLAttributes, ReactNode } from 'react';

export type UiCardTone =
  | 'surface'
  | 'yellow'
  | 'pink'
  | 'mint'
  | 'lavender'
  | 'sky'
  | 'danger';

const TONE_CLASSES: Record<UiCardTone, string> = {
  surface: '',
  yellow: '!bg-[var(--cs-yellow)]',
  pink: '!bg-[var(--cs-pink)]',
  mint: '!bg-[var(--cs-mint)]',
  lavender: '!bg-[var(--cs-lavender)]',
  sky: '!bg-[var(--cs-sky)]',
  danger: '!bg-[var(--cs-danger-bg)] text-[var(--cs-danger-ink)]',
};

export interface UiCardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: UiCardTone;
  children: ReactNode;
}

export function UiCard({
  tone = 'surface',
  className = '',
  children,
  ...props
}: UiCardProps) {
  const classes = ['cs-card', TONE_CLASSES[tone], className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
