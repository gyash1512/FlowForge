import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['get', 'set', 'delete', 'publish', 'hget', 'hset', 'lpush', 'lrange', 'incr']),
  key: z.string(),
  value: z.unknown().optional(),
  field: z.string().optional(),
  channel: z.string().optional(),
  ttl: z.number().int().optional(),
  start: z.number().int().optional(),
  stop: z.number().int().optional(),
});

const outputSchema = z.object({
  value: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Redis connection identifier'),
});

export const redisNode = defineNode({
  name: 'data/redis',
  version: '0.1.0',
  description: 'Interact with a Redis key-value store',
  category: 'data',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['cache', 'redis', 'key-value'],

  handler: async (ctx) => {
    const { action, key, value, field, channel, ttl, start, stop } = ctx.input as z.infer<
      typeof inputSchema
    >;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'get': {
        const result = await ctx.pull('redis', { connectionId, command: 'GET', args: [key] });
        return { value: result, success: true };
      }

      case 'set': {
        const args: unknown[] = [key, value];
        if (ttl !== undefined) args.push('EX', ttl);
        await ctx.push('redis', { connectionId, command: 'SET', args });
        return { value: null, success: true };
      }

      case 'delete': {
        await ctx.push('redis', { connectionId, command: 'DEL', args: [key] });
        return { value: null, success: true };
      }

      case 'publish': {
        if (!channel) throw new Error('channel is required for action "publish"');
        await ctx.push('redis', { connectionId, command: 'PUBLISH', args: [channel, value] });
        return { value: null, success: true };
      }

      case 'hget': {
        if (!field) throw new Error('field is required for action "hget"');
        const result = await ctx.pull('redis', {
          connectionId,
          command: 'HGET',
          args: [key, field],
        });
        return { value: result, success: true };
      }

      case 'hset': {
        if (!field) throw new Error('field is required for action "hset"');
        await ctx.push('redis', { connectionId, command: 'HSET', args: [key, field, value] });
        return { value: null, success: true };
      }

      case 'lpush': {
        await ctx.push('redis', { connectionId, command: 'LPUSH', args: [key, value] });
        return { value: null, success: true };
      }

      case 'lrange': {
        const result = await ctx.pull('redis', {
          connectionId,
          command: 'LRANGE',
          args: [key, start ?? 0, stop ?? -1],
        });
        return { value: result, success: true };
      }

      case 'incr': {
        const result = await ctx.push('redis', { connectionId, command: 'INCR', args: [key] });
        return { value: result, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
