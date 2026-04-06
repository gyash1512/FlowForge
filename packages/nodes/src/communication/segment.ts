import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['track', 'identify', 'group', 'page', 'alias']),
  userId: z.string().optional(),
  anonymousId: z.string().optional(),
  event: z.string().optional(),
  properties: z.record(z.unknown()).optional(),
  traits: z.record(z.unknown()).optional(),
  groupId: z.string().optional(),
  name: z.string().optional(),
  previousId: z.string().optional(),
});

const outputSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Segment integration connection identifier'),
});

export const segmentNode = defineNode({
  name: 'communication/segment',
  version: '0.1.0',
  description: 'Track events, identify users, and manage groups via Segment',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['analytics', 'segment', 'tracking'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'track': {
        const { userId, anonymousId, event, properties } = input;
        if (!event) throw new Error('event is required for action "track"');
        const result = await ctx.integrate('segment', 'track', {
          connectionId,
          userId,
          anonymousId,
          event,
          properties,
        });
        return { success: true, data: result };
      }

      case 'identify': {
        const { userId, anonymousId, traits } = input;
        const result = await ctx.integrate('segment', 'identify', {
          connectionId,
          userId,
          anonymousId,
          traits,
        });
        return { success: true, data: result };
      }

      case 'group': {
        const { userId, groupId, traits } = input;
        if (!groupId) throw new Error('groupId is required for action "group"');
        const result = await ctx.integrate('segment', 'group', {
          connectionId,
          userId,
          groupId,
          traits,
        });
        return { success: true, data: result };
      }

      case 'page': {
        const { userId, anonymousId, name, properties } = input;
        const result = await ctx.integrate('segment', 'page', {
          connectionId,
          userId,
          anonymousId,
          name,
          properties,
        });
        return { success: true, data: result };
      }

      case 'alias': {
        const { userId, previousId } = input;
        if (!userId) throw new Error('userId is required for action "alias"');
        if (!previousId) throw new Error('previousId is required for action "alias"');
        const result = await ctx.integrate('segment', 'alias', {
          connectionId,
          userId,
          previousId,
        });
        return { success: true, data: result };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
