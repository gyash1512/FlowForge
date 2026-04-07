import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum([
    'triggerPipeline',
    'getJobDetails',
    'getArtifacts',
    'listPipelines',
    'createEnvVar',
  ]),
  projectSlug: z.string().optional(),
  branch: z.string().optional(),
  parameters: z.record(z.unknown()).optional(),
  jobNumber: z.number().int().optional(),
  pipelineId: z.string().optional(),
  name: z.string().optional(),
  value: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('CircleCI integration connection identifier'),
});

export const circleciNode = defineNode({
  name: 'communication/circleci',
  version: '0.1.0',
  description: 'Trigger pipelines, inspect jobs, and manage environment variables on CircleCI',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['circleci', 'ci', 'devops'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'triggerPipeline': {
        const { projectSlug, branch, parameters } = input;
        if (!projectSlug) throw new Error('projectSlug is required for action "triggerPipeline"');
        const data = await ctx.integrate('circleci', 'triggerPipeline', {
          connectionId,
          projectSlug,
          branch,
          parameters,
        });
        return { data, success: true };
      }

      case 'getJobDetails': {
        const { projectSlug, jobNumber } = input;
        if (!projectSlug || !jobNumber)
          throw new Error('projectSlug and jobNumber are required for action "getJobDetails"');
        const data = await ctx.integrate('circleci', 'getJobDetails', {
          connectionId,
          projectSlug,
          jobNumber,
        });
        return { data, success: true };
      }

      case 'getArtifacts': {
        const { projectSlug, jobNumber } = input;
        if (!projectSlug || !jobNumber)
          throw new Error('projectSlug and jobNumber are required for action "getArtifacts"');
        const data = await ctx.integrate('circleci', 'getArtifacts', {
          connectionId,
          projectSlug,
          jobNumber,
        });
        return { data, success: true };
      }

      case 'listPipelines': {
        const { projectSlug } = input;
        if (!projectSlug) throw new Error('projectSlug is required for action "listPipelines"');
        const data = await ctx.integrate('circleci', 'listPipelines', {
          connectionId,
          projectSlug,
        });
        return { data, success: true };
      }

      case 'createEnvVar': {
        const { projectSlug, name, value } = input;
        if (!projectSlug || !name || !value)
          throw new Error('projectSlug, name, and value are required for action "createEnvVar"');
        const data = await ctx.integrate('circleci', 'createEnvVar', {
          connectionId,
          projectSlug,
          name,
          value,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
