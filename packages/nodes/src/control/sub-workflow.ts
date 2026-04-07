import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  workflowId: z.string().describe('Target workflow identifier'),
  data: z.unknown().optional().describe('Data to pass to the sub-workflow'),
  waitForCompletion: z
    .boolean()
    .default(false)
    .describe('Whether to wait for the sub-workflow to complete'),
});

const outputSchema = z.object({
  emitted: z.boolean(),
  workflowId: z.string(),
  result: z.unknown().optional(),
});

const configSchema = z.object({
  eventPrefix: z
    .string()
    .default('workflow:trigger')
    .describe('Event prefix for sub-workflow triggers'),
  timeout: z.number().int().default(300_000).describe('Timeout when waiting for completion (ms)'),
});

export const subWorkflowNode = defineNode({
  name: 'control/sub-workflow',
  version: '0.1.0',
  description: 'Trigger another workflow as a sub-workflow via event emission',
  category: 'control',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['control-flow', 'sub-workflow', 'orchestration'],

  handler: async (ctx) => {
    const { workflowId, data, waitForCompletion } = ctx.input as z.infer<typeof inputSchema>;
    const { eventPrefix, timeout } = ctx.config as z.infer<typeof configSchema>;

    const eventName = `${eventPrefix}:${workflowId}`;

    ctx.logger.info({ workflowId, eventName }, 'Triggering sub-workflow');

    await ctx.emit(eventName, { workflowId, data, parentRunId: ctx.metadata.runId });

    if (waitForCompletion) {
      const completionEvent = `${eventPrefix}:${workflowId}:completed`;
      ctx.logger.info({ completionEvent, timeout }, 'Waiting for sub-workflow completion');

      const result = await ctx.wait(completionEvent, { parentRunId: ctx.metadata.runId }, timeout);
      return { emitted: true, workflowId, result };
    }

    return { emitted: true, workflowId };
  },
});
