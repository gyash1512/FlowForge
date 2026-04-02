import type { StateStore } from '@flowforge/shared';

export class InMemoryStateStore implements StateStore {
  private data = new Map<string, unknown>();

  async get<T = unknown>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }

  get size(): number {
    return this.data.size;
  }
}
