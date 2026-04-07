import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  message: z.string().optional().describe('Log message'),
  data: z.unknown().optional().describe('Structured data to log'),
  level: z.enum(['info', 'warn', 'error', 'debug']).default('info').describe('Log level'),
});

const outputSchema = z.object({
  logged: z.boolean(),
  timestamp: z.string(),
});

const configSchema = z.object({
  prefix: z.string().optional().describe('Optional prefix for log messages'),
});

export const consoleLogNode = defineNode({
  name: 'log/console',
  version: '0.1.0',
  description: 'Log structured data to stdout via the scoped logger',
  category: 'custom',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['logging', 'debug', 'observability'],

  handler: async (ctx) => {
    const { message, data, level } = ctx.input as z.infer<typeof inputSchema>;
    const { prefix: cfgPrefix } = ctx.config as z.infer<typeof configSchema>;
    const prefix = cfgPrefix ? `[${cfgPrefix}] ` : '';
    const msg = `${prefix}${message ?? 'log'}`;

    if (data !== undefined) {
      ctx.logger[level]({ data } as Record<string, unknown>, msg);
    } else {
      ctx.logger[level](msg);
    }

    return { logged: true, timestamp: new Date().toISOString() };
  },
});
