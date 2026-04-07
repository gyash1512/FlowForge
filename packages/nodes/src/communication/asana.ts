import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum(['createTask', 'createProject', 'addComment', 'getTask', 'createSubtask']),
  workspaceId: z.string().optional(),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  name: z.string().optional(),
  notes: z.string().optional(),
  assignee: z.string().optional(),
  parentTaskId: z.string().optional(),
  comment: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Asana integration connection identifier'),
});

export const asanaNode = defineNode({
  name: 'communication/asana',
  version: '0.1.0',
  description: 'Create tasks, projects, subtasks, and add comments via Asana',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['asana', 'project-management', 'tasks'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createTask': {
        const { workspaceId, projectId, name, notes, assignee } = input;
        if (!name) throw new Error('name is required for action "createTask"');
        const data = await ctx.integrate('asana', 'createTask', {
          connectionId,
          workspaceId,
          projectId,
          name,
          notes,
          assignee,
        });
        return { data, success: true };
      }

      case 'createProject': {
        const { workspaceId, name, notes } = input;
        if (!workspaceId || !name)
          throw new Error('workspaceId and name are required for action "createProject"');
        const data = await ctx.integrate('asana', 'createProject', {
          connectionId,
          workspaceId,
          name,
          notes,
        });
        return { data, success: true };
      }

      case 'addComment': {
        const { taskId, comment } = input;
        if (!taskId || !comment)
          throw new Error('taskId and comment are required for action "addComment"');
        const data = await ctx.integrate('asana', 'addComment', {
          connectionId,
          taskId,
          comment,
        });
        return { data, success: true };
      }

      case 'getTask': {
        const { taskId } = input;
        if (!taskId) throw new Error('taskId is required for action "getTask"');
        const data = await ctx.integrate('asana', 'getTask', {
          connectionId,
          taskId,
        });
        return { data, success: true };
      }

      case 'createSubtask': {
        const { parentTaskId, name, notes, assignee } = input;
        if (!parentTaskId || !name)
          throw new Error('parentTaskId and name are required for action "createSubtask"');
        const data = await ctx.integrate('asana', 'createSubtask', {
          connectionId,
          parentTaskId,
          name,
          notes,
          assignee,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
