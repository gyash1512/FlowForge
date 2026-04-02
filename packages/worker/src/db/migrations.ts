// ────────────────────────────────────────────────────────────────
// Drizzle Migration Helper
// ────────────────────────────────────────────────────────────────

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Run pending database migrations against the given Postgres connection.
 */
export async function runMigrations(connectionString: string): Promise<void> {
  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool);

  await migrate(db, {
    migrationsFolder: resolve(__dirname, 'migrations'),
  });

  await pool.end();
}

/**
 * Return the config object that `drizzle-kit` needs.
 */
export function getMigrationConfig(): { out: string; schema: string } {
  return {
    out: resolve(__dirname, 'migrations'),
    schema: resolve(__dirname, 'schema.ts'),
  };
}
