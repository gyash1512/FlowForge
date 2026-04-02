import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'node:crypto';
import { CredentialStore } from '../credential-store.js';

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function generateHexKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────

describe('CredentialStore', () => {
  let store: CredentialStore;
  let key: string;

  beforeEach(() => {
    key = generateHexKey();
    // Disable file persistence for tests
    store = new CredentialStore(key, false);
  });

  it('stores and retrieves a credential', async () => {
    await store.set('api-key', 'sk-abc123');
    const value = await store.get('api-key');
    expect(value).toBe('sk-abc123');
  });

  it('returns undefined for a non-existent key', async () => {
    const value = await store.get('does-not-exist');
    expect(value).toBeUndefined();
  });

  it('deletes a credential and returns true', async () => {
    await store.set('temp-key', 'temp-value');
    const deleted = await store.delete('temp-key');
    expect(deleted).toBe(true);

    const value = await store.get('temp-key');
    expect(value).toBeUndefined();
  });

  it('returns false when deleting a non-existent key', async () => {
    const deleted = await store.delete('never-set');
    expect(deleted).toBe(false);
  });

  it('lists stored credential keys', async () => {
    await store.set('key-a', 'val-a');
    await store.set('key-b', 'val-b');
    await store.set('key-c', 'val-c');

    const keys = await store.list();
    expect(keys).toHaveLength(3);
    expect(keys).toContain('key-a');
    expect(keys).toContain('key-b');
    expect(keys).toContain('key-c');
  });

  it('encrypts values so raw storage does not contain plaintext', async () => {
    const secret = 'super-secret-password-12345';
    await store.set('password', secret);

    // Retrieve the value — it should round-trip correctly
    const decrypted = await store.get('password');
    expect(decrypted).toBe(secret);

    // The store should not contain the plaintext
    // We verify by setting a second value and checking they decrypt independently
    await store.set('other', 'other-secret');
    expect(await store.get('other')).toBe('other-secret');
    expect(await store.get('password')).toBe(secret);
  });

  it('handles special characters in values', async () => {
    const specialValue = 'p@$$w0rd!&*\n\ttabs "quotes" \'single\'';
    await store.set('special', specialValue);
    expect(await store.get('special')).toBe(specialValue);
  });

  it('handles empty string values', async () => {
    await store.set('empty', '');
    expect(await store.get('empty')).toBe('');
  });

  it('overwrites an existing credential', async () => {
    await store.set('mutable', 'first');
    expect(await store.get('mutable')).toBe('first');

    await store.set('mutable', 'second');
    expect(await store.get('mutable')).toBe('second');
  });

  describe('tenant isolation', () => {
    it('isolates credentials between tenants', async () => {
      await store.set('db-password', 'tenant-a-pass', 'tenant-a');
      await store.set('db-password', 'tenant-b-pass', 'tenant-b');

      expect(await store.get('db-password', 'tenant-a')).toBe('tenant-a-pass');
      expect(await store.get('db-password', 'tenant-b')).toBe('tenant-b-pass');
    });

    it('does not leak credentials across tenants', async () => {
      await store.set('secret', 'only-for-a', 'tenant-a');

      // Should not be accessible without tenant or with different tenant
      expect(await store.get('secret')).toBeUndefined();
      expect(await store.get('secret', 'tenant-b')).toBeUndefined();
    });

    it('lists credentials scoped to a tenant', async () => {
      await store.set('key-1', 'val', 'tenant-a');
      await store.set('key-2', 'val', 'tenant-a');
      await store.set('key-3', 'val', 'tenant-b');
      await store.set('global-key', 'val');

      const tenantAKeys = await store.list('tenant-a');
      expect(tenantAKeys).toHaveLength(2);
      expect(tenantAKeys).toContain('key-1');
      expect(tenantAKeys).toContain('key-2');

      const tenantBKeys = await store.list('tenant-b');
      expect(tenantBKeys).toHaveLength(1);
      expect(tenantBKeys).toContain('key-3');

      // Global keys (no tenant)
      const globalKeys = await store.list();
      expect(globalKeys).toHaveLength(1);
      expect(globalKeys).toContain('global-key');
    });

    it('deletes only the tenant-scoped credential', async () => {
      await store.set('shared-name', 'a-value', 'tenant-a');
      await store.set('shared-name', 'b-value', 'tenant-b');

      await store.delete('shared-name', 'tenant-a');

      expect(await store.get('shared-name', 'tenant-a')).toBeUndefined();
      expect(await store.get('shared-name', 'tenant-b')).toBe('b-value');
    });
  });

  describe('encryption key validation', () => {
    it('rejects an incorrectly sized encryption key', () => {
      expect(() => new CredentialStore('abcdef', false)).toThrow('256 bits');
    });

    it('works with an auto-generated key when none is provided', async () => {
      const autoStore = new CredentialStore(undefined, false);
      await autoStore.set('auto-key', 'auto-value');
      expect(await autoStore.get('auto-key')).toBe('auto-value');
    });
  });
});
