import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['find', 'findOne', 'insertOne', 'insertMany', 'updateOne', 'deleteOne', 'aggregate']),
  collection: z.string(),
  filter: z.record(z.unknown()).optional(),
  document: z.record(z.unknown()).optional(),
  documents: z.array(z.record(z.unknown())).optional(),
  update: z.record(z.unknown()).optional(),
  pipeline: z.array(z.record(z.unknown())).optional(),
  options: z.record(z.unknown()).optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  matchedCount: z.number().optional(),
  modifiedCount: z.number().optional(),
  insertedCount: z.number().optional(),
  deletedCount: z.number().optional(),
});

const configSchema = z.object({
  connectionId: z.string().describe('MongoDB connection identifier'),
  database: z.string().describe('Database name'),
});

export const mongodbNode = defineNode({
  name: 'data/mongodb',
  version: '0.1.0',
  description: 'Interact with a MongoDB database',
  category: 'data',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['database', 'nosql', 'mongodb'],

  handler: async (ctx) => {
    const { action, collection, filter, document, documents, update, pipeline, options } = ctx.input;
    const { connectionId, database } = ctx.config;

    const baseParams = { connectionId, database, collection };

    switch (action) {
      case 'find': {
        const result = await ctx.pull('mongodb', {
          ...baseParams,
          operation: 'find',
          filter: filter ?? {},
          options,
        });
        return { data: result };
      }

      case 'findOne': {
        const result = await ctx.pull('mongodb', {
          ...baseParams,
          operation: 'findOne',
          filter: filter ?? {},
          options,
        });
        return { data: result };
      }

      case 'insertOne': {
        if (!document) throw new Error('document is required for action "insertOne"');
        const result = await ctx.push('mongodb', {
          ...baseParams,
          operation: 'insertOne',
          document,
        });
        const res = result as { insertedCount?: number };
        return { data: result, insertedCount: res.insertedCount ?? 1 };
      }

      case 'insertMany': {
        if (!documents?.length) throw new Error('documents array is required for action "insertMany"');
        const result = await ctx.push('mongodb', {
          ...baseParams,
          operation: 'insertMany',
          documents,
        });
        const res = result as { insertedCount?: number };
        return { data: result, insertedCount: res.insertedCount ?? documents.length };
      }

      case 'updateOne': {
        if (!filter || !update) throw new Error('filter and update are required for action "updateOne"');
        const result = await ctx.push('mongodb', {
          ...baseParams,
          operation: 'updateOne',
          filter,
          update,
          options,
        });
        const res = result as { matchedCount?: number; modifiedCount?: number };
        return { data: result, matchedCount: res.matchedCount ?? 0, modifiedCount: res.modifiedCount ?? 0 };
      }

      case 'deleteOne': {
        if (!filter) throw new Error('filter is required for action "deleteOne"');
        const result = await ctx.push('mongodb', {
          ...baseParams,
          operation: 'deleteOne',
          filter,
        });
        const res = result as { deletedCount?: number };
        return { data: result, deletedCount: res.deletedCount ?? 0 };
      }

      case 'aggregate': {
        if (!pipeline) throw new Error('pipeline is required for action "aggregate"');
        const result = await ctx.pull('mongodb', {
          ...baseParams,
          operation: 'aggregate',
          pipeline,
          options,
        });
        return { data: result };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
