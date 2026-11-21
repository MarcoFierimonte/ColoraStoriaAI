import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface UiChipProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> {
  pressed?: boolean;
  subtitle?: string;
  centered?: boolean;
  children: ReactNode;
}

export function UiChip({
  pressed = false,
  subtitle,
  centered = false,
  className = '',
  type = 'button',
  children,
  ...props
}: UiChipProps) {
  const classes = [
    'cs-chip',
    centered ? '!text-center !px-1 !py-2' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} aria-pressed={pressed} {...props}>
      <span>{children}</span>
      {subtitle ? (
        <small className="mt-0.5 block text-[0.78rem] font-normal">
          {subtitle}
        </small>
      ) : null}
    </button>
  );
}
