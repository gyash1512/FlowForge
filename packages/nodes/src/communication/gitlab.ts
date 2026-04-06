import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum([
    'createIssue',
    'createBranch',
    'getMergeRequest',
    'createProject',
    'createGroup',
  ]),
  projectId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  branchName: z.string().optional(),
  ref: z.string().optional(),
  mergeRequestIid: z.number().int().optional(),
  name: z.string().optional(),
  path: z.string().optional(),
  visibility: z.enum(['private', 'internal', 'public']).optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('GitLab integration connection identifier'),
});

export const gitlabNode = defineNode({
  name: 'communication/gitlab',
  version: '0.1.0',
  description: 'Create issues, branches, merge requests, projects, and groups on GitLab',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['gitlab', 'git', 'devops'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createIssue': {
        const { projectId, title, description } = input;
        if (!projectId || !title)
          throw new Error('projectId and title are required for action "createIssue"');
        const data = await ctx.integrate('gitlab', 'createIssue', {
          connectionId,
          projectId,
          title,
          description,
        });
        return { data, success: true };
      }

      case 'createBranch': {
        const { projectId, branchName, ref } = input;
        if (!projectId || !branchName || !ref)
          throw new Error('projectId, branchName, and ref are required for action "createBranch"');
        const data = await ctx.integrate('gitlab', 'createBranch', {
          connectionId,
          projectId,
          branchName,
          ref,
        });
        return { data, success: true };
      }

      case 'getMergeRequest': {
        const { projectId, mergeRequestIid } = input;
        if (!projectId || !mergeRequestIid)
          throw new Error(
            'projectId and mergeRequestIid are required for action "getMergeRequest"',
          );
        const data = await ctx.integrate('gitlab', 'getMergeRequest', {
          connectionId,
          projectId,
          mergeRequestIid,
        });
        return { data, success: true };
      }

      case 'createProject': {
        const { name, path, description, visibility } = input;
        if (!name) throw new Error('name is required for action "createProject"');
        const data = await ctx.integrate('gitlab', 'createProject', {
          connectionId,
          name,
          path: path ?? name,
          description,
          visibility: visibility ?? 'private',
        });
        return { data, success: true };
      }

      case 'createGroup': {
        const { name, path, visibility } = input;
        if (!name) throw new Error('name is required for action "createGroup"');
        const data = await ctx.integrate('gitlab', 'createGroup', {
          connectionId,
          name,
          path: path ?? name,
          visibility: visibility ?? 'private',
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
