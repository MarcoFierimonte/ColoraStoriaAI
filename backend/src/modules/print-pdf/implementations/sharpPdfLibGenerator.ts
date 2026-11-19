import { PDFDocument, rgb, type PDFPage } from 'pdf-lib';
import sharp from 'sharp';
import type { PrintPdfLayout } from '../../../../../shared/types/index.ts';
import {
  PrintPdfError,
  type GeneratePrintPdfInput,
  type GeneratedPrintPdfResult,
  type PrintPdfGenerator,
} from '../printPdf.interface.ts';

// A4 dimensions in PDF points (1 pt = 1/72 inch, 1 mm = 72 / 25.4 pt)
const MM_TO_PT = 72 / 25.4;
const A4_SHORT_PT = 210 * MM_TO_PT; // ~595.28 pt
const A4_LONG_PT = 297 * MM_TO_PT; // ~841.89 pt
const SAFE_MARGIN_PT = 12 * MM_TO_PT; // 12 mm safe home-printer margin (~34.02 pt)
const CELL_GAP_PT = 10 * MM_TO_PT; // 10 mm gap between copies (~28.35 pt)
const PRINT_DPI = 300;
const MAX_DECODED_IMAGE_BYTES = 16 * 1024 * 1024;

interface ParsedDataUrl {
  mimeType: string;
  buffer: Buffer;
}

function parseImageDataUrl(dataUrl: string): ParsedDataUrl {
  const trimmed = dataUrl.trim();
  const commaIdx = trimmed.indexOf(',');
  if (!trimmed.startsWith('data:image/') || commaIdx === -1) {
    throw new PrintPdfError(
      'Formato immagine non valido per la generazione del PDF.',
      400,
      'Missing data:image/* prefix or base64 separator'
    );
  }

  const meta = trimmed.slice('data:'.length, commaIdx);
  const payload = trimmed.slice(commaIdx + 1);
  const [mimeTypeRaw, ...params] = meta.split(';');
  const mimeType = mimeTypeRaw.toLowerCase();
  const isBase64 = params.some((p) => p.toLowerCase() === 'base64');

  const allowedMimes = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/avif',
    'image/svg+xml',
  ]);
  if (!allowedMimes.has(mimeType)) {
    throw new PrintPdfError(
      'Tipo di immagine non supportato per l’esportazione PDF.',
      400,
      `Unsupported image MIME in data URL: ${mimeType}`
    );
  }

  const buffer = isBase64
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');

  if (buffer.length === 0 || buffer.length > MAX_DECODED_IMAGE_BYTES) {
    throw new PrintPdfError(
      'Dimensione immagine non valida per la generazione del PDF.',
      400,
      `Decoded image byte length out of range: ${buffer.length}`
    );
  }

  return { mimeType, buffer };
}

interface LayoutGeometry {
  pageWidthPt: number;
  pageHeightPt: number;
  cols: number;
  rows: number;
  cellWidthPt: number;
  cellHeightPt: number;
}

function getLayoutGeometry(layout: PrintPdfLayout): LayoutGeometry {
  if (layout === '2-up') {
    // Landscape A4 places two 3:4 portrait coloring pages side-by-side utilizing >90% of paper area
    const pageWidthPt = A4_LONG_PT;
    const pageHeightPt = A4_SHORT_PT;
    const cellWidthPt =
      (pageWidthPt - 2 * SAFE_MARGIN_PT - CELL_GAP_PT) / 2;
    const cellHeightPt = pageHeightPt - 2 * SAFE_MARGIN_PT;
    return {
      pageWidthPt,
      pageHeightPt,
      cols: 2,
      rows: 1,
      cellWidthPt,
      cellHeightPt,
    };
  }

  const pageWidthPt = A4_SHORT_PT;
  const pageHeightPt = A4_LONG_PT;

  if (layout === '4-up') {
    const cellWidthPt =
      (pageWidthPt - 2 * SAFE_MARGIN_PT - CELL_GAP_PT) / 2;
    const cellHeightPt =
      (pageHeightPt - 2 * SAFE_MARGIN_PT - CELL_GAP_PT) / 2;
    return {
      pageWidthPt,
      pageHeightPt,
      cols: 2,
      rows: 2,
      cellWidthPt,
      cellHeightPt,
    };
  }

  // '1-up' full-page portrait A4
  return {
    pageWidthPt,
    pageHeightPt,
    cols: 1,
    rows: 1,
    cellWidthPt: pageWidthPt - 2 * SAFE_MARGIN_PT,
    cellHeightPt: pageHeightPt - 2 * SAFE_MARGIN_PT,
  };
}

