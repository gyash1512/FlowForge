import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['sendMessage', 'updateMessage', 'addReaction', 'createChannel', 'listUsers']),
  channel: z.string().optional(),
  text: z.string().optional(),
  blocks: z.array(z.record(z.unknown())).optional(),
  ts: z.string().optional(),
  emoji: z.string().optional(),
  channelName: z.string().optional(),
  isPrivate: z.boolean().optional(),
});

const outputSchema = z.object({
  ok: z.boolean(),
  ts: z.string().optional(),
  channel: z.string().optional(),
  users: z.array(z.record(z.unknown())).optional(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Slack integration connection identifier'),
});

export const slackNode = defineNode({
  name: 'communication/slack',
  version: '0.1.0',
  description: 'Send messages, react, create channels, and list users via Slack',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['slack', 'messaging', 'chat'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'sendMessage': {
        const { channel, text, blocks } = input;
        if (!channel) throw new Error('channel is required for action "sendMessage"');
        const result = await ctx.integrate('slack', 'sendMessage', {
          connectionId,
          channel,
          text,
          blocks,
        });
        const res = result as { ok: boolean; ts: string; channel: string };
        return { ok: res.ok, ts: res.ts, channel: res.channel };
      }

      case 'updateMessage': {
        const { channel, text, ts, blocks } = input;
        if (!channel || !ts) throw new Error('channel and ts are required for action "updateMessage"');
        const result = await ctx.integrate('slack', 'updateMessage', {
          connectionId,
          channel,
          text,
          ts,
          blocks,
        });
        const res = result as { ok: boolean; ts: string; channel: string };
        return { ok: res.ok, ts: res.ts, channel: res.channel };
      }

      case 'addReaction': {
        const { channel, ts, emoji } = input;
        if (!channel || !ts || !emoji) throw new Error('channel, ts, and emoji are required for action "addReaction"');
        const result = await ctx.integrate('slack', 'addReaction', {
          connectionId,
          channel,
          timestamp: ts,
          name: emoji,
        });
        const res = result as { ok: boolean };
        return { ok: res.ok };
      }

      case 'createChannel': {
        const { channelName, isPrivate } = input;
        if (!channelName) throw new Error('channelName is required for action "createChannel"');
        const result = await ctx.integrate('slack', 'createChannel', {
          connectionId,
          name: channelName,
          isPrivate: isPrivate ?? false,
        });
        const res = result as { ok: boolean; channel: string };
        return { ok: res.ok, channel: res.channel };
      }

      case 'listUsers': {
        const result = await ctx.integrate('slack', 'listUsers', { connectionId });
        const res = result as { ok: boolean; members: Record<string, unknown>[] };
        return { ok: res.ok, users: res.members };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
