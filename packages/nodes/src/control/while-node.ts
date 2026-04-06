import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  condition: z.boolean().describe('Whether to continue the loop'),
  data: z.unknown().optional().describe('Data to pass through each iteration'),
});

const outputSchema = z.object({
  iterations: z.number(),
  data: z.unknown(),
});

const configSchema = z.object({
  maxIterations: z.number().int().min(1).default(100).describe('Maximum iterations to prevent infinite loops'),
});

export const whileNode = defineNode({
  name: 'control/while',
  version: '0.1.0',
  description: 'Repeat a sub-pipeline while a condition is true, with max iteration guard',
  category: 'control',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['control-flow', 'loop', 'while', 'repeat'],

  handler: async (ctx) => {
    // The actual loop is handled by the runner's WhileStep
    // This node serves as the condition check within the loop body
    return { iterations: 1, data: (ctx.input as z.infer<typeof inputSchema>).data };
  },
});
