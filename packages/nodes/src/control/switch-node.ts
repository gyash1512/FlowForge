import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  value: z.unknown().describe('The value to match against cases'),
  cases: z.record(z.string(), z.unknown()).describe('Map of case values to outputs'),
  default: z.unknown().optional().describe('Default value if no case matches'),
});

const outputSchema = z.object({
  matched: z.string().nullable(),
  value: z.unknown(),
});

const configSchema = z.object({});

export const switchNode = defineNode({
  name: 'control/switch',
  version: '0.1.0',
  description: 'Multi-way branching — routes to one of N outputs based on a value',
  category: 'control',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['control-flow', 'switch', 'routing'],

  handler: async (ctx) => {
    const { value, cases } = ctx.input;
    const key = String(value);
    if (key in cases) {
      return { matched: key, value: cases[key] };
    }
    return { matched: null, value: ctx.input.default };
  },
});
