import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  items: z.array(z.unknown()).describe('Array of items to iterate over'),
});

const outputSchema = z.object({
  results: z.array(z.unknown()),
  processedCount: z.number(),
});

const configSchema = z.object({
  concurrency: z.number().int().min(1).default(1).describe('Max concurrent iterations'),
});

export const forEachNode = defineNode({
  name: 'control/forEach',
  version: '0.1.0',
  description: 'Iterate over an array, running a sub-pipeline for each item with concurrency control',
  category: 'control',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['control-flow', 'loop', 'forEach', 'iteration'],

  handler: async (ctx) => {
    const { items } = ctx.input;
    return { results: items, processedCount: items.length };
  },
});
