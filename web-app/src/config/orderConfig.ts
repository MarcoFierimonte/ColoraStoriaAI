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
  RECOMMENDED_PHOTO_MIN_DIMENSION_PX,
  SUPPORT_EMAIL,
} from '../../../shared/config/index.ts';

export interface OrderConfiguration {
  minPhotos: number;
  maxPhotos: number;
  projectedBookPages: number;
  maxFileSizeMb: number;
  minWidthPx: number;
  minHeightPx: number;
  recommendedMinDimensionPx: number;
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
  recommendedMinDimensionPx: RECOMMENDED_PHOTO_MIN_DIMENSION_PX,
  acceptedMimeTypes: ACCEPTED_IMAGE_MIME_TYPES,
  acceptedExtensionsLabel: ACCEPTED_IMAGE_EXTENSIONS_LABEL,
  coverTitleMaxLength: COVER_TITLE_MAX_LENGTH,
  priceEur: ORDER_PRICE_EUR,
  estimatedDelivery: ORDER_ESTIMATED_DELIVERY,
  supportEmail: SUPPORT_EMAIL,
};

export function formatPriceEur(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);
}
