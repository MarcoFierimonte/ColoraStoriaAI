export const ACCEPTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AcceptedImageMimeType = (typeof ACCEPTED_IMAGE_MIME_TYPES)[number];

export const ACCEPTED_IMAGE_EXTENSIONS_LABEL = 'JPG, PNG o WebP';

export const MAX_UPLOAD_FILE_SIZE_MB = 12;
export const MAX_UPLOAD_FILE_BYTES = MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024;

export const MIN_PHOTO_DIMENSION_PX = 400;
export const MAX_PHOTO_DIMENSION_PX = 16000;

export const MIN_BOOK_PHOTOS = 10;
export const MAX_BOOK_PHOTOS = 15;
// Complete coloring book = up to 15 interior photo pages + 1 custom cover page
export const PROJECTED_BOOK_PAGES = 16;

export const COVER_TITLE_MAX_LENGTH = 40;
export const ORDER_PRICE_EUR = 19;
export const ORDER_ESTIMATED_DELIVERY = '15–30 minuti';
export const SUPPORT_EMAIL = 'ciao@colorastoria.it';

export const ALLOWED_THEME_IDS = [
  'pirati',
  'unicorni',
  'draghi',
  'spazio',
  'dinosauri',
  'principessa',
] as const;

export type ThemeId = (typeof ALLOWED_THEME_IDS)[number];

export function isAllowedThemeId(value: string): value is ThemeId {
  return (ALLOWED_THEME_IDS as readonly string[]).includes(value);
}

export const SUPPORTED_PROVIDER_IDS = ['gemini', 'openai'] as const;

export type ProviderId = (typeof SUPPORTED_PROVIDER_IDS)[number];
