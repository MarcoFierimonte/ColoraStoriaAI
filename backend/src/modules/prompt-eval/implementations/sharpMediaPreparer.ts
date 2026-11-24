import sharp from 'sharp';
import {
  PromptEvalError,
  type PreparedImagePayload,
  type PromptEvalMediaPreparer,
} from '../../../../../packages/prompt-eval-backend/src/index.ts';
import {
  ImageValidationError,
  type ServerMediaValidator,
} from '../../media-validation/index.ts';

const MAX_STORED_DATA_URL_CHARS = 650_000;

export class SharpPromptEvalMediaPreparer implements PromptEvalMediaPreparer {
  private readonly mediaValidator: ServerMediaValidator;

  constructor(mediaValidator: ServerMediaValidator) {
    this.mediaValidator = mediaValidator;
  }

  async prepareInputImage(
    rawBytes: Uint8Array,
    declaredMimeType: string
  ): Promise<PreparedImagePayload> {
    const buffer = Buffer.from(rawBytes);
    try {
      const verified = this.mediaValidator.validate(buffer, declaredMimeType);
      const prepared = await this.mediaValidator.prepareForAi(
        buffer,
        verified.mimeType
      );

      let thumbnailDataUrl: string | undefined;
      try {
        const thumbBuffer = await sharp(prepared.buffer)
          .resize({
            width: 240,
            height: 240,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 72 })
          .toBuffer();
        thumbnailDataUrl = `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`;
      } catch {
        thumbnailDataUrl = undefined;
      }

      return {
        bytes: prepared.buffer,
        mimeType: prepared.mimeType,
        width: prepared.width,
        height: prepared.height,
        thumbnailDataUrl,
      };
    } catch (error) {
      if (error instanceof ImageValidationError) {
        throw new PromptEvalError(
          error.message,
          error.statusCode,
          'invalid_image',
          error.rawDetails
        );
      }
      throw error;
    }
  }

  async prepareOutputForStorage(dataUrl: string): Promise<string> {
    if (dataUrl.length <= MAX_STORED_DATA_URL_CHARS) {
      return dataUrl;
    }

    const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i.exec(
      dataUrl.trim()
    );
    if (!match) {
      return dataUrl;
    }

    const rawBuf = Buffer.from(match[2], 'base64');
    const passes: Array<{ width: number; height: number; quality: number }> = [
      { width: 1400, height: 1800, quality: 86 },
      { width: 1024, height: 1400, quality: 76 },
      { width: 820, height: 1120, quality: 66 },
      { width: 640, height: 880, quality: 56 },
    ];

    let lastCompressed = dataUrl;
    for (const pass of passes) {
      const webpBuf = await sharp(rawBuf)
        .resize({
          width: pass.width,
          height: pass.height,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: pass.quality })
        .toBuffer();
      lastCompressed = `data:image/webp;base64,${webpBuf.toString('base64')}`;
      if (lastCompressed.length <= MAX_STORED_DATA_URL_CHARS) {
        return lastCompressed;
      }
    }

    return lastCompressed;
  }
}
