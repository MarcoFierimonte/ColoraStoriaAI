import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export interface UiToastProps {
  message: string | null;
  onDismiss?: () => void;
}

export function UiToast({ message, onDismiss }: UiToastProps) {
  const toastId = useId();
  const popoverRef = useRef<HTMLDivElement>(null);
  const supportsPopover =
    typeof HTMLElement !== 'undefined' &&
    Object.hasOwn(HTMLElement.prototype, 'popover');

  useEffect(() => {
    const el = popoverRef.current as
      | (HTMLDivElement & {
          showPopover?: () => void;
          hidePopover?: () => void;
        })
      | null;
    if (!el || !supportsPopover || typeof el.showPopover !== 'function') return;

    try {
      if (message) {
        if (!el.matches(':popover-open')) {
          el.showPopover();
        }
      } else if (el.matches(':popover-open')) {
        el.hidePopover();
      }
    } catch {
      // Ignore transient popover state transitions during unmount.
    }
  }, [message, supportsPopover]);

  return (
    <div role="region" aria-label="Notifiche">
      <div
        ref={popoverRef}
        id={toastId}
        popover="manual"
        role="status"
        aria-live="polite"
        hidden={!supportsPopover && !message}
        className={`cs-toast ${
          message ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <span>{message ?? ''}</span>
        {message && onDismiss ? (
          <button
            type="button"
            popoverTarget={toastId}
            popoverTargetAction="hide"
            onClick={onDismiss}
            aria-label="Chiudi notifica"
            className="ml-2 inline-grid place-items-center rounded-[6px] border-2 border-[var(--cs-border)] bg-white p-0.5 text-[var(--cs-ink)] cursor-pointer"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
