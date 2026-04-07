import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum(['createPR', 'createIssue', 'createBranch', 'approvePR', 'createRepo']),
  workspace: z.string().optional(),
  repoSlug: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  sourceBranch: z.string().optional(),
  destinationBranch: z.string().optional(),
  pullRequestId: z.number().int().optional(),
  branchName: z.string().optional(),
  hash: z.string().optional(),
  projectKey: z.string().optional(),
  isPrivate: z.boolean().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Bitbucket integration connection identifier'),
});

export const bitbucketNode = defineNode({
  name: 'communication/bitbucket',
  version: '0.1.0',
  description: 'Create pull requests, issues, branches, and repositories on Bitbucket',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['bitbucket', 'git', 'devops'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createPR': {
        const { workspace, repoSlug, title, description, sourceBranch, destinationBranch } = input;
        if (!workspace || !repoSlug || !title || !sourceBranch || !destinationBranch)
          throw new Error(
            'workspace, repoSlug, title, sourceBranch, and destinationBranch are required for action "createPR"',
          );
        const data = await ctx.integrate('bitbucket', 'createPR', {
          connectionId,
          workspace,
          repoSlug,
          title,
          description,
          sourceBranch,
          destinationBranch,
        });
        return { data, success: true };
      }

      case 'createIssue': {
        const { workspace, repoSlug, title, description } = input;
        if (!workspace || !repoSlug || !title)
          throw new Error('workspace, repoSlug, and title are required for action "createIssue"');
        const data = await ctx.integrate('bitbucket', 'createIssue', {
          connectionId,
          workspace,
          repoSlug,
          title,
          description,
        });
        return { data, success: true };
      }

      case 'createBranch': {
        const { workspace, repoSlug, branchName, hash } = input;
        if (!workspace || !repoSlug || !branchName || !hash)
          throw new Error(
            'workspace, repoSlug, branchName, and hash are required for action "createBranch"',
          );
        const data = await ctx.integrate('bitbucket', 'createBranch', {
          connectionId,
          workspace,
          repoSlug,
          branchName,
          hash,
        });
        return { data, success: true };
      }

      case 'approvePR': {
        const { workspace, repoSlug, pullRequestId } = input;
        if (!workspace || !repoSlug || !pullRequestId)
          throw new Error(
            'workspace, repoSlug, and pullRequestId are required for action "approvePR"',
          );
        const data = await ctx.integrate('bitbucket', 'approvePR', {
          connectionId,
          workspace,
          repoSlug,
          pullRequestId,
        });
        return { data, success: true };
      }

      case 'createRepo': {
        const { workspace, repoSlug, projectKey, isPrivate, description } = input;
        if (!workspace || !repoSlug)
          throw new Error('workspace and repoSlug are required for action "createRepo"');
        const data = await ctx.integrate('bitbucket', 'createRepo', {
          connectionId,
          workspace,
          repoSlug,
          projectKey,
          isPrivate: isPrivate ?? true,
          description,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
