import type { Dirent, Stats } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  PromptEvalDatasetDetail,
  PromptEvalDatasetItemSummary,
  PromptEvalDatasetSummary,
} from '../../../prompt-eval-core/src/index.ts';
import type {
  PromptEvalDatasetRepository,
  PromptEvalMediaPreparer,
  PromptEvalStoredDatasetItem,
} from '../promptEval.interface.ts';

const SAFE_SLUG_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const REPO_DATASET_ID_PREFIX = 'repo_';

const EXTENSION_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

interface DatasetManifestJson {
  name?: unknown;
  description?: unknown;
}

interface CachedRepoFileMeta {
  signature: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  thumbnailDataUrl?: string;
}

function sanitizeItemIdSegment(filename: string): string {
  const base = path.parse(filename).name;
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return cleaned || 'img';
}

function inferMimeTypeFromExtension(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();
  return EXTENSION_TO_MIME[ext] ?? null;
}

export interface FilesystemPromptEvalDatasetRepositoryOptions {
  rootDir: string;
  mediaPreparer?: PromptEvalMediaPreparer;
}

export class FilesystemPromptEvalDatasetRepository
  implements PromptEvalDatasetRepository
{
  private readonly rootDir: string;
  private readonly mediaPreparer?: PromptEvalMediaPreparer;
  private readonly metaCache = new Map<string, CachedRepoFileMeta>();

  constructor(options: FilesystemPromptEvalDatasetRepositoryOptions) {
    this.rootDir = path.resolve(options.rootDir);
    this.mediaPreparer = options.mediaPreparer;
  }

  private isInsideRoot(candidatePath: string): boolean {
    const resolved = path.resolve(candidatePath);
    return (
      resolved === this.rootDir ||
      resolved.startsWith(`${this.rootDir}${path.sep}`)
    );
  }

  private async resolveInputDirectory(
    folderPath: string
  ): Promise<string | null> {
    const inputSubdir = path.join(folderPath, 'input');
    try {
      const stat = await fs.stat(inputSubdir);
      if (stat.isDirectory()) {
        return inputSubdir;
      }
    } catch {
      // Fall back to direct image files in folderPath
    }
    return folderPath;
  }

  private async readManifest(
    folderPath: string,
    slug: string
  ): Promise<{ name: string; description?: string }> {
    const manifestPath = path.join(folderPath, 'dataset.json');
    try {
      const raw = await fs.readFile(manifestPath, 'utf8');
      const parsed = JSON.parse(raw) as DatasetManifestJson;
      const name =
        typeof parsed.name === 'string' && parsed.name.trim()
          ? parsed.name.trim().slice(0, 80)
          : slug;
      const description =
        typeof parsed.description === 'string' && parsed.description.trim()
          ? parsed.description.trim().slice(0, 240)
          : undefined;
      return { name, description };
    } catch {
      return { name: slug };
    }
  }

  private async inspectImageFile(
    filePath: string,
    declaredMime: string,
    sizeBytes: number,
    mtimeMs: number
  ): Promise<CachedRepoFileMeta | null> {
    const signature = `${sizeBytes}:${Math.trunc(mtimeMs)}`;
    const cached = this.metaCache.get(filePath);
    if (cached && cached.signature === signature) {
      return cached;
    }

    if (!this.mediaPreparer) {
      const basic: CachedRepoFileMeta = {
        signature,
        mimeType: declaredMime,
        sizeBytes,
      };
      this.metaCache.set(filePath, basic);
      return basic;
    }

    try {
      const rawBytes = await fs.readFile(filePath);
      const prepared = await this.mediaPreparer.prepareInputImage(
        rawBytes,
        declaredMime
      );
      const entry: CachedRepoFileMeta = {
        signature,
        mimeType: declaredMime,
        sizeBytes,
        width: prepared.width || undefined,
        height: prepared.height || undefined,
        thumbnailDataUrl: prepared.thumbnailDataUrl,
      };
      this.metaCache.set(filePath, entry);
      return entry;
    } catch {
      return null;
    }
  }

  private async loadFolderDataset(
    slug: string
  ): Promise<{
    detail: PromptEvalDatasetDetail;
    fileMap: Map<string, { filePath: string; mimeType: string; name: string }>;
  } | null> {
    if (!SAFE_SLUG_PATTERN.test(slug)) return null;
    const folderPath = path.resolve(this.rootDir, slug);
    if (!this.isInsideRoot(folderPath)) return null;

    let folderStat: Stats;
    try {
      folderStat = await fs.stat(folderPath);
    } catch {
      return null;
    }
    if (!folderStat.isDirectory()) return null;

    const inputDir = await this.resolveInputDirectory(folderPath);
    if (!inputDir || !this.isInsideRoot(inputDir)) return null;

    let dirEntries: Dirent[];
    try {
      dirEntries = await fs.readdir(inputDir, { withFileTypes: true });
    } catch {
      return null;
    }

    const imageFilenames = dirEntries
      .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .filter((name) => inferMimeTypeFromExtension(name) !== null)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (imageFilenames.length === 0) {
      return null;
    }

    const manifest = await this.readManifest(folderPath, slug);
    const items: PromptEvalDatasetItemSummary[] = [];
    const fileMap = new Map<
      string,
      { filePath: string; mimeType: string; name: string }
    >();
    let latestMtimeMs = Math.trunc(folderStat.mtimeMs);

    for (const filename of imageFilenames) {
      const filePath = path.resolve(inputDir, filename);
      if (!this.isInsideRoot(filePath)) continue;
      const declaredMime = inferMimeTypeFromExtension(filename);
      if (!declaredMime) continue;

      let fileStat: Stats;
      try {
        fileStat = await fs.stat(filePath);
      } catch {
        continue;
      }
      if (!fileStat.isFile() || fileStat.size <= 0) continue;

      const meta = await this.inspectImageFile(
        filePath,
        declaredMime,
        fileStat.size,
        fileStat.mtimeMs
      );
      if (!meta) continue;

      const index = items.length;
      const itemId = `item_${String(index + 1).padStart(2, '0')}_${sanitizeItemIdSegment(filename)}`;
      latestMtimeMs = Math.max(latestMtimeMs, Math.trunc(fileStat.mtimeMs));

      items.push({
        id: itemId,
        index,
        name: filename,
        mimeType: meta.mimeType,
        sizeBytes: meta.sizeBytes,
        width: meta.width,
        height: meta.height,
        thumbnailDataUrl: meta.thumbnailDataUrl,
      });

      fileMap.set(itemId, {
        filePath,
        mimeType: meta.mimeType,
        name: filename,
      });
    }

    if (items.length === 0) {
      return null;
    }

    const previewThumbnails = items
      .map((item) => item.thumbnailDataUrl)
      .filter((thumb): thumb is string => Boolean(thumb))
      .slice(0, 4);

    const detail: PromptEvalDatasetDetail = {
      id: `${REPO_DATASET_ID_PREFIX}${slug}`,
      slug,
      name: manifest.name,
      description: manifest.description,
      source: 'repo',
      readOnly: true,
      itemCount: items.length,
      previewThumbnails,
      createdAtMs: Math.trunc(folderStat.birthtimeMs || folderStat.mtimeMs),
      updatedAtMs: latestMtimeMs,
      items,
    };

    return { detail, fileMap };
  }

  private extractSlugFromDatasetId(datasetId: string): string | null {
    if (!datasetId.startsWith(REPO_DATASET_ID_PREFIX)) return null;
    const slug = datasetId.slice(REPO_DATASET_ID_PREFIX.length);
    return SAFE_SLUG_PATTERN.test(slug) ? slug : null;
  }

  async listDatasets(): Promise<PromptEvalDatasetSummary[]> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(this.rootDir, { withFileTypes: true });
    } catch {
      return [];
    }

    const slugs = entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          SAFE_SLUG_PATTERN.test(entry.name)
      )
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const summaries: PromptEvalDatasetSummary[] = [];
    for (const slug of slugs) {
      const loaded = await this.loadFolderDataset(slug);
      if (loaded) {
        const { items: _items, ...summary } = loaded.detail;
        summaries.push(summary);
      }
    }
    return summaries;
  }

  async getDataset(datasetId: string): Promise<PromptEvalDatasetDetail | null> {
    const slug = this.extractSlugFromDatasetId(datasetId);
    if (!slug) return null;
    const loaded = await this.loadFolderDataset(slug);
    return loaded ? loaded.detail : null;
  }

  async loadDatasetItemBytes(
    datasetId: string,
    itemId: string
  ): Promise<PromptEvalStoredDatasetItem | null> {
    const slug = this.extractSlugFromDatasetId(datasetId);
    if (!slug) return null;
    const loaded = await this.loadFolderDataset(slug);
    if (!loaded) return null;

    const itemSummary = loaded.detail.items.find((entry) => entry.id === itemId);
    const fileEntry = loaded.fileMap.get(itemId);
    if (!itemSummary || !fileEntry) return null;

    try {
      const rawBuffer = await fs.readFile(fileEntry.filePath);
      return {
        ...itemSummary,
        bytes: new Uint8Array(rawBuffer),
      };
    } catch {
      return null;
    }
  }
}
