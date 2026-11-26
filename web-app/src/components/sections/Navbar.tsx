import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  FlaskConical,
  Home,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  Ticket,
  X,
} from 'lucide-react';
import type { AdminServiceTab } from '../../config/adminRoutes';
import { DESIGN_V2_PATH } from '../../config/designRoutes';
import { LEGAL_ROUTES, type LegalRouteSlug } from '../../config/legalRoutes';
import { SITE_TEMPLATE } from '../../config/siteTemplate';
import { UiButton } from '../ui';

export interface NavbarProps {
  isAdmin?: boolean;
  userEmail?: string | null;
  isOnAdminPage?: boolean;
  isDesignV2?: boolean;
  onLogoClick: () => void;
  onStartClick: () => void;
  onToggleDesignVersion?: () => void;
  onNavigateAdmin?: (tab?: AdminServiceTab) => void;
  onNavigateLegal?: (slug: LegalRouteSlug) => void;
  onSignOut?: () => void;
}

export function Navbar({
  isAdmin = false,
  userEmail = null,
  isOnAdminPage = false,
  isDesignV2 = false,
  onLogoClick,
  onStartClick,
  onToggleDesignVersion,
  onNavigateAdmin,
  onNavigateLegal,
  onSignOut,
}: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuGroupRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const menuPanelId = useId();
  const supportsPopover =
    typeof HTMLElement !== 'undefined' &&
    Object.hasOwn(HTMLElement.prototype, 'popover');

  useEffect(() => {
    if (supportsPopover || !menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (
        menuGroupRef.current &&
        event.target instanceof Node &&
        !menuGroupRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen, supportsPopover]);

  const closeAndRun = (action: () => void) => {
    const popoverEl = popoverRef.current as
      | (HTMLDivElement & { hidePopover?: () => void })
      | null;
    if (popoverEl && supportsPopover && popoverEl.matches(':popover-open')) {
      popoverEl.hidePopover?.();
    }
    setMenuOpen(false);
    action();
  };

  return (
    <header
      style={
        {
          '--cs-header-max': isOnAdminPage
            ? '1220px'
            : isDesignV2
              ? '1120px'
              : '980px',
        } as CSSProperties
      }
      className={
        isOnAdminPage
          ? 'mx-auto max-w-[1220px] px-4 relative z-30'
          : 'cs-wrap relative z-30'
      }
    >
      <nav
        className="flex items-center justify-between gap-3 py-[14px]"
        aria-label="Principale"
      >
        <a
          href={isDesignV2 ? DESIGN_V2_PATH : '/'}
          className="cs-logo"
          onClick={(event) => {
            event.preventDefault();
            closeAndRun(onLogoClick);
          }}
        >
          {SITE_TEMPLATE.brand.name}
        </a>

        <div className="relative flex items-center gap-2.5" ref={menuGroupRef}>
          <UiButton
            variant="secondary"
            size="compact"
            onClick={() => closeAndRun(onStartClick)}
          >
            {SITE_TEMPLATE.brand.navCtaLabel}
          </UiButton>

          <button
            type="button"
            popoverTarget={menuPanelId}
            aria-label={
              menuOpen
                ? 'Chiudi menu di navigazione'
                : 'Apri menu di navigazione'
            }
            aria-expanded={menuOpen}
            aria-controls={menuPanelId}
            onClick={() => {
              if (!supportsPopover) {
                setMenuOpen((prev) => !prev);
              }
            }}
            className={`cs-nav-menu-trigger inline-grid place-items-center h-[44px] w-[44px] rounded-[10px] border-[3px] border-[var(--cs-border)] text-[var(--cs-ink)] shadow-[3px_3px_0_var(--cs-border)] cursor-pointer transition-[translate,box-shadow,background-color] active:[translate:3px_3px] active:shadow-none ${
              menuOpen || isOnAdminPage
                ? 'bg-[var(--cs-mint)]'
                : 'bg-[var(--cs-surface)] hover:bg-[var(--cs-yellow)]'
            }`}
          >
            {menuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>

          <div
            ref={popoverRef}
            id={menuPanelId}
            popover="auto"
            hidden={!supportsPopover && !menuOpen}
            aria-label="Navigazione e servizi Admin"
            onToggle={(event) => {
              setMenuOpen(event.newState === 'open');
            }}
            className="cs-nav-popover space-y-3"
          >
            <div className="space-y-1.5">
              <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-[var(--cs-ink-muted)]">
                App
              </p>
              <button
                type="button"
                onClick={() => closeAndRun(onLogoClick)}
                className="w-full flex items-center gap-2.5 rounded-[8px] border-2 border-transparent px-2.5 py-2 text-left text-sm font-bold hover:border-[var(--cs-border)] hover:bg-[var(--cs-bg)] cursor-pointer"
              >
                <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Home</span>
              </button>
              <button
                type="button"
                onClick={() => closeAndRun(onStartClick)}
                className="w-full flex items-center gap-2.5 rounded-[8px] border-2 border-transparent px-2.5 py-2 text-left text-sm font-bold hover:border-[var(--cs-border)] hover:bg-[var(--cs-bg)] cursor-pointer"
              >
                <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Crea pagina da colorare</span>
              </button>
              {onToggleDesignVersion ? (
                <button
                  type="button"
                  onClick={() => closeAndRun(onToggleDesignVersion)}
                  className="w-full flex items-center gap-2.5 rounded-[8px] border-2 border-transparent px-2.5 py-2 text-left text-sm font-bold hover:border-[var(--cs-border)] hover:bg-[var(--cs-bg)] cursor-pointer"
                >
                  <ArrowLeftRight
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {isDesignV2
                      ? 'Versione attuale (v1)'
                      : 'Prova Design UX (v2)'}
                  </span>
                </button>
              ) : null}
            </div>

            {onNavigateAdmin ? (
              <div className="border-t-2 border-[var(--cs-border)]/25 pt-3 space-y-1.5">
                <div className="flex items-center justify-between px-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--cs-ink-muted)]">
                    Console Admin
                  </p>
                  {isAdmin ? (
                    <span className="rounded-[6px] border border-[var(--cs-border)] bg-[var(--cs-mint)] px-1.5 py-0.5 text-[10px] font-bold">
                      Attivo
                    </span>
                  ) : null}
                </div>

                {isAdmin ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        closeAndRun(() => onNavigateAdmin('prompt-lab'))
                      }
                      className="w-full flex items-center gap-2.5 rounded-[8px] border-2 border-[var(--cs-border)] bg-[var(--cs-mint)]/55 px-2.5 py-2 text-left text-sm font-bold hover:bg-[var(--cs-mint)] cursor-pointer"
                    >
                      <FlaskConical
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span>Laboratorio Prompt &amp; Batch</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        closeAndRun(() => onNavigateAdmin('invites'))
                      }
                      className="w-full flex items-center gap-2.5 rounded-[8px] border-2 border-transparent px-2.5 py-2 text-left text-sm font-bold hover:border-[var(--cs-border)] hover:bg-[var(--cs-bg)] cursor-pointer"
                    >
                      <Ticket className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Gestione Inviti Beta</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        closeAndRun(() => onNavigateAdmin('telemetry'))
                      }
                      className="w-full flex items-center gap-2.5 rounded-[8px] border-2 border-transparent px-2.5 py-2 text-left text-sm font-bold hover:border-[var(--cs-border)] hover:bg-[var(--cs-bg)] cursor-pointer"
                    >
                      <BarChart3
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span>Telemetria &amp; Costi</span>
                    </button>
                    {userEmail ? (
                      <p className="px-2.5 pt-1 text-[11px] font-mono-num text-[var(--cs-ink-muted)] truncate">
                        {userEmail}
                      </p>
                    ) : null}
                    {onSignOut ? (
                      <button
                        type="button"
                        onClick={() => closeAndRun(onSignOut)}
                        className="w-full flex items-center gap-2.5 rounded-[8px] border-2 border-transparent px-2.5 py-1.5 text-left text-xs font-bold text-[var(--cs-danger-ink)] hover:border-[var(--cs-border)] hover:bg-[var(--cs-danger-bg)] cursor-pointer"
                      >
                        <LogOut
                          className="h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>Disconnetti Admin</span>
                      </button>
                    ) : null}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      closeAndRun(() => onNavigateAdmin('prompt-lab'))
                    }
                    className="w-full flex items-center gap-2.5 rounded-[8px] border-2 border-[var(--cs-border)] bg-[var(--cs-yellow)] px-2.5 py-2 text-left text-sm font-bold hover:bg-[var(--cs-mint)] cursor-pointer"
                  >
                    <ShieldCheck
                      className="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>Area Admin (Riservata)</span>
                  </button>
                )}
              </div>
            ) : null}

            {onNavigateLegal ? (
              <div className="border-t-2 border-[var(--cs-border)]/25 pt-2.5 flex flex-wrap gap-x-3 gap-y-1 px-2 text-xs font-bold text-[var(--cs-ink-muted)]">
                {(
                  Object.entries(LEGAL_ROUTES) as Array<
                    [LegalRouteSlug, (typeof LEGAL_ROUTES)[LegalRouteSlug]]
                  >
                ).map(([slug, route]) => (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => closeAndRun(() => onNavigateLegal(slug))}
                    className="underline decoration-2 underline-offset-2 hover:text-[var(--cs-ink)] cursor-pointer"
                  >
                    {route.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </nav>
    </header>
  );
}
