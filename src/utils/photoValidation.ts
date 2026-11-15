import { ORDER_CONFIG } from '../config/orderConfig';

export interface ValidatedPhoto {
  id: string;
  file: File;
  name: string;
  sizeBytes: number;
  width: number;
  height: number;
  previewUrl: string;
}

export interface RejectedPhoto {
  fileName: string;
  reason: string;
}

function loadImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      reject(new Error('Impossibile leggere il file immagine'));
    };
    img.src = url;
  });
}

export async function validatePhotoFiles(
  incomingFiles: File[],
  currentCount: number
): Promise<{ accepted: ValidatedPhoto[]; rejected: RejectedPhoto[] }> {
  const accepted: ValidatedPhoto[] = [];
  const rejected: RejectedPhoto[] = [];

  const remainingSlots = ORDER_CONFIG.maxPhotos - currentCount;
  const maxBytes = ORDER_CONFIG.maxFileSizeMb * 1024 * 1024;

  for (const file of incomingFiles) {
    if (accepted.length >= remainingSlots) {
      rejected.push({
        fileName: file.name,
        reason: `Limite massimo di ${ORDER_CONFIG.maxPhotos} foto raggiunto.`,
      });
      continue;
    }

    if (!ORDER_CONFIG.acceptedMimeTypes.includes(file.type)) {
      rejected.push({
        fileName: file.name,
        reason: `Formato non supportato. Usa solo ${ORDER_CONFIG.acceptedExtensionsLabel}.`,
      });
      continue;
    }

    if (file.size > maxBytes) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      rejected.push({
        fileName: file.name,
        reason: `File troppo pesante (${sizeMb} MB). Il limite è ${ORDER_CONFIG.maxFileSizeMb} MB per foto.`,
      });
      continue;
    }

    const previewUrl = URL.createObjectURL(file);
    try {
      const { width, height } = await loadImageDimensions(previewUrl);
      if (width < ORDER_CONFIG.minWidthPx || height < ORDER_CONFIG.minHeightPx) {
        URL.revokeObjectURL(previewUrl);
        rejected.push({
          fileName: file.name,
          reason: `Risoluzione troppo bassa (${width} × ${height} px). Servono almeno ${ORDER_CONFIG.minWidthPx} × ${ORDER_CONFIG.minHeightPx} px.`,
        });
        continue;
      }

      accepted.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        name: file.name,
        sizeBytes: file.size,
        width,
        height,
        previewUrl,
      });
    } catch {
      URL.revokeObjectURL(previewUrl);
      rejected.push({
        fileName: file.name,
        reason: 'File danneggiato o non leggibile come immagine.',
      });
    }
  }

  return { accepted, rejected };
}
