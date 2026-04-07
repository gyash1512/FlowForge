import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IntegrationAdaptor } from '@flowforgejs/shared';
import { AdaptorRegistry } from '../adaptor-registry.js';

function makeAdaptor(name: string, overrides?: Partial<IntegrationAdaptor>): IntegrationAdaptor {
  return {
    name,
    actions: ['doStuff'],
    execute: vi.fn().mockResolvedValue({ ok: true }),
    healthCheck: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('AdaptorRegistry', () => {
  let registry: AdaptorRegistry;

  beforeEach(() => {
    registry = new AdaptorRegistry();
  });

  it('registers and retrieves an adaptor by name', () => {
    const adaptor = makeAdaptor('slack');
    registry.register(adaptor);
    expect(registry.get('slack')).toBe(adaptor);
  });

  it('returns undefined for unregistered adaptor', () => {
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('overwrites adaptor when re-registered with the same name', () => {
    const first = makeAdaptor('slack');
    const second = makeAdaptor('slack');
    registry.register(first);
    registry.register(second);
    expect(registry.get('slack')).toBe(second);
  });

  it('lists all registered adaptors', () => {
    registry.register(makeAdaptor('slack'));
    registry.register(makeAdaptor('email'));
    registry.register(makeAdaptor('github'));

    const list = registry.list();
    expect(list).toHaveLength(3);
    expect(list.map((a) => a.name).sort()).toEqual(['email', 'github', 'slack']);
  });

  it('returns empty list when no adaptors registered', () => {
    expect(registry.list()).toEqual([]);
  });

  describe('healthCheckAll', () => {
    it('returns health status for all adaptors', async () => {
      registry.register(makeAdaptor('slack', { healthCheck: vi.fn().mockResolvedValue(true) }));
      registry.register(makeAdaptor('email', { healthCheck: vi.fn().mockResolvedValue(false) }));

      const results = await registry.healthCheckAll();
      expect(results.get('slack')).toBe(true);
      expect(results.get('email')).toBe(false);
    });

    it('returns false when healthCheck throws', async () => {
      registry.register(
        makeAdaptor('broken', {
          healthCheck: vi.fn().mockRejectedValue(new Error('connection refused')),
        }),
      );

      const results = await registry.healthCheckAll();
      expect(results.get('broken')).toBe(false);
    });

    it('returns empty map when no adaptors registered', async () => {
      const results = await registry.healthCheckAll();
      expect(results.size).toBe(0);
    });
  });
});
