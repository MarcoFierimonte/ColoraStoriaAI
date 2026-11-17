import {
  ACCEPTED_IMAGE_EXTENSIONS_LABEL,
  ACCEPTED_IMAGE_MIME_TYPES,
  COVER_TITLE_MAX_LENGTH,
  MAX_BOOK_PHOTOS,
  MAX_UPLOAD_FILE_SIZE_MB,
  MIN_BOOK_PHOTOS,
  MIN_PHOTO_DIMENSION_PX,
  ORDER_ESTIMATED_DELIVERY,
  ORDER_PRICE_EUR,
  PROJECTED_BOOK_PAGES,
  SUPPORT_EMAIL,
} from '../../../shared/config/index.ts';
import heroOriginalImg from '../assets/images/hero_foto_originale_1794739093633.jpg';
import heroColoringImg from '../assets/images/hero_pagina_colorare_1794739094382.jpg';
import openBookShowcaseImg from '../assets/images/libro_colorare_tavolo_1794739094767.jpg';

export interface OrderConfiguration {
  minPhotos: number;
  maxPhotos: number;
  projectedBookPages: number;
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
  minPhotos: MIN_BOOK_PHOTOS,
  maxPhotos: MAX_BOOK_PHOTOS,
  projectedBookPages: PROJECTED_BOOK_PAGES,
  maxFileSizeMb: MAX_UPLOAD_FILE_SIZE_MB,
  minWidthPx: MIN_PHOTO_DIMENSION_PX,
  minHeightPx: MIN_PHOTO_DIMENSION_PX,
  acceptedMimeTypes: ACCEPTED_IMAGE_MIME_TYPES,
  acceptedExtensionsLabel: ACCEPTED_IMAGE_EXTENSIONS_LABEL,
  coverTitleMaxLength: COVER_TITLE_MAX_LENGTH,
  priceEur: ORDER_PRICE_EUR,
  estimatedDelivery: ORDER_ESTIMATED_DELIVERY,
  supportEmail: SUPPORT_EMAIL,
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
