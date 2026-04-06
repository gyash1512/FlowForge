import type { DataAdaptor } from '@flowforge/shared';
import Redis from 'ioredis';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface RedisAdaptorConfig {
  host: string;
  port: number;
  password?: string;
}

export interface RedisPullParams {
  action: 'get' | 'hget' | 'lrange';
  key: string;
  field?: string;
  start?: number;
  stop?: number;
}

export interface RedisPushParams {
  action: 'set' | 'hset' | 'lpush' | 'del' | 'incr' | 'publish';
  key: string;
  value?: unknown;
  field?: string;
  channel?: string;
}

// ────────────────────────────────────────────────────────────────
// RedisAdaptor
// ────────────────────────────────────────────────────────────────

export class RedisAdaptor implements DataAdaptor {
  readonly name = 'redis';
  private client: Redis | null;
  private config: RedisAdaptorConfig;

  constructor(config: RedisAdaptorConfig) {
    this.config = config;
    this.client = null;
  }

  private getClient(): Redis {
    if (this.client) return this.client;

    this.client = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
    });
    return this.client;
  }

  async pull(params: unknown): Promise<unknown> {
    const p = params as RedisPullParams;
    if (!p.action || !p.key) {
      throw new Error('RedisAdaptor.pull() requires "action" (get|hget|lrange) and "key"');
    }

    const client = this.getClient();

    switch (p.action) {
      case 'get':
        return client.get(p.key);

      case 'hget':
        if (!p.field) {
          throw new Error('RedisAdaptor.pull() with action "hget" requires "field"');
        }
        return client.hget(p.key, p.field);

      case 'lrange':
        return client.lrange(p.key, p.start ?? 0, p.stop ?? -1);

      default:
        throw new Error(`RedisAdaptor.pull(): unknown action "${p.action}"`);
    }
  }

  async push(params: unknown): Promise<unknown> {
    const p = params as RedisPushParams;
    if (!p.action || !p.key) {
      throw new Error(
        'RedisAdaptor.push() requires "action" (set|hset|lpush|del|incr|publish) and "key"',
      );
    }

    const client = this.getClient();

    switch (p.action) {
      case 'set':
        return client.set(p.key, String(p.value ?? ''));

      case 'hset':
        if (!p.field) {
          throw new Error('RedisAdaptor.push() with action "hset" requires "field"');
        }
        return client.hset(p.key, p.field, String(p.value ?? ''));

      case 'lpush':
        return client.lpush(p.key, String(p.value ?? ''));

      case 'del':
        return client.del(p.key);

      case 'incr':
        return client.incr(p.key);

      case 'publish':
        return client.publish(p.channel ?? p.key, String(p.value ?? ''));

      default:
        throw new Error(`RedisAdaptor.push(): unknown action "${p.action}"`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = this.getClient();
      const result = await client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async destroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}
