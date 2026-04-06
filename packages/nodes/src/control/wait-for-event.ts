import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  event: z.string().describe('Event type to wait for'),
  match: z.record(z.unknown()).optional().describe('Matching criteria for the event payload'),
  timeout: z.number().int().optional().describe('Timeout in milliseconds'),
});

const outputSchema = z.object({
  event: z.string(),
  data: z.unknown(),
  receivedAt: z.string(),
  timedOut: z.boolean(),
});

const configSchema = z.object({
  defaultTimeout: z
    .number()
    .int()
    .default(300_000)
    .describe('Default timeout in milliseconds (5 minutes)'),
});

export const waitForEventNode = defineNode({
  name: 'control/wait-for-event',
  version: '0.1.0',
  description: 'Pause workflow and wait for a specific event to occur',
  category: 'control',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['control-flow', 'event', 'wait'],

  handler: async (ctx) => {
    const { event, match, timeout } = ctx.input as z.infer<typeof inputSchema>;
    const { defaultTimeout } = ctx.config as z.infer<typeof configSchema>;

    const effectiveTimeout = timeout ?? defaultTimeout;

    ctx.logger.info({ event, timeout: effectiveTimeout }, 'Waiting for event');

    try {
      const result = await ctx.wait(event, match, effectiveTimeout);
      return {
        event,
        data: result,
        receivedAt: new Date().toISOString(),
        timedOut: false,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes('timeout')) {
        ctx.logger.warn({ event, timeout: effectiveTimeout }, 'Wait timed out');
        return {
          event,
          data: null,
          receivedAt: new Date().toISOString(),
          timedOut: true,
        };
      }
      throw err;
    }
  },
});
