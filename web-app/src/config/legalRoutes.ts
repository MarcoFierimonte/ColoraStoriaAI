import { ORDER_CONFIG } from './orderConfig';

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
