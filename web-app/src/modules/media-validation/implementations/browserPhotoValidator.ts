import { ORDER_CONFIG } from '../../../config/orderConfig';
import type {
  MediaValidator,
  PhotoValidationResult,
} from '../mediaValidation.interface';

function loadImageDimensions(
  url: string
): Promise<{ width: number; height: number }> {
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

export class BrowserPhotoValidator implements MediaValidator {
  async validateSinglePhoto(file: File): Promise<PhotoValidationResult> {
    const maxBytes = ORDER_CONFIG.maxFileSizeMb * 1024 * 1024;
    const minWidth = ORDER_CONFIG.minWidthPx;
    const minHeight = ORDER_CONFIG.minHeightPx;

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
      if (width < minWidth || height < minHeight) {
        URL.revokeObjectURL(previewUrl);
        return {
          rejected: {
            fileName: file.name,
            reason: `Risoluzione troppo bassa (${width} × ${height} px). Servono almeno ${minWidth} × ${minHeight} px.`,
          },
        };
      }

      const minSide = Math.min(width, height);
      const qualityWarning =
        minSide < ORDER_CONFIG.recommendedMinDimensionPx
          ? `Risoluzione moderata (${width} × ${height} px): per tratti e volti ancora più nitidi consigliamo almeno ${ORDER_CONFIG.recommendedMinDimensionPx} px.`
          : undefined;

      return {
        accepted: {
          id: `${file.name}-${file.size}-${Date.now()}`,
          file,
          name: file.name,
          sizeBytes: file.size,
          width,
          height,
          previewUrl,
          qualityWarning,
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
}
