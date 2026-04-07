import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  data: z.unknown().optional().describe('Passthrough data to forward after the delay'),
});

const outputSchema = z.object({
  data: z.unknown(),
  delayMs: z.number(),
  resumedAt: z.string(),
});

const configSchema = z.object({
  ms: z.number().int().min(0).describe('Delay duration in milliseconds'),
});

export const delayNode = defineNode({
  name: 'control/delay',
  version: '0.1.0',
  description: 'Pause workflow execution for a configurable duration',
  category: 'control',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['control-flow', 'delay', 'sleep'],

  handler: async (ctx) => {
    const { data } = ctx.input as z.infer<typeof inputSchema>;
    const { ms } = ctx.config as z.infer<typeof configSchema>;

    ctx.logger.info({ ms }, 'Sleeping');
    await ctx.sleep(ms);

    return {
      data,
      delayMs: ms,
      resumedAt: new Date().toISOString(),
    };
  },
});
