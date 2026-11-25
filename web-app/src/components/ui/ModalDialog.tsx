import {
  useEffect,
  useId,
  useRef,
  type PointerEvent,
  type ReactNode,
} from 'react';

export interface ModalDialogProps {
  open: boolean;
  title: string;
  closeLabel?: string;
  size?: 'default' | 'examples';
  titleAs?: 'h1' | 'h2';
  closedByMode?: 'any' | 'closerequest' | 'none';
  scrollTopKey?: string | number;
  onRequestClose: () => void;
  children: ReactNode;
}

function isPointerOutsideDialog(
  event: PointerEvent<HTMLDialogElement>,
  dialog: HTMLDialogElement
): boolean {
  const rect = dialog.getBoundingClientRect();
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}

export function ModalDialog({
  open,
  title,
  closeLabel = 'Chiudi',
  size = 'default',
  titleAs = 'h2',
  closedByMode = 'any',
  scrollTopKey,
  onRequestClose,
  children,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedOutsideRef = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;
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

  const supportsClosedBy =
    typeof HTMLDialogElement !== 'undefined' &&
    'closedBy' in HTMLDialogElement.prototype;

  const handlePointerDown = (event: PointerEvent<HTMLDialogElement>) => {
    if (closedByMode !== 'any' || supportsClosedBy) {
      pressedOutsideRef.current = false;
      return;
    }
    const dialog = dialogRef.current;
    pressedOutsideRef.current = dialog
      ? isPointerOutsideDialog(event, dialog)
      : false;
  };

  const handlePointerUp = (event: PointerEvent<HTMLDialogElement>) => {
    const wasPressedOutside = pressedOutsideRef.current;
    pressedOutsideRef.current = false;
    if (closedByMode !== 'any' || supportsClosedBy || !wasPressedOutside) {
      return;
    }
    const dialog = dialogRef.current;
    if (dialog && isPointerOutsideDialog(event, dialog)) {
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
      closedby={closedByMode}
      className={dialogClassName}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (closedByMode !== 'none') {
          onRequestClose();
        }
      }}
      onClose={() => {
        if (dialogRef.current) {
          dialogRef.current.returnValue = '';
        }
        // Keep React state in sync when native closedby="any" or uncancelable Esc dismisses the modal.
        if (openRef.current) {
          onRequestClose();
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
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
