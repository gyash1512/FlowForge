import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  data: z.array(z.unknown()),
});

const outputSchema = z.object({
  data: z.array(z.unknown()),
  count: z.number(),
  removedCount: z.number(),
});

const configSchema = z.object({
  expression: z
    .string()
    .describe('JavaScript function body. Receives (item, index) and should return a boolean.'),
});

/**
 * Create a predicate function from a user-provided expression string.
 * Uses the Function constructor intentionally to allow user-defined
 * predicates at runtime within sandboxed workflow execution.
 */
function createPredicateFunction(expression: string): (item: unknown, index: number) => boolean {
  return new Function('item', 'index', expression) as (item: unknown, index: number) => boolean;
}

export const filterNode = defineNode({
  name: 'transform/filter',
  version: '0.1.0',
  description: 'Filter an array using a user-defined predicate function',
  category: 'transform',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['transform', 'filter', 'array'],

  handler: async (ctx) => {
    const { data } = ctx.input as z.infer<typeof inputSchema>;
    const { expression } = ctx.config as z.infer<typeof configSchema>;

    const fn = createPredicateFunction(expression);

    const result = data.filter((item, index) => fn(item, index));

    return {
      data: result,
      count: result.length,
      removedCount: data.length - result.length,
    };
  },
});
