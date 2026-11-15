import heroOriginalImg from '../assets/images/hero_foto_originale_1794739093633.jpg';
import heroColoringImg from '../assets/images/hero_pagina_colorare_1794739094382.jpg';
import openBookShowcaseImg from '../assets/images/libro_colorare_tavolo_1794739094767.jpg';

export interface OrderConfiguration {
  minPhotos: number;
  maxPhotos: number;
  maxFileSizeMb: number;
  minWidthPx: number;
  minHeightPx: number;
  acceptedMimeTypes: readonly string[];
  acceptedExtensionsLabel: string;
  coverTitleMaxLength: number;
  priceEur: number;
  estimatedDelivery: string;
  supportEmail: string;
}

export const ORDER_CONFIG: OrderConfiguration = {
  minPhotos: 10,
  maxPhotos: 15,
  maxFileSizeMb: 12,
  minWidthPx: 600,
  minHeightPx: 600,
  acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  acceptedExtensionsLabel: 'JPG, PNG o WebP',
  coverTitleMaxLength: 40,
  priceEur: 19,
  estimatedDelivery: '15–30 minuti',
  supportEmail: 'ciao@colorastoria.it',
};

/**
 * Segnaposto visivi centralizzati e facilmente sostituibili.
 */
export const VISUAL_PLACEHOLDERS = {
  heroOriginalPhoto: {
    src: heroOriginalImg,
    alt: 'Fotografia originale di un bambino sorridente in giardino alla luce naturale',
    label: 'Foto originale',
  },
  heroColoringPage: {
    src: heroColoringImg,
    alt: 'Pagina da colorare in bianco e nero con linee pulite tratta dalla foto',
    label: 'Pagina da colorare',
  },
  openBookShowcase: {
    src: openBookShowcaseImg,
    alt: 'Libro da colorare stampato e aperto su un tavolo chiaro accanto a matite colorate',
    label: 'PDF pronto da stampare in formato A4',
  },
};

export function formatPriceEur(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);
}
