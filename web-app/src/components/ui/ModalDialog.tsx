import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';

export interface ModalDialogProps {
  open: boolean;
  title: string;
  closeLabel?: string;
  size?: 'default' | 'examples';
  titleAs?: 'h1' | 'h2';
  scrollTopKey?: string | number;
  onRequestClose: () => void;
  children: ReactNode;
}

export function ModalDialog({
  open,
  title,
  closeLabel = 'Chiudi',
  size = 'default',
  titleAs = 'h2',
  scrollTopKey,
  onRequestClose,
  children,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (open && dialogRef.current && scrollTopKey !== undefined) {
      dialogRef.current.scrollTop = 0;
    }
  }, [open, scrollTopKey]);

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) {
      onRequestClose();
    }
  };

  const Heading = titleAs;
  const dialogClassName = [
    'cs-dialog',
    size === 'examples' ? 'cs-dialog-examples' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <dialog
      ref={dialogRef}
      className={dialogClassName}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onRequestClose();
      }}
      onClick={handleBackdropClick}
    >
      <div className="min-h-full">
        <div className="cs-dialog-head">
          <Heading
            id={titleId}
            className="text-[1.55rem] font-bold leading-[1.1] tracking-[-0.02em]"
          >
            {title}
          </Heading>
          <button
            type="button"
            className="cs-close-btn"
            aria-label={closeLabel}
            onClick={onRequestClose}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M3 3l12 12M15 3L3 15" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
