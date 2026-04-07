import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum(['search', 'index', 'update', 'delete', 'bulk']),
  index: z.string(),
  id: z.string().optional(),
  query: z.record(z.unknown()).optional(),
  document: z.record(z.unknown()).optional(),
  operations: z
    .array(
      z.object({
        action: z.enum(['index', 'update', 'delete']),
        id: z.string().optional(),
        document: z.record(z.unknown()).optional(),
      }),
    )
    .optional(),
  size: z.number().int().optional(),
  from: z.number().int().optional(),
  sort: z.array(z.record(z.unknown())).optional(),
});

const outputSchema = z.object({
  hits: z.array(z.record(z.unknown())).optional(),
  total: z.number().optional(),
  result: z.string().optional(),
  bulkResults: z
    .array(
      z.object({
        id: z.string().optional(),
        result: z.string(),
        status: z.number(),
      }),
    )
    .optional(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Elasticsearch connection identifier'),
});

export const elasticsearchNode = defineNode({
  name: 'data/elasticsearch',
  version: '0.1.0',
  description: 'Search, index, update, and delete documents in Elasticsearch',
  category: 'data',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['search', 'elasticsearch', 'indexing'],

  handler: async (ctx) => {
    const { action, index, id, query, document, operations, size, from, sort } =
      ctx.input as z.infer<typeof inputSchema>;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    const baseParams = { connectionId, index };

    switch (action) {
      case 'search': {
        const result = await ctx.pull('elasticsearch', {
          ...baseParams,
          operation: 'search',
          query: query ?? { match_all: {} },
          size: size ?? 10,
          from: from ?? 0,
          sort,
        });
        const res = result as { hits: Record<string, unknown>[]; total: number };
        return { hits: res.hits, total: res.total };
      }

      case 'index': {
        if (!document) throw new Error('document is required for action "index"');
        const result = await ctx.push('elasticsearch', {
          ...baseParams,
          operation: 'index',
          id,
          document,
        });
        const res = result as { result: string };
        return { result: res.result };
      }

      case 'update': {
        if (!id) throw new Error('id is required for action "update"');
        if (!document) throw new Error('document is required for action "update"');
        const result = await ctx.push('elasticsearch', {
          ...baseParams,
          operation: 'update',
          id,
          document,
        });
        const res = result as { result: string };
        return { result: res.result };
      }

      case 'delete': {
        if (!id) throw new Error('id is required for action "delete"');
        const result = await ctx.push('elasticsearch', {
          ...baseParams,
          operation: 'delete',
          id,
        });
        const res = result as { result: string };
        return { result: res.result };
      }

      case 'bulk': {
        if (!operations?.length) throw new Error('operations array is required for action "bulk"');
        const result = await ctx.push('elasticsearch', {
          ...baseParams,
          operation: 'bulk',
          operations,
        });
        const res = result as { items: Array<{ id?: string; result: string; status: number }> };
        return { bulkResults: res.items };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
