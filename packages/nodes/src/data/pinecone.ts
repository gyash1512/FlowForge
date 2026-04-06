import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['upsert', 'query', 'delete', 'describeIndex']),
  namespace: z.string().optional(),
  vectors: z
    .array(
      z.object({
        id: z.string(),
        values: z.array(z.number()),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .optional(),
  topK: z.number().int().optional(),
  filter: z.record(z.unknown()).optional(),
  queryVector: z.array(z.number()).optional(),
  ids: z.array(z.string()).optional(),
  includeMetadata: z.boolean().optional(),
  includeValues: z.boolean().optional(),
});

const outputSchema = z.object({
  value: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Pinecone connection identifier'),
});

export const pineconeNode = defineNode({
  name: 'data/pinecone',
  version: '0.1.0',
  description: 'Interact with Pinecone vector database for similarity search',
  category: 'data',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['pinecone', 'vector-db', 'embeddings', 'similarity-search'],

  handler: async (ctx) => {
    const { action, namespace, vectors, topK, filter, queryVector, ids, includeMetadata, includeValues } = ctx.input as z.infer<typeof inputSchema>;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'upsert': {
        if (!vectors || vectors.length === 0) throw new Error('vectors are required for action "upsert"');
        await ctx.push('pinecone', {
          connectionId,
          command: 'UPSERT',
          args: { namespace, vectors },
        });
        return { value: { upsertedCount: vectors.length }, success: true };
      }

      case 'query': {
        if (!queryVector) throw new Error('queryVector is required for action "query"');
        const result = await ctx.pull('pinecone', {
          connectionId,
          command: 'QUERY',
          args: {
            namespace,
            vector: queryVector,
            topK: topK ?? 10,
            filter,
            includeMetadata: includeMetadata ?? true,
            includeValues: includeValues ?? false,
          },
        });
        return { value: result, success: true };
      }

      case 'delete': {
        if (!ids || ids.length === 0) throw new Error('ids are required for action "delete"');
        await ctx.push('pinecone', {
          connectionId,
          command: 'DELETE',
          args: { namespace, ids },
        });
        return { value: { deletedCount: ids.length }, success: true };
      }

      case 'describeIndex': {
        const result = await ctx.pull('pinecone', {
          connectionId,
          command: 'DESCRIBE_INDEX',
          args: {},
        });
        return { value: result, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
