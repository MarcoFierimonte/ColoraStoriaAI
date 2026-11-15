import { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { HeroComparison } from './components/HeroComparison';
import { HowItWorks } from './components/HowItWorks';
import { PhotoGeneratorSection } from './components/PhotoGeneratorSection';
import { LegalModal, type LegalTopic } from './components/LegalModal';

export default function App() {
  const [activeLegalTopic, setActiveLegalTopic] = useState<LegalTopic | null>(null);
  const [isGeneratorVisible, setIsGeneratorVisible] = useState(false);
  const [externalTrigger, setExternalTrigger] = useState(0);

  const generatorSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
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
  }, []);

  const scrollToGenerator = () => {
    generatorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900 pb-20 md:pb-0">
      {/* Top Bar: 3 clean zones */}
      <header className="border-b border-zinc-200/80 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#"
            className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B83B1F]"
          >
            ColoraStoria
          </a>

          <nav
            aria-label="Navigazione principale"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600"
          >
            <a
              href="#come-funziona"
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0"
            >
              Come funziona
            </a>
            <a
              href="#genera"
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0"
            >
              Prova subito
            </a>
            <a
              href="#nota-privacy"
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0"
            >
              Privacy
            </a>
          </nav>

          <div className="shrink-0">
            <a
              href="#genera"
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
      </main>

      {/* 5. Footer minimo */}
      <footer className="border-t border-zinc-200 bg-white py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <span className="font-display text-base font-semibold text-zinc-900">
            ColoraStoria
          </span>

          <nav
            aria-label="Informazioni legali e contatti"
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-600"
          >
            <button
              type="button"
              onClick={() => setActiveLegalTopic('contatti')}
              className="hover:text-zinc-900 underline-offset-4 hover:underline cursor-pointer whitespace-nowrap"
            >
              Contatti
            </button>
            <button
              type="button"
              onClick={() => setActiveLegalTopic('privacy')}
              className="hover:text-zinc-900 underline-offset-4 hover:underline cursor-pointer whitespace-nowrap"
            >
              Privacy
            </button>
            <button
              type="button"
              onClick={() => setActiveLegalTopic('condizioni')}
              className="hover:text-zinc-900 underline-offset-4 hover:underline cursor-pointer whitespace-nowrap"
            >
              Condizioni
            </button>
            <button
              type="button"
              onClick={() => setActiveLegalTopic('recesso')}
              className="hover:text-zinc-900 underline-offset-4 hover:underline cursor-pointer whitespace-nowrap"
            >
              Informazioni sul recesso
            </button>
          </nav>
        </div>
      </footer>

      {/* Mobile Sticky Primary Action Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xs border-t border-zinc-200 px-4 py-2.5">
        {isGeneratorVisible ? (
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

      <LegalModal
        topic={activeLegalTopic}
        onClose={() => setActiveLegalTopic(null)}
      />
    </div>
  );
}
