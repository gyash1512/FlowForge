import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['createTimeEntry', 'createDoc', 'createChecklist', 'addTask', 'addTag']),
  listId: z.string().optional(),
  taskId: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  duration: z.number().optional(),
  startTime: z.number().optional(),
  content: z.string().optional(),
  tagName: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('ClickUp integration connection identifier'),
});

export const clickupNode = defineNode({
  name: 'communication/clickup',
  version: '0.1.0',
  description: 'Create time entries, docs, checklists, tasks, and tags in ClickUp',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['clickup', 'project-management', 'productivity'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createTimeEntry': {
        const { taskId, duration, startTime } = input;
        if (!taskId || !duration)
          throw new Error('taskId and duration are required for action "createTimeEntry"');
        const data = await ctx.integrate('clickup', 'createTimeEntry', {
          connectionId,
          taskId,
          duration,
          startTime,
        });
        return { data, success: true };
      }

      case 'createDoc': {
        const { listId, name, content } = input;
        if (!listId || !name)
          throw new Error('listId and name are required for action "createDoc"');
        const data = await ctx.integrate('clickup', 'createDoc', {
          connectionId,
          listId,
          name,
          content,
        });
        return { data, success: true };
      }

      case 'createChecklist': {
        const { taskId, name } = input;
        if (!taskId || !name)
          throw new Error('taskId and name are required for action "createChecklist"');
        const data = await ctx.integrate('clickup', 'createChecklist', {
          connectionId,
          taskId,
          name,
        });
        return { data, success: true };
      }

      case 'addTask': {
        const { listId, name, description } = input;
        if (!listId || !name) throw new Error('listId and name are required for action "addTask"');
        const data = await ctx.integrate('clickup', 'addTask', {
          connectionId,
          listId,
          name,
          description,
        });
        return { data, success: true };
      }

      case 'addTag': {
        const { taskId, tagName } = input;
        if (!taskId || !tagName)
          throw new Error('taskId and tagName are required for action "addTag"');
        const data = await ctx.integrate('clickup', 'addTag', {
          connectionId,
          taskId,
          tagName,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
