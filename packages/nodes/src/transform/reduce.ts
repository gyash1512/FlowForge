import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  data: z.array(z.unknown()),
  initialValue: z.unknown().optional(),
});

const outputSchema = z.object({
  result: z.unknown(),
});

const configSchema = z.object({
  expression: z.string().describe('JavaScript function body. Receives (accumulator, item, index) and returns the new accumulator.'),
});

/**
 * Create a reducer function from a user-provided expression string.
 * Uses the Function constructor intentionally to allow user-defined
 * reducers at runtime within sandboxed workflow execution.
 */
function createReducerFunction(expression: string): (acc: unknown, item: unknown, index: number) => unknown {
  return new Function('accumulator', 'item', 'index', expression) as (
    acc: unknown,
    item: unknown,
    index: number,
  ) => unknown;
}

export const reduceNode = defineNode({
  name: 'transform/reduce',
  version: '0.1.0',
  description: 'Reduce an array to a single value using a user-defined function',
  category: 'transform',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['transform', 'reduce', 'aggregate'],

  handler: async (ctx) => {
    const { data, initialValue } = ctx.input;
    const { expression } = ctx.config;

    const fn = createReducerFunction(expression);

    let result: unknown;
    if (initialValue !== undefined) {
      result = data.reduce((acc, item, index) => fn(acc, item, index), initialValue);
    } else {
      result = data.reduce((acc, item, index) => fn(acc, item, index));
    }

    return { result };
  },
});
