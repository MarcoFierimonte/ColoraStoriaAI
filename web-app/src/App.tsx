import { useEffect, useRef, useState } from 'react';
import { LogOut, ShieldCheck, X } from 'lucide-react';
import { HeroComparison } from './components/HeroComparison';
import { HowItWorks } from './components/HowItWorks';
import {
  LEGAL_ROUTES,
  LegalPage,
  parseLegalSlugFromPathname,
  type LegalRouteSlug,
} from './components/LegalPage';
import { PhotoGeneratorSection } from './components/PhotoGeneratorSection';
import { useAuth } from './modules/auth';

const HOME_TITLE = 'ColoraStoria — Le tue foto diventano un libro da colorare';

export default function App() {
  const {
    user,
    isAdmin,
    isSigningIn,
    authNotice,
    signInWithGoogle,
    signOutUser,
    clearAuthNotice,
  } = useAuth();

  const [legalSlug, setLegalSlug] = useState<LegalRouteSlug | null>(() =>
    typeof window !== 'undefined'
      ? parseLegalSlugFromPathname(window.location.pathname)
      : null
  );
  const [isGeneratorVisible, setIsGeneratorVisible] = useState(false);
  const [externalTrigger, setExternalTrigger] = useState(0);

  const generatorSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onPopState = () => {
      setLegalSlug(parseLegalSlugFromPathname(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (legalSlug) {
      document.title = `${LEGAL_ROUTES[legalSlug].title} — ColoraStoria`;
    } else {
      document.title = HOME_TITLE;
    }

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      const targetPath = legalSlug ? LEGAL_ROUTES[legalSlug].path : '/';
      canonical.setAttribute('href', `${window.location.origin}${targetPath}`);
    }
  }, [legalSlug]);

  useEffect(() => {
    if (legalSlug) {
      setIsGeneratorVisible(false);
      return;
    }
    const el = generatorSectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsGeneratorVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [legalSlug]);

  const navigateToPath = (path: string, hashId?: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
    const nextSlug = parseLegalSlugFromPathname(path);
    setLegalSlug(nextSlug);

    if (hashId && !nextSlug) {
      window.setTimeout(() => {
        document.getElementById(hashId)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 40);
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  const scrollToGenerator = () => {
    if (legalSlug) {
      navigateToPath('/', 'genera');
      return;
    }
    generatorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900 pb-20 md:pb-0">
      {/* Top Bar: 3 clean zones */}
      <header className="border-b border-zinc-200/80 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigateToPath('/');
            }}
            className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B83B1F]"
          >
            ColoraStoria
          </a>

          <nav
            aria-label="Navigazione principale"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600"
          >
            <a
              href="/#come-funziona"
              onClick={(e) => {
                e.preventDefault();
                navigateToPath('/', 'come-funziona');
              }}
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0"
            >
              Come funziona
            </a>
            <a
              href="/#genera"
              onClick={(e) => {
                e.preventDefault();
                scrollToGenerator();
              }}
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0"
            >
              Prova subito
            </a>
            <a
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                navigateToPath('/privacy');
              }}
              aria-current={legalSlug === 'privacy' ? 'page' : undefined}
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0"
            >
              Privacy
            </a>
          </nav>

          <div className="shrink-0">
            <a
              href="/#genera"
              onClick={(e) => {
                e.preventDefault();
                scrollToGenerator();
              }}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-[#B83B1F] hover:bg-[#9E3119] rounded-xl transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B83B1F]"
            >
              Crea il tuo disegno
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {legalSlug ? (
          <LegalPage
            slug={legalSlug}
            onNavigateHome={() => navigateToPath('/')}
            onNavigateLegal={(slug) => navigateToPath(LEGAL_ROUTES[slug].path)}
          />
        ) : (
          <>
            {/* 1. Hero Section */}
            <section className="py-12 sm:py-20 lg:py-24">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
                  <div className="lg:col-span-6 space-y-6">
                    <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-semibold tracking-tight text-zinc-900 leading-[1.1] text-balance">
                      Le tue foto diventano un libro da colorare
                    </h1>
                    <p className="text-base sm:text-lg text-zinc-600 leading-relaxed max-w-xl">
                      Scegli un mondo illustrato, carica una foto e prova subito la trasformazione in pagina da colorare pronta da stampare.
                    </p>

                    <div className="pt-2 flex flex-wrap items-center gap-4">
                      <a
                        href="#genera"
                        onClick={(e) => {
                          e.preventDefault();
                          scrollToGenerator();
                        }}
                        className="inline-flex items-center justify-center min-h-[48px] px-7 py-3.5 text-base font-semibold text-white bg-[#B83B1F] hover:bg-[#9E3119] rounded-xl transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B83B1F]"
                      >
                        Prova con una foto
                      </a>
                    </div>
                  </div>

                  <div className="lg:col-span-6">
                    <HeroComparison />
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Come funziona */}
            <HowItWorks />

            {/* 3. Prova dal vivo: caricamento immagine e generazione via backend API */}
            <section
              id="genera"
              ref={generatorSectionRef}
              aria-labelledby="genera-titolo"
              className="py-16 sm:py-24 border-t border-zinc-200/80"
            >
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-2xl mb-12 space-y-2">
                  <h2
                    id="genera-titolo"
                    className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 text-balance"
                  >
                    Trasforma la tua foto
                  </h2>
                  <p className="text-base text-zinc-600">
                    Carica un’immagine di prova, scegli il tema e genera subito la pagina da colorare tramite il nostro backend AI.
                  </p>
                </div>

                <PhotoGeneratorSection externalTrigger={externalTrigger} />
              </div>
            </section>

            {/* 4. Nota privacy breve */}
            <section
              id="nota-privacy"
              aria-label="Nota sulla privacy delle foto"
              className="py-10 border-t border-zinc-200/80 bg-[#FBFBF9]"
            >
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-start sm:items-center gap-3.5 max-w-3xl text-sm text-zinc-700 leading-relaxed">
                  <ShieldCheck
                    className="w-5 h-5 text-[#B83B1F] shrink-0 mt-0.5 sm:mt-0"
                    aria-hidden="true"
                  />
                  <p>
                    <strong className="font-semibold text-zinc-900">Riservatezza delle tue foto:</strong>{' '}
                    l’immagine caricata viene elaborata in memoria solo per creare il disegno e non viene salvata né archiviata sul server.
                  </p>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {authNotice && (
        <div
          role="status"
          className="border-t border-amber-200 bg-amber-50 py-3 px-4 sm:px-6 lg:px-8"
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 text-xs sm:text-sm text-amber-900">
            <span>{authNotice}</span>
            <button
              type="button"
              onClick={clearAuthNotice}
              aria-label="Chiudi avviso"
              className="p-1 rounded-md hover:bg-amber-100 text-amber-800 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* 5. Footer minimo con URL reali per le pagine legali */}
      <footer className="border-t border-zinc-200 bg-white py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigateToPath('/');
            }}
            className="font-display text-base font-semibold text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B83B1F]"
          >
            ColoraStoria
          </a>

          <nav
            aria-label="Informazioni legali e contatti"
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-600"
          >
            {(Object.keys(LEGAL_ROUTES) as LegalRouteSlug[]).map((slug) => {
              const route = LEGAL_ROUTES[slug];
              return (
                <a
                  key={slug}
                  href={route.path}
                  aria-current={legalSlug === slug ? 'page' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToPath(route.path);
                  }}
                  className="hover:text-zinc-900 underline-offset-4 hover:underline whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B83B1F]"
                >
                  {route.label}
                </a>
              );
            })}

            <span className="h-3.5 w-px bg-zinc-300 hidden sm:inline-block" aria-hidden="true" />

            {!user ? (
              <button
                type="button"
                disabled={isSigningIn}
                onClick={() => void signInWithGoogle()}
                className="text-xs text-zinc-500 hover:text-zinc-900 underline-offset-4 hover:underline cursor-pointer whitespace-nowrap disabled:opacity-60"
              >
                {isSigningIn ? 'Accesso...' : 'Area riservata'}
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 text-xs">
                {isAdmin && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 font-medium text-emerald-800">
                    Admin
                  </span>
                )}
                <span className="text-zinc-600 max-w-[180px] truncate">
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-900 underline-offset-4 hover:underline cursor-pointer whitespace-nowrap"
                >
                  <LogOut className="w-3 h-3" aria-hidden="true" />
                  Esci
                </button>
              </div>
            )}
          </nav>
        </div>
      </footer>

      {/* Mobile Sticky Primary Action Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xs border-t border-zinc-200 px-4 py-2.5">
        {!legalSlug && isGeneratorVisible ? (
          <button
            type="button"
            onClick={() => setExternalTrigger((c) => c + 1)}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#B83B1F] hover:bg-[#9E3119] text-white text-sm font-semibold text-center cursor-pointer"
          >
            Genera pagina da colorare
          </button>
        ) : (
          <button
            type="button"
            onClick={scrollToGenerator}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#B83B1F] hover:bg-[#9E3119] text-white text-sm font-semibold text-center cursor-pointer"
          >
            Prova con una foto
          </button>
        )}
      </div>
    </div>
  );
}
