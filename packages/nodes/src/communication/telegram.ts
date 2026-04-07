import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum(['sendMessage', 'sendPhoto', 'sendDocument']),
  chatId: z.union([z.string(), z.number()]),
  text: z.string().optional(),
  parseMode: z.enum(['HTML', 'Markdown', 'MarkdownV2']).optional(),
  photoUrl: z.string().optional(),
  documentUrl: z.string().optional(),
  caption: z.string().optional(),
  replyToMessageId: z.number().int().optional(),
});

const outputSchema = z.object({
  messageId: z.number(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Telegram bot connection identifier'),
});

export const telegramNode = defineNode({
  name: 'communication/telegram',
  version: '0.1.0',
  description: 'Send messages, photos, and documents via Telegram Bot API',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['telegram', 'messaging', 'bot'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action, chatId, replyToMessageId } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'sendMessage': {
        const { text, parseMode } = input;
        if (!text) throw new Error('text is required for action "sendMessage"');
        const result = await ctx.integrate('telegram', 'sendMessage', {
          connectionId,
          chatId,
          text,
          parseMode,
          replyToMessageId,
        });
        const res = result as { message_id: number };
        return { messageId: res.message_id, success: true };
      }

      case 'sendPhoto': {
        const { photoUrl, caption, parseMode } = input;
        if (!photoUrl) throw new Error('photoUrl is required for action "sendPhoto"');
        const result = await ctx.integrate('telegram', 'sendPhoto', {
          connectionId,
          chatId,
          photo: photoUrl,
          caption,
          parseMode,
          replyToMessageId,
        });
        const res = result as { message_id: number };
        return { messageId: res.message_id, success: true };
      }

      case 'sendDocument': {
        const { documentUrl, caption, parseMode } = input;
        if (!documentUrl) throw new Error('documentUrl is required for action "sendDocument"');
        const result = await ctx.integrate('telegram', 'sendDocument', {
          connectionId,
          chatId,
          document: documentUrl,
          caption,
          parseMode,
          replyToMessageId,
        });
        const res = result as { message_id: number };
        return { messageId: res.message_id, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
