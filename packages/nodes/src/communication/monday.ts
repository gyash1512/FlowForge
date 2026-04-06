import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['createItem', 'createBoard', 'createUpdate', 'listItems', 'moveItem']),
  boardId: z.string().optional(),
  groupId: z.string().optional(),
  itemName: z.string().optional(),
  columnValues: z.record(z.unknown()).optional(),
  boardName: z.string().optional(),
  itemId: z.string().optional(),
  body: z.string().optional(),
  targetGroupId: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Monday.com integration connection identifier'),
});

export const mondayNode = defineNode({
  name: 'communication/monday',
  version: '0.1.0',
  description: 'Create items, boards, and updates, list items, and move items on Monday.com',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['monday', 'project-management', 'productivity'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createItem': {
        const { boardId, groupId, itemName, columnValues } = input;
        if (!boardId || !itemName)
          throw new Error('boardId and itemName are required for action "createItem"');
        const data = await ctx.integrate('monday', 'createItem', {
          connectionId,
          boardId,
          groupId,
          itemName,
          columnValues,
        });
        return { data, success: true };
      }

      case 'createBoard': {
        const { boardName } = input;
        if (!boardName) throw new Error('boardName is required for action "createBoard"');
        const data = await ctx.integrate('monday', 'createBoard', {
          connectionId,
          boardName,
        });
        return { data, success: true };
      }

      case 'createUpdate': {
        const { itemId, body } = input;
        if (!itemId || !body)
          throw new Error('itemId and body are required for action "createUpdate"');
        const data = await ctx.integrate('monday', 'createUpdate', {
          connectionId,
          itemId,
          body,
        });
        return { data, success: true };
      }

      case 'listItems': {
        const { boardId } = input;
        if (!boardId) throw new Error('boardId is required for action "listItems"');
        const data = await ctx.integrate('monday', 'listItems', {
          connectionId,
          boardId,
        });
        return { data, success: true };
      }

      case 'moveItem': {
        const { itemId, targetGroupId } = input;
        if (!itemId || !targetGroupId)
          throw new Error('itemId and targetGroupId are required for action "moveItem"');
        const data = await ctx.integrate('monday', 'moveItem', {
          connectionId,
          itemId,
          targetGroupId,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