function drawCutGuides(page: PDFPage, geometry: LayoutGeometry) {
  const guideColor = rgb(0.76, 0.76, 0.76);
  const { pageWidthPt, pageHeightPt, cols, rows } = geometry;

  if (cols === 2) {
    const midX = pageWidthPt / 2;
    page.drawLine({
      start: { x: midX, y: SAFE_MARGIN_PT },
      end: { x: midX, y: pageHeightPt - SAFE_MARGIN_PT },
      thickness: 0.5,
      color: guideColor,
      dashArray: [4, 4],
    });
  }

  if (rows === 2) {
    const midY = pageHeightPt / 2;
    page.drawLine({
      start: { x: SAFE_MARGIN_PT, y: midY },
      end: { x: pageWidthPt - SAFE_MARGIN_PT, y: midY },
      thickness: 0.5,
      color: guideColor,
      dashArray: [4, 4],
    });
  }
}

export class SharpPdfLibGenerator implements PrintPdfGenerator {
  async generatePdf(
    input: GeneratePrintPdfInput
  ): Promise<GeneratedPrintPdfResult> {
    const { mimeType, buffer } = parseImageDataUrl(input.imageDataUrl);
    const geometry = getLayoutGeometry(input.layout);

    // Exact 300 DPI target dimensions for the chosen cell geometry
    const targetWidthPx = Math.max(
      600,
      Math.round((geometry.cellWidthPt / 72) * PRINT_DPI)
    );
    const targetHeightPx = Math.max(
      600,
      Math.round((geometry.cellHeightPt / 72) * PRINT_DPI)
    );

    let masteredPng: Buffer;
    try {
      const pipeline =
        mimeType === 'image/svg+xml'
          ? sharp(buffer, { density: PRINT_DPI })
          : sharp(buffer);

      // Print Mastering pipeline:
      // 1. Flatten onto pure white (#FFFFFF)
      // 2. Convert to grayscale so printers use pure black ink instead of CMYK composite black
      // 3. Upscale smoothly with Lanczos3 to 300 DPI for the exact cell size
      // 4. Clean levels (linear 1.28, -42): forces >=92% light paper background to pure #FFFFFF and <=13% dark ink to #000000 while keeping anti-aliased facial details smooth
      // 5. Mild sharpen + lossless PNG
      masteredPng = await pipeline
        .flatten({ background: '#ffffff' })
        .grayscale()
        .resize({
          width: targetWidthPx,
          height: targetHeightPx,
          fit: 'inside',
          kernel: sharp.kernel.lanczos3,
        })
        .linear(1.28, -42)
        .sharpen({ sigma: 0.65 })
        .png({ compressionLevel: 9, palette: false })
        .toBuffer();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new PrintPdfError(
        'Impossibile ottimizzare il disegno per la stampa PDF.',
        400,
        `sharp print mastering failed: ${msg}`
      );
    }

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(`ColoraStoria - Stampa A4 (${input.layout})`);
    pdfDoc.setCreator('ColoraStoria Print Engine');
    pdfDoc.setProducer('ColoraStoria');

    const page = pdfDoc.addPage([geometry.pageWidthPt, geometry.pageHeightPt]);
    const embeddedImage = await pdfDoc.embedPng(masteredPng);

    // Compute aspect-fit dimensions inside a single cell
    const scale = Math.min(
      geometry.cellWidthPt / embeddedImage.width,
      geometry.cellHeightPt / embeddedImage.height
    );
    const drawWidth = embeddedImage.width * scale;
    const drawHeight = embeddedImage.height * scale;

    for (let row = 0; row < geometry.rows; row++) {
      for (let col = 0; col < geometry.cols; col++) {
        const cellX =
          SAFE_MARGIN_PT + col * (geometry.cellWidthPt + CELL_GAP_PT);
        // PDF origin (0,0) is bottom-left; row 0 is top row
        const cellY =
          geometry.pageHeightPt -
          SAFE_MARGIN_PT -
          (row + 1) * geometry.cellHeightPt -
          row * CELL_GAP_PT;

        const drawX = cellX + (geometry.cellWidthPt - drawWidth) / 2;
        const drawY = cellY + (geometry.cellHeightPt - drawHeight) / 2;

        page.drawImage(embeddedImage, {
          x: drawX,
          y: drawY,
          width: drawWidth,
          height: drawHeight,
        });
      }
    }

    drawCutGuides(page, geometry);

    const pdfBytes = await pdfDoc.save();
    return {
      pdfBuffer: Buffer.from(pdfBytes),
      filename: `colorastoria-stampa-${input.layout}.pdf`,
      layout: input.layout,
      pageWidthPt: geometry.pageWidthPt,
      pageHeightPt: geometry.pageHeightPt,
    };
  }
}
