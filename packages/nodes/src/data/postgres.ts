import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['query', 'insert', 'upsert', 'update', 'delete']),
  table: z.string().optional(),
  query: z.string().optional(),
  params: z.array(z.unknown()).optional(),
  data: z.record(z.unknown()).optional(),
  where: z.record(z.unknown()).optional(),
  conflictColumns: z.array(z.string()).optional(),
  returning: z.array(z.string()).optional(),
});

const outputSchema = z.object({
  rows: z.array(z.record(z.unknown())),
  rowCount: z.number(),
  command: z.string(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Postgres connection identifier'),
});

export const postgresNode = defineNode({
  name: 'data/postgres',
  version: '0.1.0',
  description: 'Execute queries and mutations against a PostgreSQL database',
  category: 'data',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['database', 'sql', 'postgres'],

  handler: async (ctx) => {
    const { action, table, query, params, data, where, conflictColumns, returning } = ctx.input;
    const { connectionId } = ctx.config;

    switch (action) {
      case 'query': {
        if (!query) throw new Error('query is required for action "query"');
        const result = await ctx.pull('postgres', {
          connectionId,
          query,
          params: params ?? [],
        });
        const res = result as { rows: Record<string, unknown>[]; rowCount: number };
        return { rows: res.rows, rowCount: res.rowCount, command: 'SELECT' };
      }

      case 'insert': {
        if (!table || !data) throw new Error('table and data are required for action "insert"');
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const returningClause = returning?.length ? ` RETURNING ${returning.join(', ')}` : '';
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})${returningClause}`;
        const result = await ctx.push('postgres', {
          connectionId,
          query: sql,
          params: values,
        });
        const res = result as { rows: Record<string, unknown>[]; rowCount: number };
        return { rows: res.rows ?? [], rowCount: res.rowCount ?? 1, command: 'INSERT' };
      }

      case 'upsert': {
        if (!table || !data) throw new Error('table and data are required for action "upsert"');
        if (!conflictColumns?.length) throw new Error('conflictColumns required for action "upsert"');
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const updateCols = columns
          .filter((c) => !conflictColumns.includes(c))
          .map((c) => `${c} = EXCLUDED.${c}`)
          .join(', ');
        const returningClause = returning?.length ? ` RETURNING ${returning.join(', ')}` : '';
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${conflictColumns.join(', ')}) DO UPDATE SET ${updateCols}${returningClause}`;
        const result = await ctx.push('postgres', {
          connectionId,
          query: sql,
          params: values,
        });
        const res = result as { rows: Record<string, unknown>[]; rowCount: number };
        return { rows: res.rows ?? [], rowCount: res.rowCount ?? 1, command: 'UPSERT' };
      }

      case 'update': {
        if (!table || !data || !where) throw new Error('table, data, and where are required for action "update"');
        const setCols = Object.keys(data);
        const whereCols = Object.keys(where);
        const setClause = setCols.map((c, i) => `${c} = $${i + 1}`).join(', ');
        const whereClause = whereCols.map((c, i) => `${c} = $${setCols.length + i + 1}`).join(' AND ');
        const allValues = [...Object.values(data), ...Object.values(where)];
        const returningClause = returning?.length ? ` RETURNING ${returning.join(', ')}` : '';
        const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}${returningClause}`;
        const result = await ctx.push('postgres', {
          connectionId,
          query: sql,
          params: allValues,
        });
        const res = result as { rows: Record<string, unknown>[]; rowCount: number };
        return { rows: res.rows ?? [], rowCount: res.rowCount ?? 0, command: 'UPDATE' };
      }

      case 'delete': {
        if (!table || !where) throw new Error('table and where are required for action "delete"');
        const whereCols = Object.keys(where);
        const whereClause = whereCols.map((c, i) => `${c} = $${i + 1}`).join(' AND ');
        const returningClause = returning?.length ? ` RETURNING ${returning.join(', ')}` : '';
        const sql = `DELETE FROM ${table} WHERE ${whereClause}${returningClause}`;
        const result = await ctx.push('postgres', {
          connectionId,
          query: sql,
          params: Object.values(where),
        });
        const res = result as { rows: Record<string, unknown>[]; rowCount: number };
        return { rows: res.rows ?? [], rowCount: res.rowCount ?? 0, command: 'DELETE' };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
