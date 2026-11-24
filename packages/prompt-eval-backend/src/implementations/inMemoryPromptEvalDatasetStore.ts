import type {
  PromptEvalDatasetDetail,
  PromptEvalDatasetSummary,
} from '../../../prompt-eval-core/src/index.ts';
import type {
  PromptEvalDatasetStore,
  PromptEvalStoredDatasetItem,
} from '../promptEval.interface.ts';

function stripItems(dataset: PromptEvalDatasetDetail): PromptEvalDatasetSummary {
  const { items: _items, ...summary } = dataset;
  return {
    ...summary,
    previewThumbnails: [...summary.previewThumbnails],
  };
}

function cloneDetail(dataset: PromptEvalDatasetDetail): PromptEvalDatasetDetail {
  return {
    ...dataset,
    previewThumbnails: [...dataset.previewThumbnails],
    items: dataset.items
      .map((item) => ({ ...item }))
      .sort((a, b) => a.index - b.index),
  };
}

export class InMemoryPromptEvalDatasetStore implements PromptEvalDatasetStore {
  private readonly datasets = new Map<string, PromptEvalDatasetDetail>();
  private readonly itemBytes = new Map<string, Map<string, PromptEvalStoredDatasetItem>>();

  async createDataset(
    dataset: PromptEvalDatasetDetail,
    itemsWithBytes: PromptEvalStoredDatasetItem[]
  ): Promise<PromptEvalDatasetDetail> {
    const copy = cloneDetail(dataset);
    const bytesMap = new Map<string, PromptEvalStoredDatasetItem>();
    for (const item of itemsWithBytes) {
      bytesMap.set(item.id, {
        ...item,
        bytes: new Uint8Array(item.bytes),
      });
    }
    this.datasets.set(copy.id, copy);
    this.itemBytes.set(copy.id, bytesMap);
    return cloneDetail(copy);
  }

  async listDatasets(limit = 100): Promise<PromptEvalDatasetSummary[]> {
    const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
    return [...this.datasets.values()]
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, safeLimit)
      .map(stripItems);
  }

  async getDataset(datasetId: string): Promise<PromptEvalDatasetDetail | null> {
    const found = this.datasets.get(datasetId);
    return found ? cloneDetail(found) : null;
  }

  async loadDatasetItemBytes(
    datasetId: string,
    itemId: string
  ): Promise<PromptEvalStoredDatasetItem | null> {
    const item = this.itemBytes.get(datasetId)?.get(itemId);
    if (!item) return null;
    return {
      ...item,
      bytes: new Uint8Array(item.bytes),
    };
  }

  async deleteDataset(datasetId: string): Promise<boolean> {
    this.itemBytes.delete(datasetId);
    return this.datasets.delete(datasetId);
  }
}
