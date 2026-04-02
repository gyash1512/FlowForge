import { describe, it, expect } from 'vitest';
import { InMemoryStateStore } from '../state.js';

describe('InMemoryStateStore', () => {
  it('stores and retrieves values', async () => {
    const store = new InMemoryStateStore();
    await store.set('key', { value: 42 });
    const result = await store.get<{ value: number }>('key');
    expect(result).toEqual({ value: 42 });
  });

  it('returns undefined for missing keys', async () => {
    const store = new InMemoryStateStore();
    expect(await store.get('missing')).toBeUndefined();
  });

  it('deletes keys', async () => {
    const store = new InMemoryStateStore();
    await store.set('key', 'val');
    const deleted = await store.delete('key');
    expect(deleted).toBe(true);
    expect(await store.get('key')).toBeUndefined();
  });

  it('returns false when deleting missing key', async () => {
    const store = new InMemoryStateStore();
    expect(await store.delete('missing')).toBe(false);
  });

  it('clears all values', async () => {
    const store = new InMemoryStateStore();
    await store.set('a', 1);
    await store.set('b', 2);
    store.clear();
    expect(store.size).toBe(0);
  });

  it('overwrites existing values', async () => {
    const store = new InMemoryStateStore();
    await store.set('key', 'old');
    await store.set('key', 'new');
    expect(await store.get('key')).toBe('new');
  });
});
