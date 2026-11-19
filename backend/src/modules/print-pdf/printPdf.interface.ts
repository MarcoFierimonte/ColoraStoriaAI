import type { PrintPdfLayout } from '../../../../shared/types/index.ts';

export interface GeneratePrintPdfInput {
  imageDataUrl: string;
  layout: PrintPdfLayout;
}

export interface GeneratedPrintPdfResult {
  pdfBuffer: Buffer;
  filename: string;
  layout: PrintPdfLayout;
  pageWidthPt: number;
  pageHeightPt: number;
}

export class PrintPdfError extends Error {
  readonly statusCode: number;
  readonly rawDetails?: string;

  constructor(message: string, statusCode = 400, rawDetails?: string) {
    super(message);
    this.name = 'PrintPdfError';
    this.statusCode = statusCode;
    this.rawDetails = rawDetails;
  }
}

export interface PrintPdfGenerator {
  generatePdf(input: GeneratePrintPdfInput): Promise<GeneratedPrintPdfResult>;
}
