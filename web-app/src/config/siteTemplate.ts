import type { ColoringAgeGroup, ColoringStyleMode, PrintPdfLayout } from '../modules/coloring-api';

// Source photos from Wikimedia Commons:
// - CC BY-SA 4.0: doll-girl-photo.jpg (Nina Veiga — Boneca Waldorf)
// - CC BY 4.0: mountain-landscape-photo.jpg (Ergaki, Artists' Lake and pine trees, Sayan Mountains)
// - CC0: toy-boy-photo.jpg, cute-dog-photo.jpg, cute-cat-photo.jpg, toddler-playing-photo.jpg
import cuteCatCreative from '../assets/images/examples/cute-cat-creative.png';
import cuteCatFaithful from '../assets/images/examples/cute-cat-faithful.png';
import cuteCatPhoto from '../assets/images/examples/cute-cat-photo.jpg';
import cuteDogCreative from '../assets/images/examples/cute-dog-creative.png';
import cuteDogFaithful from '../assets/images/examples/cute-dog-faithful.png';
import cuteDogPhoto from '../assets/images/examples/cute-dog-photo.jpg';
import dollGirlCreative from '../assets/images/examples/doll-girl-creative.png';
import dollGirlFaithful from '../assets/images/examples/doll-girl-faithful.png';
import dollGirlPhoto from '../assets/images/examples/doll-girl-photo.jpg';
import mountainLandscapeCreative from '../assets/images/examples/mountain-landscape-creative.png';
import mountainLandscapeFaithful from '../assets/images/examples/mountain-landscape-faithful.png';
import mountainLandscapePhoto from '../assets/images/examples/mountain-landscape-photo.jpg';
import toddlerPlayingCreative from '../assets/images/examples/toddler-playing-creative.png';
import toddlerPlayingFaithful from '../assets/images/examples/toddler-playing-faithful.png';
import toddlerPlayingPhoto from '../assets/images/examples/toddler-playing-photo.jpg';
import toyBoyCreative from '../assets/images/examples/toy-boy-creative.png';
import toyBoyFaithful from '../assets/images/examples/toy-boy-faithful.png';
import toyBoyPhoto from '../assets/images/examples/toy-boy-photo.jpg';

