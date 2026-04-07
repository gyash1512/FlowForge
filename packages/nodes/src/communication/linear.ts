import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum(['createIssue', 'updateIssue', 'searchIssues', 'createProject', 'listIssues']),
  teamId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  issueId: z.string().optional(),
  status: z.string().optional(),
  projectName: z.string().optional(),
  query: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Linear integration connection identifier'),
});

export const linearNode = defineNode({
  name: 'communication/linear',
  version: '0.1.0',
  description: 'Create and update issues, search, and manage projects via Linear',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['linear', 'project-management', 'issues'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createIssue': {
        const { teamId, title, description } = input;
        if (!teamId || !title)
          throw new Error('teamId and title are required for action "createIssue"');
        const data = await ctx.integrate('linear', 'createIssue', {
          connectionId,
          teamId,
          title,
          description,
        });
        return { data, success: true };
      }

      case 'updateIssue': {
        const { issueId, title, description, status } = input;
        if (!issueId) throw new Error('issueId is required for action "updateIssue"');
        const data = await ctx.integrate('linear', 'updateIssue', {
          connectionId,
          issueId,
          title,
          description,
          status,
        });
        return { data, success: true };
      }

      case 'searchIssues': {
        const { query, teamId } = input;
        if (!query) throw new Error('query is required for action "searchIssues"');
        const data = await ctx.integrate('linear', 'searchIssues', {
          connectionId,
          query,
          teamId,
        });
        return { data, success: true };
      }

      case 'createProject': {
        const { teamId, projectName, description } = input;
        if (!teamId || !projectName)
          throw new Error('teamId and projectName are required for action "createProject"');
        const data = await ctx.integrate('linear', 'createProject', {
          connectionId,
          teamId,
          name: projectName,
          description,
        });
        return { data, success: true };
      }

      case 'listIssues': {
        const { teamId } = input;
        const data = await ctx.integrate('linear', 'listIssues', {
          connectionId,
          teamId,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
