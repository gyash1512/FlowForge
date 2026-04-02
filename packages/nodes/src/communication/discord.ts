import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['sendMessage', 'createChannel', 'addRole']),
  channelId: z.string().optional(),
  guildId: z.string().optional(),
  content: z.string().optional(),
  embeds: z.array(z.record(z.unknown())).optional(),
  channelName: z.string().optional(),
  channelType: z.number().int().optional(),
  userId: z.string().optional(),
  roleId: z.string().optional(),
});

const outputSchema = z.object({
  id: z.string().optional(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Discord bot connection identifier'),
});

export const discordNode = defineNode({
  name: 'communication/discord',
  version: '0.1.0',
  description: 'Send messages, create channels, and manage roles in Discord',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['discord', 'messaging', 'chat'],

  handler: async (ctx) => {
    const { action } = ctx.input;
    const { connectionId } = ctx.config;

    switch (action) {
      case 'sendMessage': {
        const { channelId, content, embeds } = ctx.input;
        if (!channelId) throw new Error('channelId is required for action "sendMessage"');
        const result = await ctx.integrate('discord', 'sendMessage', {
          connectionId,
          channelId,
          content,
          embeds,
        });
        const res = result as { id: string };
        return { id: res.id, success: true };
      }

      case 'createChannel': {
        const { guildId, channelName, channelType } = ctx.input;
        if (!guildId || !channelName) throw new Error('guildId and channelName are required for action "createChannel"');
        const result = await ctx.integrate('discord', 'createChannel', {
          connectionId,
          guildId,
          name: channelName,
          type: channelType ?? 0,
        });
        const res = result as { id: string };
        return { id: res.id, success: true };
      }

      case 'addRole': {
        const { guildId, userId, roleId } = ctx.input;
        if (!guildId || !userId || !roleId) throw new Error('guildId, userId, and roleId are required for action "addRole"');
        await ctx.integrate('discord', 'addRole', {
          connectionId,
          guildId,
          userId,
          roleId,
        });
        return { success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
