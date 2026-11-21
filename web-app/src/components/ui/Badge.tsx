import type { HTMLAttributes, ReactNode } from 'react';

export type UiBadgeTone =
  | 'yellow'
  | 'mint'
  | 'pink'
  | 'lavender'
  | 'blue'
  | 'white';

const TONE_CLASSES: Record<UiBadgeTone, string> = {
  yellow: '',
  mint: 'cs-badge-mint',
  pink: 'cs-badge-pink',
  lavender: 'cs-badge-lavender',
  blue: 'cs-badge-blue',
  white: 'cs-badge-white',
};

export interface UiBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: UiBadgeTone;
  children: ReactNode;
}

export function UiBadge({
  tone = 'yellow',
  className = '',
  children,
  ...props
}: UiBadgeProps) {
  const classes = ['cs-badge', TONE_CLASSES[tone], className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}
