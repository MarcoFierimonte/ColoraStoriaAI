import { useEffect, useId, useRef, useState } from 'react';
import {
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
import { SITE_TEMPLATE } from '../../config/siteTemplate';
import type { AdminServiceTab } from '../AdminPage';
import { LEGAL_ROUTES, type LegalRouteSlug } from '../LegalPage';
import { UiButton } from '../ui';

export interface NavbarProps {
  isAdmin?: boolean;
  userEmail?: string | null;
  isOnAdminPage?: boolean;
  onLogoClick: () => void;
  onStartClick: () => void;
  onNavigateAdmin?: (tab?: AdminServiceTab) => void;
  onNavigateLegal?: (slug: LegalRouteSlug) => void;
  onSignOut?: () => void;
}

export function Navbar({
  isAdmin = false,
  userEmail = null,
  isOnAdminPage = false,
  onLogoClick,
  onStartClick,
  onNavigateAdmin,
  onNavigateLegal,
  onSignOut,
}: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuPanelId = useId();

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
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
  }, [menuOpen]);

  const closeAndRun = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  return (
    <header
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
          href="/"
          className="cs-logo"
          onClick={(event) => {
            event.preventDefault();
            closeAndRun(onLogoClick);
          }}
        >
          {SITE_TEMPLATE.brand.name}
        </a>

        <div className="relative flex items-center gap-2.5" ref={menuRef}>
          <UiButton
            variant="secondary"
            size="compact"
            onClick={() => closeAndRun(onStartClick)}
          >
            {SITE_TEMPLATE.brand.navCtaLabel}
          </UiButton>

          <button
            type="button"
            aria-label={menuOpen ? 'Chiudi menu di navigazione' : 'Apri menu di navigazione'}
            aria-expanded={menuOpen}
            aria-controls={menuPanelId}
            onClick={() => setMenuOpen((prev) => !prev)}
            className={`inline-grid place-items-center h-[44px] w-[44px] rounded-[10px] border-[3px] border-[var(--cs-border)] text-[var(--cs-ink)] shadow-[3px_3px_0_var(--cs-border)] cursor-pointer transition-all active:translate-x-[3px] active:translate-y-[3px] active:shadow-none ${
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

          {menuOpen ? (
            <div
              id={menuPanelId}
              role="menu"
              aria-label="Menu navigazione e servizi Admin"
              className="absolute right-0 top-full mt-2 w-[min(320px,calc(100vw-32px))] rounded-[14px] border-[3px] border-[var(--cs-border)] bg-[var(--cs-surface)] p-3.5 shadow-[6px_6px_0_var(--cs-border)] space-y-3"
            >
              <div className="space-y-1.5">
                <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-[var(--cs-ink-muted)]">
                  App
                </p>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => closeAndRun(onLogoClick)}
                  className="w-full flex items-center gap-2.5 rounded-[8px] border-2 border-transparent px-2.5 py-2 text-left text-sm font-bold hover:border-[var(--cs-border)] hover:bg-[var(--cs-bg)] cursor-pointer"
                >
                  <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Home</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => closeAndRun(onStartClick)}
                  className="w-full flex items-center gap-2.5 rounded-[8px] border-2 border-transparent px-2.5 py-2 text-left text-sm font-bold hover:border-[var(--cs-border)] hover:bg-[var(--cs-bg)] cursor-pointer"
                >
                  <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Crea pagina da colorare</span>
                </button>
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
                        role="menuitem"
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
                        role="menuitem"
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
                        role="menuitem"
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
                          role="menuitem"
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
                      role="menuitem"
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
                      role="menuitem"
                      onClick={() => closeAndRun(() => onNavigateLegal(slug))}
                      className="underline decoration-2 underline-offset-2 hover:text-[var(--cs-ink)] cursor-pointer"
                    >
                      {route.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
