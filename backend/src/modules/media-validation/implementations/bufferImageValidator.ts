import {
  MAX_PHOTO_DIMENSION_PX,
  MIN_PHOTO_DIMENSION_PX,
} from '../../../../../shared/config/index.ts';
import {
  ImageValidationError,
  type ServerMediaValidator,
  type ValidatedImageResult,
  type VerifiedImageMime,
} from '../mediaValidation.interface.ts';

const MIN_WIDTH_PX = MIN_PHOTO_DIMENSION_PX;
const MIN_HEIGHT_PX = MIN_PHOTO_DIMENSION_PX;
const MAX_DIMENSION_PX = MAX_PHOTO_DIMENSION_PX;

const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function detectMagicMime(buffer: Buffer): VerifiedImageMime | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

function parsePngDimensions(
  buffer: Buffer
): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  if (buffer.subarray(12, 16).toString('ascii') !== 'IHDR') return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

function parseJpegDimensions(
  buffer: Buffer
): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) break;
    while (offset < buffer.length && buffer[offset] === 0xff) {
      offset++;
    }
    if (offset >= buffer.length) break;
    const marker = buffer[offset];
    offset++;

    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 2 > buffer.length) break;

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) break;

    if (JPEG_SOF_MARKERS.has(marker)) {
      if (offset + 7 > buffer.length) break;
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      return { width, height };
    }

    offset += segmentLength;
  }
  return null;
}

function parseWebpDimensions(
  buffer: Buffer
): { width: number; height: number } | null {
  if (buffer.length < 30) return null;
  const chunkHeader = buffer.subarray(12, 16).toString('ascii');

  if (chunkHeader === 'VP8 ') {
    if (
      buffer[23] !== 0x9d ||
      buffer[24] !== 0x01 ||
      buffer[25] !== 0x2a
    ) {
      return null;
    }
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }

  if (chunkHeader === 'VP8L') {
    if (buffer[20] !== 0x2f) return null;
    const bits = buffer.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }

  if (chunkHeader === 'VP8X') {
    const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
    const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
    return { width, height };
  }

  return null;
}

function parseDimensions(
  buffer: Buffer,
  mimeType: VerifiedImageMime
): { width: number; height: number } | null {
  switch (mimeType) {
    case 'image/png':
      return parsePngDimensions(buffer);
    case 'image/jpeg':
      return parseJpegDimensions(buffer);
    case 'image/webp':
      return parseWebpDimensions(buffer);
  }
}

export class BufferImageValidator implements ServerMediaValidator {
  private readonly minWidth: number;
  private readonly minHeight: number;
  private readonly maxDimension: number;

  constructor(options?: {
    minWidth?: number;
    minHeight?: number;
    maxDimension?: number;
  }) {
    this.minWidth = options?.minWidth ?? MIN_WIDTH_PX;
    this.minHeight = options?.minHeight ?? MIN_HEIGHT_PX;
    this.maxDimension = options?.maxDimension ?? MAX_DIMENSION_PX;
  }

  validate(buffer: Buffer, declaredMimeType?: string): ValidatedImageResult {
    const detectedMime = detectMagicMime(buffer);
    if (!detectedMime) {
      throw new ImageValidationError(
        'Il file caricato non è un’immagine JPG, PNG o WebP valida.',
        400,
        `Magic bytes mismatch (declaredMime=${declaredMimeType ?? 'unknown'}, bytes=${buffer.subarray(0, 12).toString('hex')})`
      );
    }

    if (declaredMimeType && declaredMimeType !== detectedMime) {
      throw new ImageValidationError(
        'Il formato dichiarato della foto non corrisponde al file caricato.',
        400,
        `Declared MIME ${declaredMimeType} does not match magic bytes MIME ${detectedMime}`
      );
    }

    const dimensions = parseDimensions(buffer, detectedMime);
    if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
      throw new ImageValidationError(
        'Impossibile leggere le dimensioni dell’immagine caricata.',
        400,
        `Failed to parse dimensions for ${detectedMime}`
      );
    }

    if (
      dimensions.width < this.minWidth ||
      dimensions.height < this.minHeight
    ) {
      throw new ImageValidationError(
        `La foto è troppo piccola (${dimensions.width}×${dimensions.height} px). Serve almeno ${this.minWidth}×${this.minHeight} px.`,
        400,
        `Image below minimum resolution: ${dimensions.width}x${dimensions.height}`
      );
    }

    if (
      dimensions.width > this.maxDimension ||
      dimensions.height > this.maxDimension
    ) {
      throw new ImageValidationError(
        'La risoluzione della foto supera il limite massimo consentito.',
        400,
        `Image exceeds maximum resolution: ${dimensions.width}x${dimensions.height}`
      );
    }

    return {
      mimeType: detectedMime,
      width: dimensions.width,
      height: dimensions.height,
    };
  }
}
