import { ORDER_CONFIG } from '../config/orderConfig';
import type { ThemeId } from '../data/themes';
import type { ValidatedPhoto } from '../utils/photoValidation';

export interface OrderSubmissionPayload {
  themeId: ThemeId;
  themeName: string;
  coverTitle: string;
  photos: ValidatedPhoto[];
  email: string;
  rightsConfirmed: boolean;
  privacyAccepted: boolean;
  digitalWaiverAccepted: boolean;
}

export interface OrderConfirmationResult {
  orderId: string;
  createdAtIso: string;
  estimatedDelivery: string;
  totalEur: number;
  themeName: string;
  coverTitle: string;
  photoCount: number;
  email: string;
}

export class OrderSubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderSubmissionError';
  }
}

export async function submitBookOrder(
  payload: OrderSubmissionPayload,
  onProgress?: (statusText: string) => void
): Promise<OrderConfirmationResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new OrderSubmissionError(
      'Connessione internet assente. Controlla la rete e riprova: i tuoi dati e le foto sono ancora qui.'
    );
  }

  onProgress?.('Verifica delle foto e dei dati dell’ordine...');
  await new Promise((resolve) => window.setTimeout(resolve, 750));

  if (payload.photos.length < ORDER_CONFIG.minPhotos || payload.photos.length > ORDER_CONFIG.maxPhotos) {
    throw new OrderSubmissionError(
      `Il libro richiede tra ${ORDER_CONFIG.minPhotos} e ${ORDER_CONFIG.maxPhotos} foto.`
    );
  }

  onProgress?.('Conferma del pagamento e avvio della preparazione del PDF...');
  await new Promise((resolve) => window.setTimeout(resolve, 900));

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const year = new Date().getFullYear();

  return {
    orderId: `CS-${year}-${randomSuffix}`,
    createdAtIso: new Date().toISOString(),
    estimatedDelivery: ORDER_CONFIG.estimatedDelivery,
    totalEur: ORDER_CONFIG.priceEur,
    themeName: payload.themeName,
    coverTitle: payload.coverTitle.trim(),
    photoCount: payload.photos.length,
    email: payload.email.trim(),
  };
}
