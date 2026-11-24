import {
  createZipArchive,
  type PromptEvalItem,
  type PromptEvalRunDetail,
  type ZipArchiveEntry,
} from '../../../prompt-eval-core/src/index.ts';

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'output'
  );
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function decodeBase64DataUrl(dataUrl: string): {
  bytes: Uint8Array;
  mimeType: string;
  ext: string;
} | null {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  let binary: string;
  try {
    binary = atob(match[2]);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const ext =
    mimeType === 'image/png'
      ? 'png'
      : mimeType === 'image/webp'
        ? 'webp'
        : mimeType === 'image/svg+xml'
          ? 'svg'
          : mimeType === 'image/jpeg' || mimeType === 'image/jpg'
            ? 'jpg'
            : 'bin';
  return { bytes, mimeType, ext };
}

export async function downloadItemOutput(
  item: PromptEvalItem,
  runTitle: string
): Promise<void> {
  const prefix = `${slugify(runTitle)}-${String(item.index + 1).padStart(2, '0')}-${slugify(
    item.inputName.replace(/\.[^.]+$/, '')
  )}`;

  if (item.outputImageDataUrl) {
    const decoded = decodeBase64DataUrl(item.outputImageDataUrl);
    if (decoded) {
      const bytesCopy = new Uint8Array(decoded.bytes);
      triggerBlobDownload(
        new Blob([bytesCopy], { type: decoded.mimeType }),
        `${prefix}.${decoded.ext}`
      );
      return;
    }

    const link = document.createElement('a');
    link.href = item.outputImageDataUrl;
    link.download = `${prefix}.png`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  if (item.outputText) {
    triggerBlobDownload(
      new Blob([item.outputText], { type: 'text/plain;charset=utf-8' }),
      `${prefix}.txt`
    );
  }
}

export function downloadRunReportJson(run: PromptEvalRunDetail): void {
  const sanitized = {
    ...run,
    items: run.items.map((item) => ({
      ...item,
      inputThumbnailDataUrl: undefined,
      outputImageDataUrl: item.outputImageDataUrl ? '[included-in-zip]' : undefined,
    })),
  };
  const blob = new Blob([JSON.stringify(sanitized, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  triggerBlobDownload(
    blob,
    `${slugify(run.title)}-${run.id.slice(0, 8)}-report.json`
  );
}

export function downloadRunZipArchive(run: PromptEvalRunDetail): void {
  const encoder = new TextEncoder();
  const entries: ZipArchiveEntry[] = [
    {
      name: 'prompt.txt',
      data: encoder.encode(run.promptText),
    },
    {
      name: 'evaluation-report.json',
      data: encoder.encode(
        JSON.stringify(
          {
            id: run.id,
            title: run.title,
            modality: run.modality,
            executionMode: run.executionMode,
            providerId: run.providerId,
            model: run.model,
            promptLabel: run.promptLabel,
            promptParams: run.promptParams,
            status: run.status,
            totalItems: run.totalItems,
            completedItems: run.completedItems,
            failedItems: run.failedItems,
            totalEstimatedCostUsd: run.totalEstimatedCostUsd,
            createdAt: new Date(run.createdAtMs).toISOString(),
            completedAt: run.completedAtMs
              ? new Date(run.completedAtMs).toISOString()
              : null,
            evaluation: run.evaluation ?? null,
            items: run.items.map((item) => ({
              id: item.id,
              index: item.index,
              inputName: item.inputName,
              status: item.status,
              outputFormat: item.outputFormat ?? null,
              outputText: item.outputText ?? null,
              errorMessage: item.errorMessage ?? null,
              latencyMs: item.latencyMs ?? null,
              usage: item.usage ?? null,
              evaluation: item.evaluation ?? null,
            })),
          },
          null,
          2
        )
      ),
    },
  ];

  for (const item of run.items) {
    const stem = `${String(item.index + 1).padStart(2, '0')}-${slugify(
      item.inputName.replace(/\.[^.]+$/, '')
    )}`;
    if (item.outputImageDataUrl) {
      const decoded = decodeBase64DataUrl(item.outputImageDataUrl);
      if (decoded) {
        entries.push({
          name: `outputs/${stem}.${decoded.ext}`,
          data: decoded.bytes,
        });
      }
    } else if (item.outputText) {
      entries.push({
        name: `outputs/${stem}.txt`,
        data: encoder.encode(item.outputText),
      });
    }
  }

  const zipBytes = createZipArchive(entries);
  const zipCopy = new Uint8Array(zipBytes);
  triggerBlobDownload(
    new Blob([zipCopy], { type: 'application/zip' }),
    `${slugify(run.title)}-${run.id.slice(0, 8)}.zip`
  );
}
