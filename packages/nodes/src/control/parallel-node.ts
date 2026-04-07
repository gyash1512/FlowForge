import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  items: z.array(z.unknown()).describe('Items to process in parallel'),
});

const outputSchema = z.object({
  results: z.array(z.unknown()),
  totalItems: z.number(),
});

const configSchema = z.object({
  concurrency: z.number().int().min(1).default(10).describe('Max concurrent executions'),
});

export const parallelNode = defineNode({
  name: 'control/parallel',
  version: '0.1.0',
  description: 'Fan-out — processes items in parallel with configurable concurrency',
  category: 'control',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['control-flow', 'parallel', 'fan-out', 'concurrency'],

  handler: async (ctx) => {
    const { items } = ctx.input as z.infer<typeof inputSchema>;
    // In a real implementation, this would fan out to sub-pipelines
    // Here we pass items through for the runner to handle
    return { results: items, totalItems: items.length };
  },
});
