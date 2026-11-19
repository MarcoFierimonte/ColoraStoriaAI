import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BufferImageValidator,
  ImageValidationError,
} from '../backend/src/modules/media-validation/index.ts';
import {
  MAX_PHOTO_DIMENSION_PX,
  MIN_PHOTO_DIMENSION_PX,
} from '../shared/config/index.ts';

function buildMinimalPng(width: number, height: number): Buffer {
  const buf = Buffer.alloc(24);
  // PNG signature
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  // IHDR chunk length & tag
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

function buildMinimalJpeg(width: number, height: number): Buffer {
  const buf = Buffer.alloc(13);
  // SOI
  buf[0] = 0xff;
  buf[1] = 0xd8;
  // SOF0
  buf[2] = 0xff;
  buf[3] = 0xc0;
  // Segment length (includes 2 bytes length + 7 payload bytes)
  buf.writeUInt16BE(9, 4);
  buf[6] = 8; // precision
  buf.writeUInt16BE(height, 7);
  buf.writeUInt16BE(width, 9);
  buf[11] = 3; // components
  buf[12] = 0xd9;
  return buf;
}

function buildMinimalWebpVp8x(width: number, height: number): Buffer {
  const buf = Buffer.alloc(30);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(22, 4);
  buf.write('WEBP', 8, 'ascii');
  buf.write('VP8X', 12, 'ascii');
  buf.writeUInt32LE(10, 16);
  const w = width - 1;
  const h = height - 1;
  buf[24] = w & 0xff;
  buf[25] = (w >> 8) & 0xff;
  buf[26] = (w >> 16) & 0xff;
  buf[27] = h & 0xff;
  buf[28] = (h >> 8) & 0xff;
  buf[29] = (h >> 16) & 0xff;
  return buf;
}

const validator = new BufferImageValidator();

test('accepts valid PNG, JPEG, and WebP buffers at minimum threshold', () => {
  const pngRes = validator.validate(
    buildMinimalPng(MIN_PHOTO_DIMENSION_PX, MIN_PHOTO_DIMENSION_PX),
    'image/png'
  );
  assert.equal(pngRes.mimeType, 'image/png');
  assert.equal(pngRes.width, MIN_PHOTO_DIMENSION_PX);
  assert.equal(pngRes.height, MIN_PHOTO_DIMENSION_PX);

  const jpgRes = validator.validate(buildMinimalJpeg(800, 600), 'image/jpeg');
  assert.equal(jpgRes.mimeType, 'image/jpeg');
  assert.equal(jpgRes.width, 800);
  assert.equal(jpgRes.height, 600);

  const webpRes = validator.validate(buildMinimalWebpVp8x(1024, 768), 'image/webp');
  assert.equal(webpRes.mimeType, 'image/webp');
  assert.equal(webpRes.width, 1024);
  assert.equal(webpRes.height, 768);
});

test('rejects invalid magic bytes (e.g. text/html spoofed as image/png)', () => {
  const fakeBuf = Buffer.from('<script>alert(1)</script>');
  assert.throws(
    () => validator.validate(fakeBuf, 'image/png'),
    (err: unknown) => err instanceof ImageValidationError && err.statusCode === 400
  );
});

test('rejects declared MIME mismatch against magic bytes', () => {
  const pngBuf = buildMinimalPng(600, 600);
  assert.throws(
    () => validator.validate(pngBuf, 'image/jpeg'),
    (err: unknown) => err instanceof ImageValidationError && err.statusCode === 400
  );
});

test('rejects images smaller than MIN_PHOTO_DIMENSION_PX', () => {
  const tinyPng = buildMinimalPng(MIN_PHOTO_DIMENSION_PX - 1, MIN_PHOTO_DIMENSION_PX);
  assert.throws(
    () => validator.validate(tinyPng, 'image/png'),
    (err: unknown) => err instanceof ImageValidationError && err.statusCode === 400
  );
});

test('rejects images larger than MAX_PHOTO_DIMENSION_PX', () => {
  const hugePng = buildMinimalPng(MAX_PHOTO_DIMENSION_PX + 1, 800);
  assert.throws(
    () => validator.validate(hugePng, 'image/png'),
    (err: unknown) => err instanceof ImageValidationError && err.statusCode === 400
  );
});

test('accepts valid AVIF ISOBMFF buffer and prepareForAi normalizes oversized input to <=1280px JPEG without EXIF', async () => {
  // Minimal ISOBMFF ftypavif + ispe box
  const avifBuf = Buffer.alloc(40);
  avifBuf.writeUInt32BE(20, 0);
  avifBuf.write('ftypavif', 4, 'ascii');
  avifBuf.writeUInt32BE(20, 20);
  avifBuf.write('ispe', 24, 'ascii');
  avifBuf.writeUInt32BE(0, 28);
  avifBuf.writeUInt32BE(900, 32);
  avifBuf.writeUInt32BE(1200, 36);

  const avifRes = validator.validate(avifBuf, 'image/avif');
  assert.equal(avifRes.mimeType, 'image/avif');
  assert.equal(avifRes.width, 900);
  assert.equal(avifRes.height, 1200);

  // Create real 2000x1500 PNG with sharp and normalize it for AI
  const { default: sharp } = await import('sharp');
  const bigPng = await sharp({
    create: {
      width: 2000,
      height: 1500,
      channels: 3,
      background: { r: 220, g: 180, b: 140 },
    },
  })
    .png()
    .toBuffer();

  const prepared = await validator.prepareForAi(bigPng, 'image/png');
  assert.equal(prepared.mimeType, 'image/jpeg');
  assert.equal(prepared.width, 1280);
  assert.equal(prepared.height, 960);
  const meta = await sharp(prepared.buffer).metadata();
  assert.equal(meta.exif, undefined);
});
