import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  condition: z.boolean().describe('The condition to evaluate'),
  thenValue: z.unknown().optional().describe('Value to return if condition is true'),
  elseValue: z.unknown().optional().describe('Value to return if condition is false'),
});

const outputSchema = z.object({
  branch: z.enum(['then', 'else']),
  value: z.unknown(),
});

const configSchema = z.object({});

export const ifNode = defineNode({
  name: 'control/if',
  version: '0.1.0',
  description:
    'Conditional branching — evaluates a condition and returns the matching branch value',
  category: 'control',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['control-flow', 'conditional', 'branching'],

  handler: async (ctx) => {
    const { condition, thenValue, elseValue } = ctx.input as z.infer<typeof inputSchema>;
    if (condition) {
      return { branch: 'then' as const, value: thenValue };
    }
    return { branch: 'else' as const, value: elseValue };
  },
});
