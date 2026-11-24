import type {
  PromptEvalItem,
  PromptEvalItemEvaluation,
  PromptEvalRunDetail,
  PromptEvalRunEvaluation,
  PromptEvalRunSummary,
} from '../../../prompt-eval-core/src/index.ts';
import type { PromptEvalStore } from '../promptEval.interface.ts';

function stripItems(run: PromptEvalRunDetail): PromptEvalRunSummary {
  const { items: _items, ...summary } = run;
  return { ...summary };
}

function cloneDetail(run: PromptEvalRunDetail): PromptEvalRunDetail {
  return {
    ...run,
    promptParams: { ...run.promptParams },
    promptMetadata: { ...run.promptMetadata },
    evaluation: run.evaluation
      ? { ...run.evaluation, tags: [...run.evaluation.tags] }
      : undefined,
    items: run.items
      .map((item) => ({
        ...item,
        usage: item.usage ? { ...item.usage } : undefined,
        evaluation: item.evaluation ? { ...item.evaluation } : undefined,
      }))
      .sort((a, b) => a.index - b.index),
  };
}

export class InMemoryPromptEvalStore implements PromptEvalStore {
  private readonly runs = new Map<string, PromptEvalRunDetail>();
  private readonly notificationClaims = new Map<string, number>();

  async createRun(run: PromptEvalRunDetail): Promise<PromptEvalRunDetail> {
    const copy = cloneDetail(run);
    this.runs.set(copy.id, copy);
    return cloneDetail(copy);
  }

  async getRun(runId: string): Promise<PromptEvalRunDetail | null> {
    const found = this.runs.get(runId);
    return found ? cloneDetail(found) : null;
  }

  async listRuns(limit = 50): Promise<PromptEvalRunSummary[]> {
    const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
    return [...this.runs.values()]
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, safeLimit)
      .map(stripItems);
  }

  async listActiveBatchRuns(): Promise<PromptEvalRunSummary[]> {
    return [...this.runs.values()]
      .filter(
        (run) =>
          run.executionMode === 'batch' &&
          (run.status === 'queued' || run.status === 'running') &&
          Boolean(run.externalBatchJobId)
      )
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
      .map(stripItems);
  }

  async updateRunSummary(
    runId: string,
    patch: Partial<PromptEvalRunSummary>
  ): Promise<PromptEvalRunSummary | null> {
    const current = this.runs.get(runId);
    if (!current) return null;
    if (
      patch.notificationStatus === 'sent' ||
      patch.notificationStatus === 'failed' ||
      patch.notificationStatus === 'not_requested'
    ) {
      this.notificationClaims.delete(runId);
    }
    const updated: PromptEvalRunDetail = {
      ...current,
      ...patch,
      id: current.id,
      items: current.items,
    };
    this.runs.set(runId, updated);
    return stripItems(updated);
  }

  async upsertRunItem(runId: string, item: PromptEvalItem): Promise<void> {
    const current = this.runs.get(runId);
    if (!current) return;
    const idx = current.items.findIndex((existing) => existing.id === item.id);
    const clonedItem: PromptEvalItem = {
      ...item,
      usage: item.usage ? { ...item.usage } : undefined,
      evaluation: item.evaluation ? { ...item.evaluation } : undefined,
    };
    if (idx >= 0) {
      current.items[idx] = clonedItem;
    } else {
      current.items.push(clonedItem);
    }
    current.items.sort((a, b) => a.index - b.index);
  }

  async updateRunEvaluation(
    runId: string,
    evaluation: PromptEvalRunEvaluation
  ): Promise<PromptEvalRunDetail | null> {
    const current = this.runs.get(runId);
    if (!current) return null;
    current.evaluation = {
      ...evaluation,
      tags: [...evaluation.tags],
    };
    current.updatedAtMs = evaluation.updatedAtMs;
    return cloneDetail(current);
  }

  async updateItemEvaluation(
    runId: string,
    itemId: string,
    evaluation: PromptEvalItemEvaluation
  ): Promise<PromptEvalRunDetail | null> {
    const current = this.runs.get(runId);
    if (!current) return null;
    const item = current.items.find((entry) => entry.id === itemId);
    if (!item) return null;
    item.evaluation = { ...evaluation };
    current.updatedAtMs = evaluation.updatedAtMs;
    return cloneDetail(current);
  }

  async claimEmailNotification(
    runId: string,
    recipient: string,
    nowMs: number,
    leaseMs = 120_000
  ): Promise<boolean> {
    const current = this.runs.get(runId);
    if (!current) return false;
    if (current.notificationStatus === 'sent') return false;
    const claimedAt = this.notificationClaims.get(runId) ?? 0;
    if (claimedAt > 0 && nowMs - claimedAt < leaseMs) {
      return false;
    }
    this.notificationClaims.set(runId, nowMs);
    current.notifyEmail = recipient;
    return true;
  }

  async deleteRun(runId: string): Promise<boolean> {
    this.notificationClaims.delete(runId);
    return this.runs.delete(runId);
  }
}
