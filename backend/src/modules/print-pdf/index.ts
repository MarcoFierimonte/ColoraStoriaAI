import { SharpPdfLibGenerator } from './implementations/sharpPdfLibGenerator.ts';
import type { PrintPdfGenerator } from './printPdf.interface.ts';

export {
  PrintPdfError,
  type GeneratedPrintPdfResult,
  type GeneratePrintPdfInput,
  type PrintPdfGenerator,
} from './printPdf.interface.ts';
export { SharpPdfLibGenerator } from './implementations/sharpPdfLibGenerator.ts';

export const printPdfGenerator: PrintPdfGenerator = new SharpPdfLibGenerator();
