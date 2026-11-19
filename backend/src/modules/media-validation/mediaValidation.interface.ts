export type VerifiedImageMime =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/avif';

export interface ValidatedImageResult {
  mimeType: VerifiedImageMime;
  width: number;
  height: number;
}

export interface PreparedAiImage {
  buffer: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
}

export class ImageValidationError extends Error {
  readonly statusCode: number;
  readonly rawDetails?: string;

  constructor(message: string, statusCode = 400, rawDetails?: string) {
    super(message);
    this.name = 'ImageValidationError';
    this.statusCode = statusCode;
    this.rawDetails = rawDetails;
  }
}

export interface ServerMediaValidator {
  validate(buffer: Buffer, declaredMimeType?: string): ValidatedImageResult;
  prepareForAi(
    buffer: Buffer,
    mimeType: VerifiedImageMime
  ): Promise<PreparedAiImage>;
}
