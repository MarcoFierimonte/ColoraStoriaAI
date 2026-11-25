import { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  LEGAL_ROUTES,
  parseLegalSlugFromPathname,
  type LegalRouteSlug,
} from '../config/legalRoutes';

export { LEGAL_ROUTES, parseLegalSlugFromPathname, type LegalRouteSlug };

interface LegalPageProps {
  slug: LegalRouteSlug;
  onNavigateHome: () => void;
  onNavigateLegal: (slug: LegalRouteSlug) => void;
}

export function LegalPage({
  slug,
  onNavigateHome,
  onNavigateLegal,
}: LegalPageProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const content = LEGAL_ROUTES[slug];

  useEffect(() => {
    headingRef.current?.focus();
  }, [slug]);

  return (
    <section
      aria-labelledby="legal-page-title"
      className="py-10 sm:py-14"
    >
      <div className="cs-wrap max-w-3xl space-y-6">
        <div>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigateHome();
            }}
            className="cs-btn cs-btn-secondary cs-btn-compact inline-flex"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Torna alla pagina principale</span>
          </a>
        </div>

        <article className="cs-card p-6 sm:p-8 space-y-6">
          <h1
            id="legal-page-title"
            ref={headingRef}
            tabIndex={-1}
            className="text-3xl sm:text-4xl font-bold tracking-[-0.02em] text-[var(--cs-ink)] focus:outline-none"
          >
            {content.title}
          </h1>

          <div className="space-y-4 text-base text-[var(--cs-ink)] leading-relaxed">
            {content.paragraphs.map((text, idx) => (
              <p key={idx}>{text}</p>
            ))}
          </div>
        </article>

        <nav
          aria-label="Altre pagine informative"
          className="flex flex-wrap items-center gap-3 text-sm font-bold"
        >
          {(Object.keys(LEGAL_ROUTES) as LegalRouteSlug[]).map((itemSlug) => {
            const route = LEGAL_ROUTES[itemSlug];
            const isCurrent = itemSlug === slug;
            return (
              <a
                key={itemSlug}
                href={route.path}
                aria-current={isCurrent ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigateLegal(itemSlug);
                }}
                className={`cs-badge px-3 py-1 transition-transform hover:-translate-y-0.5 ${
                  isCurrent ? 'cs-badge-mint' : 'cs-badge-white'
                }`}
              >
                {route.label}
              </a>
            );
          })}
        </nav>
      </div>
    </section>
  );
}
