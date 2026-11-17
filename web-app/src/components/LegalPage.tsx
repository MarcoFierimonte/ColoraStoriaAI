import { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ORDER_CONFIG } from '../config/orderConfig';

export type LegalRouteSlug = 'contatti' | 'privacy' | 'condizioni' | 'recesso';

export const LEGAL_ROUTES: Record<
  LegalRouteSlug,
  { path: `/${LegalRouteSlug}`; label: string; title: string; paragraphs: string[] }
> = {
  contatti: {
    path: '/contatti',
    label: 'Contatti',
    title: 'Contatti',
    paragraphs: [
      `Per qualsiasi domanda relativa a un ordine o alla consegna del PDF puoi scriverci all’indirizzo ${ORDER_CONFIG.supportEmail}.`,
      'Rispondiamo dal lunedì al venerdì, dalle 9:00 alle 18:00, indicando sempre il codice ordine se disponibile.',
    ],
  },
  privacy: {
    path: '/privacy',
    label: 'Privacy',
    title: 'Informativa sulla Privacy',
    paragraphs: [
      'Le fotografie caricate vengono elaborate esclusivamente in memoria per creare il libro o la pagina da colorare richiesta dal cliente.',
      'Tutte le immagini caricate vengono scartate automaticamente al termine della richiesta e non vengono salvate né archiviate sui nostri server.',
      'I font tipografici sono ospitati direttamente sul nostro server: nessuna richiesta verso Google Fonts o reti pubblicitarie di terze parti viene effettuata durante la navigazione.',
      'L’eventuale indirizzo email inserito al momento dell’ordine viene utilizzato unicamente per recapitare il file PDF e fornire assistenza.',
    ],
  },
  condizioni: {
    path: '/condizioni',
    label: 'Condizioni',
    title: 'Condizioni di Servizio',
    paragraphs: [
      'Il servizio fornisce un file digitale personalizzato pronto per la stampa, creato sulla base del tema scelto e delle fotografie fornite dal cliente.',
      'Il cliente dichiara di possedere i diritti d’uso delle immagini caricate e il consenso delle persone ritratte, in particolare dei minori eventualmente presenti.',
      `Per il libro completo ogni ordine prevede da ${ORDER_CONFIG.minPhotos} a ${ORDER_CONFIG.maxPhotos} fotografie nei formati ${ORDER_CONFIG.acceptedExtensionsLabel}, con peso massimo ${ORDER_CONFIG.maxFileSizeMb} MB e risoluzione minima ${ORDER_CONFIG.minWidthPx}×${ORDER_CONFIG.minHeightPx} px.`,
    ],
  },
  recesso: {
    path: '/recesso',
    label: 'Informazioni sul recesso',
    title: 'Informazioni sul diritto di recesso',
    paragraphs: [
      'Il libro da colorare viene realizzato su misura in formato digitale e consegnato via email subito dopo la conferma dell’ordine.',
      'Ai sensi della normativa vigente sui contenuti digitali personalizzati e a esecuzione immediata, con l’accettazione espressa al momento dell’ordine il cliente richiede l’avvio immediato della generazione e accetta la perdita del diritto di recesso.',
    ],
  },
};

export function parseLegalSlugFromPathname(
  pathname: string
): LegalRouteSlug | null {
  const normalized = pathname.replace(/\/+$/, '').toLowerCase();
  switch (normalized) {
    case '/contatti':
      return 'contatti';
    case '/privacy':
      return 'privacy';
    case '/condizioni':
      return 'condizioni';
    case '/recesso':
      return 'recesso';
    default:
      return null;
  }
}

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
      className="py-12 sm:py-20"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigateHome();
            }}
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B83B1F]"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Torna alla pagina principale
          </a>
        </div>

        <article className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-10 space-y-6">
          <h1
            id="legal-page-title"
            ref={headingRef}
            tabIndex={-1}
            className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 focus:outline-none"
          >
            {content.title}
          </h1>

          <div className="space-y-4 text-base text-zinc-700 leading-relaxed">
            {content.paragraphs.map((text, idx) => (
              <p key={idx}>{text}</p>
            ))}
          </div>
        </article>

        <nav
          aria-label="Altre pagine informative"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-600"
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
                className={`underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B83B1F] ${
                  isCurrent
                    ? 'font-semibold text-zinc-900 underline'
                    : 'hover:text-zinc-900'
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
