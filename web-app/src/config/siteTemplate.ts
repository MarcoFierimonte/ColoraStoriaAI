import type { ColoringAgeGroup, ColoringStyleMode, PrintPdfLayout } from '../modules/coloring-api';
import kittenCreative from '../assets/images/examples/kitten-creative.png';
import kittenFaithful from '../assets/images/examples/kitten-faithful.png';
import kittenPhoto from '../assets/images/examples/kitten-photo.jpg';

export interface ExampleTrioSlot {
  id: string;
  ariaLabel: string;
  photoLabel: string;
  faithfulLabel: string;
  creativeLabel: string;
  photoSrc?: string;
  photoAlt?: string;
  faithfulSrc?: string;
  faithfulAlt?: string;
  creativeSrc?: string;
  creativeAlt?: string;
  placeholderText?: string;
  width?: number;
  height?: number;
}

export interface CategoryTagItem {
  label: string;
  tone: 'yellow' | 'pink' | 'mint' | 'lavender';
}

export interface HowItWorksStepItem {
  number: string;
  title: string;
  description: string;
}

export interface ModeTemplateOption {
  id: ColoringStyleMode;
  label: string;
  description: string;
}

export interface AgeTemplateOption {
  id: ColoringAgeGroup;
  label: string;
}

export interface PdfLayoutTemplateOption {
  id: PrintPdfLayout;
  label: string;
}

