import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['createIssue', 'editIssue', 'addComment', 'assignIssue', 'getIssue']),
  projectKey: z.string().optional(),
  issueType: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  assignee: z.string().optional(),
  issueKey: z.string().optional(),
  comment: z.string().optional(),
  priority: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Jira integration connection identifier'),
});

export const jiraNode = defineNode({
  name: 'communication/jira',
  version: '0.1.0',
  description: 'Create issues, add comments, assign tasks, and manage projects via Jira',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['jira', 'project-management', 'issues'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createIssue': {
        const { projectKey, issueType, summary, description, assignee, priority } = input;
        if (!projectKey || !summary)
          throw new Error('projectKey and summary are required for action "createIssue"');
        const data = await ctx.integrate('jira', 'createIssue', {
          connectionId,
          projectKey,
          issueType,
          summary,
          description,
          assignee,
          priority,
        });
        return { data, success: true };
      }

      case 'editIssue': {
        const { issueKey, summary, description, assignee, priority, issueType } = input;
        if (!issueKey) throw new Error('issueKey is required for action "editIssue"');
        const data = await ctx.integrate('jira', 'editIssue', {
          connectionId,
          issueKey,
          summary,
          description,
          assignee,
          priority,
          issueType,
        });
        return { data, success: true };
      }

      case 'addComment': {
        const { issueKey, comment } = input;
        if (!issueKey || !comment)
          throw new Error('issueKey and comment are required for action "addComment"');
        const data = await ctx.integrate('jira', 'addComment', {
          connectionId,
          issueKey,
          comment,
        });
        return { data, success: true };
      }

      case 'assignIssue': {
        const { issueKey, assignee } = input;
        if (!issueKey || !assignee)
          throw new Error('issueKey and assignee are required for action "assignIssue"');
        const data = await ctx.integrate('jira', 'assignIssue', {
          connectionId,
          issueKey,
          assignee,
        });
        return { data, success: true };
      }

      case 'getIssue': {
        const { issueKey } = input;
        if (!issueKey) throw new Error('issueKey is required for action "getIssue"');
        const data = await ctx.integrate('jira', 'getIssue', {
          connectionId,
          issueKey,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
