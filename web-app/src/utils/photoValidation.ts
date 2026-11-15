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

export async function validateSinglePhotoFile(
  file: File
): Promise<{ accepted?: ValidatedPhoto; rejected?: RejectedPhoto }> {
  const maxBytes = ORDER_CONFIG.maxFileSizeMb * 1024 * 1024;
  const minDim = 400;

  if (!ORDER_CONFIG.acceptedMimeTypes.includes(file.type)) {
    return {
      rejected: {
        fileName: file.name,
        reason: `Formato non supportato. Usa solo ${ORDER_CONFIG.acceptedExtensionsLabel}.`,
      },
    };
  }

  if (file.size > maxBytes) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      rejected: {
        fileName: file.name,
        reason: `File troppo pesante (${sizeMb} MB). Il limite è ${ORDER_CONFIG.maxFileSizeMb} MB.`,
      },
    };
  }

  const previewUrl = URL.createObjectURL(file);
  try {
    const { width, height } = await loadImageDimensions(previewUrl);
    if (width < minDim || height < minDim) {
      URL.revokeObjectURL(previewUrl);
      return {
        rejected: {
          fileName: file.name,
          reason: `Risoluzione troppo bassa (${width} × ${height} px). Servono almeno ${minDim} × ${minDim} px.`,
        },
      };
    }

    return {
      accepted: {
        id: `${file.name}-${file.size}-${Date.now()}`,
        file,
        name: file.name,
        sizeBytes: file.size,
        width,
        height,
        previewUrl,
      },
    };
  } catch {
    URL.revokeObjectURL(previewUrl);
    return {
      rejected: {
        fileName: file.name,
        reason: 'File danneggiato o non leggibile come immagine.',
      },
    };
  }
}
