import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum(['addCard', 'addBoard', 'addComment', 'addList', 'createWebhook']),
  listId: z.string().optional(),
  boardId: z.string().optional(),
  cardId: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  comment: z.string().optional(),
  callbackUrl: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Trello integration connection identifier'),
});

export const trelloNode = defineNode({
  name: 'communication/trello',
  version: '0.1.0',
  description: 'Add cards, boards, lists, comments, and create webhooks via Trello',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['trello', 'project-management', 'boards'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'addCard': {
        const { listId, name, description } = input;
        if (!listId || !name) throw new Error('listId and name are required for action "addCard"');
        const data = await ctx.integrate('trello', 'addCard', {
          connectionId,
          listId,
          name,
          description,
        });
        return { data, success: true };
      }

      case 'addBoard': {
        const { name, description } = input;
        if (!name) throw new Error('name is required for action "addBoard"');
        const data = await ctx.integrate('trello', 'addBoard', {
          connectionId,
          name,
          description,
        });
        return { data, success: true };
      }

      case 'addComment': {
        const { cardId, comment } = input;
        if (!cardId || !comment)
          throw new Error('cardId and comment are required for action "addComment"');
        const data = await ctx.integrate('trello', 'addComment', {
          connectionId,
          cardId,
          comment,
        });
        return { data, success: true };
      }

      case 'addList': {
        const { boardId, name } = input;
        if (!boardId || !name)
          throw new Error('boardId and name are required for action "addList"');
        const data = await ctx.integrate('trello', 'addList', {
          connectionId,
          boardId,
          name,
        });
        return { data, success: true };
      }

      case 'createWebhook': {
        const { callbackUrl, boardId } = input;
        if (!callbackUrl || !boardId)
          throw new Error('callbackUrl and boardId are required for action "createWebhook"');
        const data = await ctx.integrate('trello', 'createWebhook', {
          connectionId,
          callbackUrl,
          idModel: boardId,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
