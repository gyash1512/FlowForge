import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['createDeployment', 'addEnvVariable', 'addDomain', 'checkDomain']),
  projectId: z.string().optional(),
  name: z.string().optional(),
  gitSource: z.record(z.unknown()).optional(),
  key: z.string().optional(),
  value: z.string().optional(),
  target: z.enum(['production', 'preview', 'development']).optional(),
  domain: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Vercel integration connection identifier'),
});

export const vercelNode = defineNode({
  name: 'communication/vercel',
  version: '0.1.0',
  description: 'Create deployments, manage environment variables, and configure domains on Vercel',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['vercel', 'deployment', 'hosting'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createDeployment': {
        const { projectId, name, gitSource } = input;
        if (!projectId) throw new Error('projectId is required for action "createDeployment"');
        const data = await ctx.integrate('vercel', 'createDeployment', {
          connectionId,
          projectId,
          name,
          gitSource,
        });
        return { data, success: true };
      }

      case 'addEnvVariable': {
        const { projectId, key, value, target } = input;
        if (!projectId || !key || !value)
          throw new Error('projectId, key, and value are required for action "addEnvVariable"');
        const data = await ctx.integrate('vercel', 'addEnvVariable', {
          connectionId,
          projectId,
          key,
          value,
          target: target ?? 'production',
        });
        return { data, success: true };
      }

      case 'addDomain': {
        const { projectId, domain } = input;
        if (!projectId || !domain)
          throw new Error('projectId and domain are required for action "addDomain"');
        const data = await ctx.integrate('vercel', 'addDomain', {
          connectionId,
          projectId,
          domain,
        });
        return { data, success: true };
      }

      case 'checkDomain': {
        const { domain } = input;
        if (!domain) throw new Error('domain is required for action "checkDomain"');
        const data = await ctx.integrate('vercel', 'checkDomain', {
          connectionId,
          domain,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
