import { useState } from 'react';
import { BookOpen, ImagePlus, Printer } from 'lucide-react';
import { VISUAL_PLACEHOLDERS } from '../config/orderConfig';

const STEPS = [
  {
    number: '01',
    title: 'Scegli il mondo',
    description:
      'Seleziona uno dei sei mondi illustrati in stile libro da colorare.',
    Icon: BookOpen,
  },
  {
    number: '02',
    title: 'Carica una foto',
    description:
      'Inserisci una foto nitida e luminosa con il volto ben visibile.',
    Icon: ImagePlus,
  },
  {
    number: '03',
    title: 'Ottieni il disegno pronto',
    description:
      'Il server trasforma la foto in una pagina in bianco e nero pronta da scaricare e stampare.',
    Icon: Printer,
  },
];

export function HowItWorks() {
  const [imgError, setImgError] = useState(false);

  return (
    <section
      id="come-funziona"
      aria-labelledby="come-funziona-titolo"
      className="py-16 sm:py-24 border-t border-zinc-200/80"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-7 space-y-10">
            <div className="max-w-xl">
              <h2
                id="come-funziona-titolo"
                className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 text-balance"
              >
                Come funziona
              </h2>
              <p className="mt-3 text-base sm:text-lg text-zinc-600 leading-relaxed">
                Tre passaggi semplici per trasformare una fotografia in una pagina pronta per matite e pennarelli.
              </p>
            </div>

            <ol className="divide-y divide-zinc-200/80 border-t border-b border-zinc-200/80">
              {STEPS.map(({ number, title, description, Icon }) => (
                <li key={number} className="py-6 flex items-start gap-5">
                  <div className="w-11 h-11 rounded-xl bg-[#FDF1ED] text-[#B83B1F] flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2.5">
                      <span className="font-mono-num text-xs text-zinc-500">{number}</span>
                      <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
                    </div>
                    <p className="text-sm sm:text-base text-zinc-600 leading-relaxed max-w-lg">
                      {description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="lg:col-span-5">
            <figure className="space-y-3">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-50">
                {!imgError ? (
                  <img
                    src={VISUAL_PLACEHOLDERS.openBookShowcase.src}
                    alt={VISUAL_PLACEHOLDERS.openBookShowcase.alt}
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm p-6 text-center">
                    {VISUAL_PLACEHOLDERS.openBookShowcase.label}
                  </div>
                )}
              </div>
              <figcaption className="text-xs text-zinc-600">
                {VISUAL_PLACEHOLDERS.openBookShowcase.label}
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
