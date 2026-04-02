import type { Checkpoint, RunId, Logger } from '@flowforge/shared';
import { CheckpointError } from '@flowforge/shared';

// ────────────────────────────────────────────────────────────────
// Checkpoint Store Interface
// ────────────────────────────────────────────────────────────────

export interface CheckpointStore {
  save(checkpoint: Checkpoint): Promise<void>;
  load(runId: RunId, stepName: string): Promise<Checkpoint | undefined>;
  loadAll(runId: RunId): Promise<Checkpoint[]>;
  delete(runId: RunId, stepName: string): Promise<boolean>;
  deleteAll(runId: RunId): Promise<number>;
}

// ────────────────────────────────────────────────────────────────
// In-Memory Implementation
// ────────────────────────────────────────────────────────────────

export class InMemoryCheckpointStore implements CheckpointStore {
  private store = new Map<string, Checkpoint>();

  private key(runId: RunId, stepName: string): string {
    return `${runId}::${stepName}`;
  }

  async save(checkpoint: Checkpoint): Promise<void> {
    this.store.set(this.key(checkpoint.runId, checkpoint.stepName), checkpoint);
  }

  async load(runId: RunId, stepName: string): Promise<Checkpoint | undefined> {
    return this.store.get(this.key(runId, stepName));
  }

  async loadAll(runId: RunId): Promise<Checkpoint[]> {
    const results: Checkpoint[] = [];
    for (const [k, v] of this.store) {
      if (k.startsWith(`${runId}::`)) {
        results.push(v);
      }
    }
    return results;
  }

  async delete(runId: RunId, stepName: string): Promise<boolean> {
    return this.store.delete(this.key(runId, stepName));
  }

  async deleteAll(runId: RunId): Promise<number> {
    let count = 0;
    for (const k of [...this.store.keys()]) {
      if (k.startsWith(`${runId}::`)) {
        this.store.delete(k);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

// ────────────────────────────────────────────────────────────────
// Checkpoint Manager
// ────────────────────────────────────────────────────────────────

export class CheckpointManager {
  private store: CheckpointStore;
  private logger: Logger | undefined;

  constructor(store?: CheckpointStore, logger?: Logger) {
    this.store = store ?? new InMemoryCheckpointStore();
    this.logger = logger;
  }

  async save(
    runId: RunId,
    stepName: string,
    state: Record<string, unknown>,
  ): Promise<Checkpoint> {
    const checkpoint: Checkpoint = {
      runId,
      stepName,
      state,
      createdAt: new Date(),
    };

    try {
      await this.store.save(checkpoint);
      this.logger?.debug(`Checkpoint saved for run=${runId} step=${stepName}`);
      return checkpoint;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new CheckpointError(runId, `Failed to save checkpoint: ${message}`);
    }
  }

  async load(
    runId: RunId,
    stepName: string,
  ): Promise<Checkpoint | undefined> {
    try {
      return await this.store.load(runId, stepName);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new CheckpointError(runId, `Failed to load checkpoint: ${message}`);
    }
  }

  async loadAll(runId: RunId): Promise<Checkpoint[]> {
    try {
      return await this.store.loadAll(runId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new CheckpointError(runId, `Failed to load checkpoints: ${message}`);
    }
  }

  async delete(runId: RunId, stepName: string): Promise<boolean> {
    try {
      const deleted = await this.store.delete(runId, stepName);
      if (deleted) {
        this.logger?.debug(`Checkpoint deleted for run=${runId} step=${stepName}`);
      }
      return deleted;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new CheckpointError(runId, `Failed to delete checkpoint: ${message}`);
    }
  }

  async deleteAll(runId: RunId): Promise<number> {
    try {
      const count = await this.store.deleteAll(runId);
      if (count > 0) {
        this.logger?.debug(`Deleted ${count} checkpoints for run=${runId}`);
      }
      return count;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new CheckpointError(runId, `Failed to delete checkpoints: ${message}`);
    }
  }
}
