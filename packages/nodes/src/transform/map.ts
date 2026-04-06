import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  data: z.array(z.unknown()),
});

const outputSchema = z.object({
  data: z.array(z.unknown()),
  count: z.number(),
});

const configSchema = z.object({
  expression: z
    .string()
    .describe('JavaScript function body. Receives (item, index) and returns transformed item.'),
});

/**
 * Create a transform function from a user-provided expression string.
 * Uses the Function constructor intentionally to allow user-defined
 * transforms at runtime within sandboxed workflow execution.
 */
function createTransformFunction(expression: string): (item: unknown, index: number) => unknown {
  return new Function('item', 'index', expression) as (item: unknown, index: number) => unknown;
}

export const mapNode = defineNode({
  name: 'transform/map',
  version: '0.1.0',
  description: 'Transform each element in an array using a user-defined function',
  category: 'transform',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['transform', 'map', 'array'],

  handler: async (ctx) => {
    const { data } = ctx.input as z.infer<typeof inputSchema>;
    const { expression } = ctx.config as z.infer<typeof configSchema>;

    const fn = createTransformFunction(expression);

    const result = data.map((item, index) => fn(item, index));

    return { data: result, count: result.length };
  },
});
