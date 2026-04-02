import type { DataAdaptor } from '@flowforge/shared';
import pg from 'pg';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface PostgresAdaptorConfig {
  connectionString: string;
  poolSize?: number;
}

export interface PostgresPullParams {
  query: string;
  params?: unknown[];
}

export interface PostgresPushParams {
  query: string;
  params?: unknown[];
}

// ────────────────────────────────────────────────────────────────
// PostgresAdaptor
// ────────────────────────────────────────────────────────────────

export class PostgresAdaptor implements DataAdaptor {
  readonly name = 'postgres';
  private pool: pg.Pool | null;
  private config: PostgresAdaptorConfig;

  constructor(config: PostgresAdaptorConfig) {
    this.config = config;
    this.pool = null;
  }

  private getPool(): pg.Pool {
    if (this.pool) return this.pool;

    this.pool = new pg.Pool({
      connectionString: this.config.connectionString,
      max: this.config.poolSize ?? 10,
    });
    return this.pool;
  }

  async pull(params: unknown): Promise<unknown> {
    const { query, params: queryParams } = params as PostgresPullParams;
    if (!query || typeof query !== 'string') {
      throw new Error('PostgresAdaptor.pull() requires a "query" string');
    }

    const pool = this.getPool();
    const result = await pool.query(query, queryParams ?? []);
    return result.rows;
  }

  async push(params: unknown): Promise<unknown> {
    const { query, params: queryParams } = params as PostgresPushParams;
    if (!query || typeof query !== 'string') {
      throw new Error('PostgresAdaptor.push() requires a "query" string');
    }

    const pool = this.getPool();
    const result = await pool.query(query, queryParams ?? []);
    return { rowCount: result.rowCount, rows: result.rows };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const pool = this.getPool();
      await pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async destroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
