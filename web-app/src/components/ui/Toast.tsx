export interface UiToastProps {
  message: string | null;
}

export function UiToast({ message }: UiToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`cs-toast transition-opacity duration-200 ${
        message ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      {message ?? ''}
    </div>
  );
}
