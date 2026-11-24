import { SITE_TEMPLATE } from '../../config/siteTemplate';
import { LEGAL_ROUTES, type LegalRouteSlug } from '../LegalPage';

export interface SiteFooterProps {
  isSigningIn?: boolean;
  isAdmin: boolean;
  userEmail: string | null;
  onNavigateHome: () => void;
  onNavigateLegal: (slug: LegalRouteSlug) => void;
  onNavigateAdmin?: () => void;
  onSignIn?: () => void;
  onSignOut: () => void;
}

export function SiteFooter({
  isSigningIn = false,
  isAdmin,
  userEmail,
  onNavigateHome,
  onNavigateLegal,
  onNavigateAdmin,
  onSignIn,
  onSignOut,
}: SiteFooterProps) {
  return (
    <footer className="border-t-[3px] border-[var(--cs-border)] bg-[var(--cs-surface)] py-7 text-[var(--cs-ink)]">
      <div className="cs-wrap flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <a
            href="/"
            className="cs-logo !text-[1rem]"
            onClick={(event) => {
              event.preventDefault();
              onNavigateHome();
            }}
          >
            {SITE_TEMPLATE.brand.name}
          </a>
          <p className="mt-2.5 text-sm font-medium text-[var(--cs-ink-muted)]">
            {SITE_TEMPLATE.brand.footerTagline}
          </p>
        </div>

        <nav
          aria-label="Informazioni legali"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold"
        >
          {(Object.entries(LEGAL_ROUTES) as Array<
            [LegalRouteSlug, (typeof LEGAL_ROUTES)[LegalRouteSlug]]
          >).map(([slug, route]) => (
            <a
              key={slug}
              href={route.path}
              onClick={(event) => {
                event.preventDefault();
                onNavigateLegal(slug);
              }}
              className="underline decoration-2 underline-offset-4 hover:text-[var(--cs-pink-strong)]"
            >
              {route.label}
            </a>
          ))}

          {isAdmin ? (
            <span className="inline-flex items-center gap-2 rounded-[8px] border-2 border-[var(--cs-border)] bg-[var(--cs-mint)] px-2.5 py-1 text-xs font-bold">
              {onNavigateAdmin ? (
                <a
                  href="/admin"
                  onClick={(event) => {
                    if (
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey ||
                      event.button !== 0
                    ) {
                      return;
                    }
                    event.preventDefault();
                    onNavigateAdmin();
                  }}
                  className="underline decoration-2 underline-offset-2 hover:text-[var(--cs-pink-strong)]"
                >
                  Console Admin{userEmail ? ` (${userEmail})` : ''}
                </a>
              ) : (
                <span>Admin{userEmail ? `: ${userEmail}` : ''}</span>
              )}
              <button
                type="button"
                onClick={onSignOut}
                className="underline decoration-2 underline-offset-2 hover:text-[var(--cs-danger-ink)] cursor-pointer"
              >
                Esci
              </button>
            </span>
          ) : onNavigateAdmin ? (
            <a
              href="/admin"
              onClick={(event) => {
                if (
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey ||
                  event.button !== 0
                ) {
                  return;
                }
                event.preventDefault();
                onNavigateAdmin();
              }}
              className="text-xs font-bold text-[var(--cs-ink-muted)] underline decoration-2 underline-offset-4 hover:text-[var(--cs-ink)]"
            >
              Area riservata
            </a>
          ) : onSignIn ? (
            <button
              type="button"
              disabled={isSigningIn}
              onClick={onSignIn}
              className="text-xs font-bold text-[var(--cs-ink-muted)] underline decoration-2 underline-offset-4 hover:text-[var(--cs-ink)] disabled:opacity-50 cursor-pointer"
            >
              {isSigningIn ? 'Accesso…' : 'Area riservata'}
            </button>
          ) : null}
        </nav>
      </div>
    </footer>
  );
}
