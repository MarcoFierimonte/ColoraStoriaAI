import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import {
  PrintPdfError,
  SharpPdfLibGenerator,
} from '../backend/src/modules/print-pdf/index.ts';

const generator = new SharpPdfLibGenerator();

test('SharpPdfLibGenerator generates valid 1-up, 2-up, and 4-up A4 print PDFs', async () => {
  const samplePng = await sharp({
    create: {
      width: 900,
      height: 1200,
      channels: 3,
      background: { r: 248, g: 248, b: 248 },
    },
  })
    .png()
    .toBuffer();

  const dataUrl = `data:image/png;base64,${samplePng.toString('base64')}`;

  // 1-up: Portrait A4
  const pdf1 = await generator.generatePdf({ imageDataUrl: dataUrl, layout: '1-up' });
  assert.equal(pdf1.filename, 'colorastoria-stampa-1-up.pdf');
  assert.equal(pdf1.pdfBuffer.subarray(0, 5).toString('ascii'), '%PDF-');
  const doc1 = await PDFDocument.load(pdf1.pdfBuffer);
  assert.equal(doc1.getPageCount(), 1);
  const size1 = doc1.getPage(0).getSize();
  assert.ok(size1.height > size1.width, '1-up must be portrait A4');

  // 2-up: Landscape A4 (optimal for two 3:4 portrait pages side-by-side)
  const pdf2 = await generator.generatePdf({ imageDataUrl: dataUrl, layout: '2-up' });
  assert.equal(pdf2.filename, 'colorastoria-stampa-2-up.pdf');
  const doc2 = await PDFDocument.load(pdf2.pdfBuffer);
  assert.equal(doc2.getPageCount(), 1);
  const size2 = doc2.getPage(0).getSize();
  assert.ok(size2.width > size2.height, '2-up must be landscape A4');

  // 4-up: Portrait A4 2x2 grid
  const pdf4 = await generator.generatePdf({ imageDataUrl: dataUrl, layout: '4-up' });
  assert.equal(pdf4.filename, 'colorastoria-stampa-4-up.pdf');
  const doc4 = await PDFDocument.load(pdf4.pdfBuffer);
  assert.equal(doc4.getPageCount(), 1);
  const size4 = doc4.getPage(0).getSize();
  assert.ok(size4.height > size4.width, '4-up must be portrait A4');
});

test('SharpPdfLibGenerator supports SVG data URLs and rejects invalid payloads', async () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect width="300" height="400" fill="#fff"/><circle cx="150" cy="200" r="80" fill="none" stroke="#000" stroke-width="6"/></svg>';
  const svgUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

  const res = await generator.generatePdf({ imageDataUrl: svgUrl, layout: '1-up' });
  assert.equal(res.pdfBuffer.subarray(0, 5).toString('ascii'), '%PDF-');

  await assert.rejects(
    () => generator.generatePdf({ imageDataUrl: 'https://example.com/x.png', layout: '1-up' }),
    (err: unknown) => err instanceof PrintPdfError && err.statusCode === 400
  );
});
