import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum([
    'createPost',
    'getUserMedia',
    'replyToComment',
    'createCarousel',
    'getPostInsights',
  ]),
  imageUrl: z.string().optional(),
  caption: z.string().optional(),
  userId: z.string().optional(),
  commentId: z.string().optional(),
  text: z.string().optional(),
  mediaUrls: z.array(z.string()).optional(),
  mediaId: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Instagram integration connection identifier'),
});

export const instagramNode = defineNode({
  name: 'communication/instagram',
  version: '0.1.0',
  description: 'Create posts, manage media, reply to comments, and view insights on Instagram',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['instagram', 'social-media', 'meta'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createPost': {
        const { imageUrl, caption } = input;
        if (!imageUrl) throw new Error('imageUrl is required for action "createPost"');
        const data = await ctx.integrate('instagram', 'createPost', {
          connectionId,
          imageUrl,
          caption,
        });
        return { data, success: true };
      }

      case 'getUserMedia': {
        const { userId } = input;
        if (!userId) throw new Error('userId is required for action "getUserMedia"');
        const data = await ctx.integrate('instagram', 'getUserMedia', {
          connectionId,
          userId,
        });
        return { data, success: true };
      }

      case 'replyToComment': {
        const { commentId, text } = input;
        if (!commentId || !text)
          throw new Error('commentId and text are required for action "replyToComment"');
        const data = await ctx.integrate('instagram', 'replyToComment', {
          connectionId,
          commentId,
          text,
        });
        return { data, success: true };
      }

      case 'createCarousel': {
        const { mediaUrls, caption } = input;
        if (!mediaUrls || mediaUrls.length === 0)
          throw new Error('mediaUrls is required for action "createCarousel"');
        const data = await ctx.integrate('instagram', 'createCarousel', {
          connectionId,
          mediaUrls,
          caption,
        });
        return { data, success: true };
      }

      case 'getPostInsights': {
        const { mediaId } = input;
        if (!mediaId) throw new Error('mediaId is required for action "getPostInsights"');
        const data = await ctx.integrate('instagram', 'getPostInsights', {
          connectionId,
          mediaId,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
