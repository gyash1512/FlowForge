import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['sendMessage', 'sendTemplate', 'sendMedia', 'getProfile', 'markRead']),
  to: z.string(),
  text: z.string().optional(),
  templateName: z.string().optional(),
  language: z.string().optional(),
  mediaUrl: z.string().optional(),
  mediaType: z.string().optional(),
  caption: z.string().optional(),
  messageId: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('WhatsApp integration connection identifier'),
});

export const whatsappNode = defineNode({
  name: 'communication/whatsapp',
  version: '0.1.0',
  description:
    'Send messages, templates, media, retrieve profiles, and mark messages as read via WhatsApp',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['whatsapp', 'messaging', 'meta'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action, to } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'sendMessage': {
        const { text } = input;
        if (!text) throw new Error('text is required for action "sendMessage"');
        const data = await ctx.integrate('whatsapp', 'sendMessage', {
          connectionId,
          to,
          text,
        });
        return { data, success: true };
      }

      case 'sendTemplate': {
        const { templateName, language } = input;
        if (!templateName) throw new Error('templateName is required for action "sendTemplate"');
        const data = await ctx.integrate('whatsapp', 'sendTemplate', {
          connectionId,
          to,
          templateName,
          language: language ?? 'en',
        });
        return { data, success: true };
      }

      case 'sendMedia': {
        const { mediaUrl, mediaType, caption } = input;
        if (!mediaUrl || !mediaType)
          throw new Error('mediaUrl and mediaType are required for action "sendMedia"');
        const data = await ctx.integrate('whatsapp', 'sendMedia', {
          connectionId,
          to,
          mediaUrl,
          mediaType,
          caption,
        });
        return { data, success: true };
      }

      case 'getProfile': {
        const data = await ctx.integrate('whatsapp', 'getProfile', {
          connectionId,
          to,
        });
        return { data, success: true };
      }

      case 'markRead': {
        const { messageId } = input;
        if (!messageId) throw new Error('messageId is required for action "markRead"');
        const data = await ctx.integrate('whatsapp', 'markRead', {
          connectionId,
          messageId,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
