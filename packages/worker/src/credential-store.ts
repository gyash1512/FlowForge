import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV for GCM
const KEY_LENGTH = 32; // 256-bit key
const ENCODING = 'base64' as const;
const SEPARATOR = ':';
const PERSISTENCE_DIR = '.flowforge';
const PERSISTENCE_FILE = 'credentials.enc';

// ────────────────────────────────────────────────────────────────
// CredentialStore
// ────────────────────────────────────────────────────────────────

export class CredentialStore {
  private key: Buffer;
  private store = new Map<string, string>(); // compound key -> encrypted value
  private persistPath?: string;

  /**
   * Create a new credential store.
   *
   * @param encryptionKey  A hex-encoded 256-bit key, or omit to auto-generate one.
   *                       When auto-generated, credentials will not survive process restarts
   *                       unless you persist and reload the key yourself.
   * @param persistDir     Optional directory for file-backed persistence.
   *                       Defaults to `.flowforge` in the current working directory.
   *                       Pass `false` to disable file persistence entirely.
   */
  constructor(encryptionKey?: string, persistDir?: string | false) {
    if (encryptionKey) {
      const keyBuf = Buffer.from(encryptionKey, 'hex');
      if (keyBuf.length !== KEY_LENGTH) {
        throw new Error(
          `Encryption key must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes / 256 bits). Got ${keyBuf.length} bytes.`,
        );
      }
      this.key = keyBuf;
    } else {
      // Generate a random key for this session
      this.key = crypto.randomBytes(KEY_LENGTH);
    }

    if (persistDir !== false) {
      const dir = persistDir ?? path.join(process.cwd(), PERSISTENCE_DIR);
      this.persistPath = path.join(dir, PERSISTENCE_FILE);
      this.loadFromDisk();
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────

  /**
   * Store a credential value, encrypted at rest.
   */
  async set(key: string, value: string, tenantId?: string): Promise<void> {
    const compoundKey = this.compoundKey(key, tenantId);
    const encrypted = this.encrypt(value);
    this.store.set(compoundKey, encrypted);
    this.saveToDisk();
  }

  /**
   * Retrieve a credential value, decrypting it transparently.
   */
  async get(key: string, tenantId?: string): Promise<string | undefined> {
    const compoundKey = this.compoundKey(key, tenantId);
    const encrypted = this.store.get(compoundKey);
    if (encrypted === undefined) return undefined;
    return this.decrypt(encrypted);
  }

  /**
   * Delete a credential.
   * @returns true if the credential existed and was deleted.
   */
  async delete(key: string, tenantId?: string): Promise<boolean> {
    const compoundKey = this.compoundKey(key, tenantId);
    const existed = this.store.delete(compoundKey);
    if (existed) this.saveToDisk();
    return existed;
  }

  /**
   * List all credential keys (not values) for the given tenant.
   * Returns bare key names (without the tenant prefix).
   */
  async list(tenantId?: string): Promise<string[]> {
    const prefix = tenantId ? `${tenantId}${SEPARATOR}` : '';
    const keys: string[] = [];

    for (const compoundKey of this.store.keys()) {
      if (tenantId) {
        if (compoundKey.startsWith(prefix)) {
          keys.push(compoundKey.slice(prefix.length));
        }
      } else {
        // No tenant filter — return keys that have no tenant prefix
        if (!compoundKey.includes(SEPARATOR)) {
          keys.push(compoundKey);
        }
      }
    }

    return keys;
  }

  // ──────────────────────────────────────────────────────────────
  // Encryption helpers
  // ──────────────────────────────────────────────────────────────

  private encrypt(value: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

    const encrypted = Buffer.concat([cipher.update(value, 'utf-8'), cipher.final()]);

    const tag = cipher.getAuthTag();

    // Store as: iv:tag:ciphertext (all base64)
    return [iv.toString(ENCODING), tag.toString(ENCODING), encrypted.toString(ENCODING)].join(
      SEPARATOR,
    );
  }

  private decrypt(encrypted: string): string {
    const parts = encrypted.split(SEPARATOR);
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted value format');
    }

    const ivStr = parts[0]!;
    const tagStr = parts[1]!;
    const ciphertextStr = parts[2]!;
    const iv = Buffer.from(ivStr, ENCODING);
    const tag = Buffer.from(tagStr, ENCODING);
    const ciphertext = Buffer.from(ciphertextStr, ENCODING);

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return decrypted.toString('utf-8');
  }

  // ──────────────────────────────────────────────────────────────
  // Key helpers
  // ──────────────────────────────────────────────────────────────

  private compoundKey(key: string, tenantId?: string): string {
    return tenantId ? `${tenantId}${SEPARATOR}${key}` : key;
  }

  // ──────────────────────────────────────────────────────────────
  // File persistence
  // ──────────────────────────────────────────────────────────────

  private loadFromDisk(): void {
    if (!this.persistPath) return;

    try {
      if (fs.existsSync(this.persistPath)) {
        const data = fs.readFileSync(this.persistPath, 'utf-8');
        const entries = JSON.parse(data) as Array<[string, string]>;
        for (const [k, v] of entries) {
          this.store.set(k, v);
        }
      }
    } catch {
      // Ignore read errors — start with an empty store
    }
  }

  private saveToDisk(): void {
    if (!this.persistPath) return;

    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const entries = [...this.store.entries()];
      fs.writeFileSync(this.persistPath, JSON.stringify(entries), 'utf-8');
    } catch {
      // Ignore write errors — in-memory store is still valid
    }
  }
}
