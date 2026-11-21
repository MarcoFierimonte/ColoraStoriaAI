import type { ButtonHTMLAttributes, ChangeEvent, ReactNode } from 'react';

export type UiButtonVariant = 'primary' | 'secondary' | 'mint' | 'yellow';
export type UiButtonSize = 'default' | 'compact';

const VARIANT_CLASSES: Record<UiButtonVariant, string> = {
  primary: '',
  secondary: 'cs-btn-secondary',
  mint: 'cs-btn-mint',
  yellow: 'cs-btn-yellow',
};

const SIZE_CLASSES: Record<UiButtonSize, string> = {
  default: '',
  compact: 'cs-btn-compact',
};

export interface UiButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: UiButtonVariant;
  size?: UiButtonSize;
  children: ReactNode;
}

export function UiButton({
  variant = 'primary',
  size = 'default',
  className = '',
  type = 'button',
  children,
  ...props
}: UiButtonProps) {
  const classes = [
    'cs-btn',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}

export interface UiFileButtonProps {
  id?: string;
  accept?: string;
  variant?: UiButtonVariant;
  size?: UiButtonSize;
  disabled?: boolean;
  className?: string;
  onFileSelect: (file: File) => void;
  children: ReactNode;
}

export function UiFileButton({
  id,
  accept,
  variant = 'primary',
  size = 'default',
  disabled = false,
  className = '',
  onFileSelect,
  children,
}: UiFileButtonProps) {
  const classes = [
    'cs-btn',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    disabled ? 'opacity-60 pointer-events-none' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    // Reset value so picking the same file again still fires onChange.
    event.target.value = '';
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  return (
    <label className={classes}>
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={handleChange}
        className="sr-only"
      />
      <span>{children}</span>
    </label>
  );
}
