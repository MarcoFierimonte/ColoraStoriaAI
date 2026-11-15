import { useEffect } from 'react';
import { X } from 'lucide-react';
import { ORDER_CONFIG } from '../config/orderConfig';

export type LegalTopic = 'contatti' | 'privacy' | 'condizioni' | 'recesso';

interface LegalModalProps {
  topic: LegalTopic | null;
  onClose: () => void;
}

const LEGAL_CONTENT: Record<
  LegalTopic,
  { title: string; paragraphs: string[] }
> = {
  contatti: {
    title: 'Contatti',
    paragraphs: [
      `Per qualsiasi domanda relativa a un ordine o alla consegna del PDF puoi scriverci all’indirizzo ${ORDER_CONFIG.supportEmail}.`,
      'Rispondiamo dal lunedì al venerdì, dalle 9:00 alle 18:00, indicando sempre il codice ordine se disponibile.',
    ],
  },
  privacy: {
    title: 'Informativa sulla Privacy',
    paragraphs: [
      'Le fotografie caricate vengono elaborate esclusivamente per realizzare il libro da colorare personalizzato richiesto dal cliente.',
      'Tutte le immagini caricate vengono eliminate automaticamente dai nostri sistemi subito dopo la generazione e l’invio del file PDF.',
      'L’indirizzo email viene utilizzato unicamente per recapitare il libro PDF e l’eventuale assistenza legata all’ordine.',
    ],
  },
  condizioni: {
    title: 'Condizioni di Servizio',
    paragraphs: [
      'Il servizio fornisce un file digitale personalizzato in formato PDF pronto per la stampa, creato sulla base del tema scelto e delle fotografie fornite dal cliente.',
      'Il cliente dichiara di possedere i diritti d’uso delle immagini caricate e il consenso delle persone ritratte, in particolare dei minori eventualmente presenti.',
      `Ogni ordine prevede da ${ORDER_CONFIG.minPhotos} a ${ORDER_CONFIG.maxPhotos} fotografie nei formati ${ORDER_CONFIG.acceptedExtensionsLabel}.`,
    ],
  },
  recesso: {
    title: 'Informazioni sul diritto di recesso',
    paragraphs: [
      'Il libro da colorare viene realizzato su misura in formato digitale e consegnato via email subito dopo la conferma dell’ordine.',
      'Ai sensi della normativa vigente sui contenuti digitali personalizzati e a esecuzione immediata, con l’accettazione espressa al momento dell’ordine il cliente richiede l’avvio immediato della generazione e accetta la perdita del diritto di recesso.',
    ],
  },
};

export function LegalModal({ topic, onClose }: LegalModalProps) {
  useEffect(() => {
    if (!topic) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [topic, onClose]);

  if (!topic) return null;

  const content = LEGAL_CONTENT[topic];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white border border-zinc-200 p-6 sm:p-7 shadow-xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h3 id="legal-modal-title" className="text-xl font-semibold text-zinc-900">
            {content.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi finestra"
            className="w-10 h-10 -mr-2 -mt-2 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B83B1F]"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3 text-sm sm:text-base text-zinc-600 leading-relaxed">
          {content.paragraphs.map((text, idx) => (
            <p key={idx}>{text}</p>
          ))}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B83B1F]"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
