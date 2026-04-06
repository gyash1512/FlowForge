import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['createPost', 'search', 'followUser', 'getUser', 'createDM']),
  text: z.string().optional(),
  query: z.string().optional(),
  userId: z.string().optional(),
  participantId: z.string().optional(),
  maxResults: z.number().int().optional(),
});

const outputSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Twitter integration connection identifier'),
});

export const twitterNode = defineNode({
  name: 'communication/twitter',
  version: '0.1.0',
  description: 'Create posts, search tweets, follow users, and send DMs via Twitter',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['twitter', 'social-media', 'x'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createPost': {
        const { text } = input;
        if (!text) throw new Error('text is required for action "createPost"');
        const result = await ctx.integrate('twitter', 'createPost', {
          connectionId,
          text,
        });
        return { success: true, data: result };
      }

      case 'search': {
        const { query, maxResults } = input;
        if (!query) throw new Error('query is required for action "search"');
        const result = await ctx.integrate('twitter', 'search', {
          connectionId,
          query,
          maxResults,
        });
        return { success: true, data: result };
      }

      case 'followUser': {
        const { userId } = input;
        if (!userId) throw new Error('userId is required for action "followUser"');
        const result = await ctx.integrate('twitter', 'followUser', {
          connectionId,
          userId,
        });
        return { success: true, data: result };
      }

      case 'getUser': {
        const { userId } = input;
        if (!userId) throw new Error('userId is required for action "getUser"');
        const result = await ctx.integrate('twitter', 'getUser', {
          connectionId,
          userId,
        });
        return { success: true, data: result };
      }

      case 'createDM': {
        const { participantId, text } = input;
        if (!participantId) throw new Error('participantId is required for action "createDM"');
        if (!text) throw new Error('text is required for action "createDM"');
        const result = await ctx.integrate('twitter', 'createDM', {
          connectionId,
          participantId,
          text,
        });
        return { success: true, data: result };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