export const SITE_TEMPLATE = {
  brand: {
    name: 'ColoraStoria',
    navCtaLabel: 'Inizia',
    footerTagline: 'Da foto a pagina A4 da colorare pronta per la stampa.',
  },
  hero: {
    titleStart: 'Una foto, una pagina ',
    titleHighlight: 'da colorare',
    subtitle: 'Carichi una foto, scegli come la vuoi e scarichi il PDF da stampare.',
    primaryCtaLabel: 'Inizia ora',
    examplesCtaLabel: 'Vedi altri esempi',
    showcase: {
      id: 'kitten-showcase',
      ariaLabel: 'Esempio di trasformazione da foto a pagina da colorare',
      photoLabel: 'Foto',
      faithfulLabel: 'Fedele',
      creativeLabel: 'Creativa',
      photoSrc: kittenPhoto,
      photoAlt: 'Foto originale di un gattino con grandi occhi',
      faithfulSrc: kittenFaithful,
      faithfulAlt: 'Versione fedele: i contorni del gattino in bianco e nero',
      creativeSrc: kittenCreative,
      creativeAlt: 'Versione creativa: lo stesso gattino con cornice e stelline',
      width: 480,
      height: 382,
    } satisfies ExampleTrioSlot,
  },
  categories: {
    title: 'Se lo vedi, lo puoi colorare.',
    tags: [
      { label: 'Animali', tone: 'yellow' },
      { label: 'Giocattoli', tone: 'pink' },
      { label: 'Paesaggi', tone: 'mint' },
      { label: 'Persone', tone: 'lavender' },
    ] satisfies CategoryTagItem[],
    note: 'Basta una foto nitida. Per le persone, chiedi sempre il permesso.',
  },
  howItWorks: {
    title: 'Come funziona',
    steps: [
      {
        number: '1',
        title: 'Carica la foto',
        description: 'Uno scatto nitido, con il soggetto ben visibile.',
      },
      {
        number: '2',
        title: 'Scegli lo stile',
        description: 'Fedele alla foto, oppure creativa con un ambiente fantasy.',
      },
      {
        number: '3',
        title: 'Scarica il PDF',
        description: 'Una pagina A4 pronta da stampare e colorare.',
      },
    ] satisfies HowItWorksStepItem[],
  },
  bottomCta: {
    title: 'Pronto a provare?',
    buttonLabel: 'Inizia ora',
    note: 'Nessun account da creare. Usa solo foto di cui hai i diritti.',
  },
  examplesDialog: {
    title: 'Altri esempi',
    closeLabel: 'Chiudi',
    items: [
      {
        id: 'example-slot-1',
        ariaLabel: 'Esempio 1',
        photoLabel: 'Foto',
        faithfulLabel: 'Fedele',
        creativeLabel: 'Creativa',
        placeholderText: 'Spazio per l’immagine',
      },
      {
        id: 'example-slot-2',
        ariaLabel: 'Esempio 2',
        photoLabel: 'Foto',
        faithfulLabel: 'Fedele',
        creativeLabel: 'Creativa',
        placeholderText: 'Spazio per l’immagine',
      },
      {
        id: 'example-slot-3',
        ariaLabel: 'Esempio 3',
        photoLabel: 'Foto',
        faithfulLabel: 'Fedele',
        creativeLabel: 'Creativa',
        placeholderText: 'Spazio per l’immagine',
      },
    ] satisfies ExampleTrioSlot[],
  },
  creator: {
    titleCreate: 'Crea la tua pagina',
    titleReady: 'La tua pagina è pronta',
    closeLabel: 'Chiudi',
    sheetAriaLabel: 'Anteprima della pagina A4 da colorare',
    emptyCanvasLabel: 'Qui comparirà la tua pagina da colorare',
    uploadHint: 'Animali, giocattoli, paesaggi o persone: meglio se nitida.',
    uploadCta: 'Carica la foto',
    changePhotoCta: 'Cambia la foto',
    samplesLabel: 'Oppure prova un esempio',
    modeLabel: 'Come la vuoi?',
    modeOptions: [
      {
        id: 'fedele',
        label: 'Fedele alla foto',
        description: 'Bianco e nero da colorare',
      },
      {
        id: 'creativa',
        label: 'Creativa',
        description: 'Un ambiente fantasy',
      },
    ] satisfies ModeTemplateOption[],
    themeLabel: 'Ambiente',
    ageLabel: 'Età di chi colora',
    ageOptions: [
      { id: '1-2', label: '1-2' },
      { id: '3-4', label: '3-4' },
      { id: '5-7', label: '5-7' },
      { id: '8+', label: '8+' },
    ] satisfies AgeTemplateOption[],
    defaultAgeGroup: '3-4' as ColoringAgeGroup,
    rightsLabel: 'Ho più di 18 anni e ho il diritto di usare questa foto.',
    generateCta: 'Crea la pagina',
    generatingCta: 'Sto disegnando…',
    pdfLayoutLabel: 'Formato stampa A4',
    pdfLayouts: [
      { id: '1-up', label: '1 pagina A4' },
      { id: '2-up', label: '2 su A4' },
      { id: '4-up', label: '4 su A4' },
    ] satisfies PdfLayoutTemplateOption[],
    downloadPdfCta: 'Scarica il PDF',
    exportingPdfCta: 'Preparo il PDF…',
    downloadPngCta: 'Scarica immagine PNG',
    resetCta: 'Crea un’altra pagina',
    closeConfirmTitle: 'Chiudere?',
    closeConfirmBody: 'Perdi la foto e le scelte fatte.',
    closeConfirmStay: 'Resta',
    closeConfirmLeave: 'Chiudi',
    inviteGateTitle: 'Accesso riservato agli invitati',
    inviteGateHint:
      'ColoraStoria è aperto in anteprima privata. Inserisci il tuo codice invito per caricare una foto e generare pagine.',
    inviteExhaustedPrefix:
      'Hai esaurito le generazioni disponibili per l’invito',
    inviteExhaustedHint:
      'Se hai ricevuto un nuovo codice invito puoi inserirlo qui sotto.',
    inviteInputLabel: 'Codice invito',
    inviteInputPlaceholder: 'es. MARCO-BETA',
    inviteUnlockCta: 'Sblocca accesso',
    inviteUnlockingCta: 'Verifica in corso…',
    inviteLogoutCta: 'Cambia invito',
  },
} as const;
