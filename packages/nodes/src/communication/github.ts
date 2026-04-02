import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['createIssue', 'createPR', 'addComment', 'createRelease']),
  owner: z.string(),
  repo: z.string(),
  title: z.string().optional(),
  body: z.string().optional(),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
  head: z.string().optional(),
  base: z.string().optional(),
  draft: z.boolean().optional(),
  issueNumber: z.number().int().optional(),
  prNumber: z.number().int().optional(),
  comment: z.string().optional(),
  tagName: z.string().optional(),
  releaseName: z.string().optional(),
  prerelease: z.boolean().optional(),
  generateReleaseNotes: z.boolean().optional(),
});

const outputSchema = z.object({
  id: z.number().optional(),
  number: z.number().optional(),
  url: z.string().optional(),
  nodeId: z.string().optional(),
});

const configSchema = z.object({
  connectionId: z.string().describe('GitHub integration connection identifier'),
});

export const githubNode = defineNode({
  name: 'communication/github',
  version: '0.1.0',
  description: 'Create issues, pull requests, comments, and releases on GitHub',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['github', 'git', 'devops'],

  handler: async (ctx) => {
    const { action, owner, repo } = ctx.input;
    const { connectionId } = ctx.config;

    switch (action) {
      case 'createIssue': {
        const { title, body, labels, assignees } = ctx.input;
        if (!title) throw new Error('title is required for action "createIssue"');
        const result = await ctx.integrate('github', 'createIssue', {
          connectionId,
          owner,
          repo,
          title,
          body,
          labels,
          assignees,
        });
        const res = result as { id: number; number: number; html_url: string; node_id: string };
        return { id: res.id, number: res.number, url: res.html_url, nodeId: res.node_id };
      }

      case 'createPR': {
        const { title, body, head, base, draft, labels } = ctx.input;
        if (!title || !head || !base) throw new Error('title, head, and base are required for action "createPR"');
        const result = await ctx.integrate('github', 'createPR', {
          connectionId,
          owner,
          repo,
          title,
          body,
          head,
          base,
          draft: draft ?? false,
          labels,
        });
        const res = result as { id: number; number: number; html_url: string; node_id: string };
        return { id: res.id, number: res.number, url: res.html_url, nodeId: res.node_id };
      }

      case 'addComment': {
        const { issueNumber, prNumber, comment } = ctx.input;
        const targetNumber = issueNumber ?? prNumber;
        if (!targetNumber || !comment) throw new Error('issueNumber/prNumber and comment are required for action "addComment"');
        const result = await ctx.integrate('github', 'addComment', {
          connectionId,
          owner,
          repo,
          issueNumber: targetNumber,
          body: comment,
        });
        const res = result as { id: number; html_url: string; node_id: string };
        return { id: res.id, url: res.html_url, nodeId: res.node_id };
      }

      case 'createRelease': {
        const { tagName, releaseName, body, prerelease, generateReleaseNotes } = ctx.input;
        if (!tagName) throw new Error('tagName is required for action "createRelease"');
        const result = await ctx.integrate('github', 'createRelease', {
          connectionId,
          owner,
          repo,
          tagName,
          name: releaseName ?? tagName,
          body,
          prerelease: prerelease ?? false,
          generateReleaseNotes: generateReleaseNotes ?? false,
        });
        const res = result as { id: number; html_url: string; node_id: string };
        return { id: res.id, url: res.html_url, nodeId: res.node_id };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
