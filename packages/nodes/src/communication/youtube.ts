import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum([
    'addToPlaylist',
    'createPlaylist',
    'getChannelStats',
    'getVideoDetails',
    'replyToComment',
  ]),
  playlistId: z.string().optional(),
  videoId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  channelId: z.string().optional(),
  videoIds: z.array(z.string()).optional(),
  commentId: z.string().optional(),
  text: z.string().optional(),
});

const outputSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
});

const configSchema = z.object({
  connectionId: z.string().describe('YouTube integration connection identifier'),
});

export const youtubeNode = defineNode({
  name: 'communication/youtube',
  version: '0.1.0',
  description: 'Manage playlists, get channel stats, and reply to comments via YouTube',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['youtube', 'video', 'google'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'addToPlaylist': {
        const { playlistId, videoId } = input;
        if (!playlistId) throw new Error('playlistId is required for action "addToPlaylist"');
        if (!videoId) throw new Error('videoId is required for action "addToPlaylist"');
        const result = await ctx.integrate('youtube', 'addToPlaylist', {
          connectionId,
          playlistId,
          videoId,
        });
        return { success: true, data: result };
      }

      case 'createPlaylist': {
        const { title, description, videoIds } = input;
        if (!title) throw new Error('title is required for action "createPlaylist"');
        const result = await ctx.integrate('youtube', 'createPlaylist', {
          connectionId,
          title,
          description,
          videoIds,
        });
        return { success: true, data: result };
      }

      case 'getChannelStats': {
        const { channelId } = input;
        if (!channelId) throw new Error('channelId is required for action "getChannelStats"');
        const result = await ctx.integrate('youtube', 'getChannelStats', {
          connectionId,
          channelId,
        });
        return { success: true, data: result };
      }

      case 'getVideoDetails': {
        const { videoId } = input;
        if (!videoId) throw new Error('videoId is required for action "getVideoDetails"');
        const result = await ctx.integrate('youtube', 'getVideoDetails', {
          connectionId,
          videoId,
        });
        return { success: true, data: result };
      }

      case 'replyToComment': {
        const { commentId, text } = input;
        if (!commentId) throw new Error('commentId is required for action "replyToComment"');
        if (!text) throw new Error('text is required for action "replyToComment"');
        const result = await ctx.integrate('youtube', 'replyToComment', {
          connectionId,
          commentId,
          text,
        });
        return { success: true, data: result };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