export interface ExampleTrioSlot {
  id: string;
  title?: string;
  categoryLabel?: string;
  categoryTone?: CategoryTagItem['tone'];
  creativeThemeLabel?: string;
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
  photoWidth?: number;
  photoHeight?: number;
  drawingWidth?: number;
  drawingHeight?: number;
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
  examplesGallery: {
    id: 'esempi',
    title: 'Esempi reali',
    carouselAriaLabel: 'Galleria scorrevole di 6 esempi reali',
    prevLabel: 'Esempio precedente',
    nextLabel: 'Esempio successivo',
    sliderHint: 'Scorri di lato per tutti i 6 esempi · Tocca per ingrandire',
    zoomCloseLabel: 'Chiudi anteprima',
    items: [
      {
        id: 'cute-cat',
        title: 'Gattino',
        categoryLabel: 'Animali',
        categoryTone: 'yellow',
        creativeThemeLabel: 'Unicorni',
        ariaLabel: 'Esempio gattino: foto originale con pagina fedele e creativa a tema unicorni',
        photoLabel: 'Foto',
        faithfulLabel: 'Fedele',
        creativeLabel: 'Creativa · Unicorni',
        photoSrc: cuteCatPhoto,
        photoAlt: 'Foto reale di un piccolo gattino tigrato che guarda in camera',
        faithfulSrc: cuteCatFaithful,
        faithfulAlt: 'Pagina da colorare fedele del gattino tigrato in bianco e nero',
        creativeSrc: cuteCatCreative,
        creativeAlt: 'Pagina da colorare creativa con il gattino accanto a un unicorno e arcobaleno',
        photoWidth: 960,
        photoHeight: 720,
        drawingWidth: 720,
        drawingHeight: 960,
      },
      {
        id: 'cute-dog',
        title: 'Cagnolino',
        categoryLabel: 'Animali',
        categoryTone: 'yellow',
        creativeThemeLabel: 'Pirati',
        ariaLabel: 'Esempio cagnolino: foto originale con pagina fedele e creativa a tema pirati',
        photoLabel: 'Foto',
        faithfulLabel: 'Fedele',
        creativeLabel: 'Creativa · Pirati',
        photoSrc: cuteDogPhoto,
        photoAlt: 'Foto reale di un cucciolo di golden retriever sorridente tra i fiori viola',
        faithfulSrc: cuteDogFaithful,
        faithfulAlt: 'Pagina da colorare fedele del cucciolo di golden retriever nell’erba fiorita',
        creativeSrc: cuteDogCreative,
        creativeAlt: 'Pagina da colorare creativa con il cucciolo su una spiaggia pirata con veliero e pappagallo',
        photoWidth: 960,
        photoHeight: 720,
        drawingWidth: 720,
        drawingHeight: 960,
      },
      {
        id: 'toy-boy',
        title: 'Giocattolo',
        categoryLabel: 'Giocattoli',
        categoryTone: 'pink',
        creativeThemeLabel: 'Spazio',
        ariaLabel: 'Esempio giocattolo: foto reale con pagina fedele e creativa a tema spazio',
        photoLabel: 'Foto',
        faithfulLabel: 'Fedele',
        creativeLabel: 'Creativa · Spazio',
        photoSrc: toyBoyPhoto,
        photoAlt: 'Foto reale di una locomotiva giocattolo gialla sui binari',
        faithfulSrc: toyBoyFaithful,
        faithfulAlt: 'Pagina da colorare fedele della locomotiva giocattolo sui binari',
        creativeSrc: toyBoyCreative,
        creativeAlt: 'Pagina da colorare creativa con il trenino giocattolo nello spazio tra pianeti, razzo e alieno',
        photoWidth: 960,
        photoHeight: 720,
        drawingWidth: 720,
        drawingHeight: 960,
      },
      {
        id: 'doll-girl',
        title: 'Bambola',
        categoryLabel: 'Giocattoli',
        categoryTone: 'pink',
        creativeThemeLabel: 'Principessa',
        ariaLabel: 'Esempio bambola: foto reale con pagina fedele e creativa a tema principessa',
        photoLabel: 'Foto',
        faithfulLabel: 'Fedele',
        creativeLabel: 'Creativa · Principessa',
        photoSrc: dollGirlPhoto,
        photoAlt: 'Foto reale di una bambola di stoffa bionda con vestitino rosa a fiori e farfalline tra i capelli',
        faithfulSrc: dollGirlFaithful,
        faithfulAlt: 'Pagina da colorare fedele della bambola seduta sul tessuto con il vestito a fiori',
        creativeSrc: dollGirlCreative,
        creativeAlt: 'Pagina da colorare creativa con la bambola nel giardino reale davanti a un castello e una carrozza',
        photoWidth: 960,
        photoHeight: 720,
        drawingWidth: 720,
        drawingHeight: 960,
      },
      {
        id: 'mountain-landscape',
        title: 'Montagna con alberi',
        categoryLabel: 'Paesaggi',
        categoryTone: 'mint',
        creativeThemeLabel: 'Draghi',
        ariaLabel: 'Esempio paesaggio di montagna con alberi: foto reale con pagina fedele e creativa a tema draghi',
        photoLabel: 'Foto',
        faithfulLabel: 'Fedele',
        creativeLabel: 'Creativa · Draghi',
        photoSrc: mountainLandscapePhoto,
        photoAlt: 'Foto reale di un paesaggio alpino con pini, lago e cime montuose soleggiate',
        faithfulSrc: mountainLandscapeFaithful,
        faithfulAlt: 'Pagina da colorare fedele delle montagne con pini e riflesso sul lago',
        creativeSrc: mountainLandscapeCreative,
        creativeAlt: 'Pagina da colorare creativa del paesaggio montano con un drago amichevole, caverna di gemme e castello',
        photoWidth: 960,
        photoHeight: 720,
        drawingWidth: 720,
        drawingHeight: 960,
      },
      {
        id: 'toddler-playing',
        title: 'Bimbo di 2 anni che gioca',
        categoryLabel: 'Persone',
        categoryTone: 'lavender',
        creativeThemeLabel: 'Dinosauri',
        ariaLabel: 'Esempio bimbo che gioca: foto reale con pagina fedele e creativa a tema dinosauri',
        photoLabel: 'Foto',
        faithfulLabel: 'Fedele',
        creativeLabel: 'Creativa · Dinosauri',
        photoSrc: toddlerPlayingPhoto,
        photoAlt: 'Foto reale di un bambino piccolo con cappellino che gioca sulla sabbia con un camioncino colorato',
        faithfulSrc: toddlerPlayingFaithful,
        faithfulAlt: 'Pagina da colorare fedele del bambino con cappellino mentre gioca sulla spiaggia con il camioncino',
        creativeSrc: toddlerPlayingCreative,
        creativeAlt: 'Pagina da colorare creativa con il bambino che gioca con il camioncino tra dinosauri amichevoli e felci',
        photoWidth: 960,
        photoHeight: 720,
        drawingWidth: 720,
        drawingHeight: 960,
      },
    ] satisfies ExampleTrioSlot[],
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
    retrySamePhotoCta: 'Prova un altro stile con questa foto',
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
