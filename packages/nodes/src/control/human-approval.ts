import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.string().describe('Description of the action that needs approval'),
  details: z.unknown().optional().describe('Detailed payload for the reviewer to inspect'),
  urgency: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  timeout: z.number().int().optional().describe('Override timeout in milliseconds'),
});

const outputSchema = z.object({
  approved: z.boolean(),
  approvedBy: z.string().optional(),
  reason: z.string().optional(),
  respondedAt: z.string(),
  timedOut: z.boolean(),
  originalAction: z.string(),
  details: z.unknown().optional(),
});

const configSchema = z.object({
  defaultTimeout: z
    .number()
    .int()
    .default(3_600_000)
    .describe('Default approval timeout in milliseconds (1 hour)'),
  autoApprove: z
    .boolean()
    .default(false)
    .describe('If true, skip approval and auto-approve (for testing/dev)'),
  autoReject: z
    .boolean()
    .default(false)
    .describe('If true, skip approval and auto-reject (for CI/headless)'),
});

export const humanApprovalNode = defineNode({
  name: 'control/human-approval',
  version: '0.1.0',
  description:
    'Pause workflow execution and wait for human approval before proceeding — supports timeout, auto-approve for dev, and auto-reject for CI',
  category: 'control',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['control-flow', 'hitl', 'human-in-the-loop', 'approval', 'safety'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const config = ctx.config as z.infer<typeof configSchema>;
    const { action, details, urgency } = input;

    // Auto-approve mode (dev/testing)
    if (config.autoApprove) {
      ctx.logger.info({ action }, 'Auto-approved (autoApprove=true)');
      return {
        approved: true,
        approvedBy: 'system:auto-approve',
        reason: 'Auto-approved via config',
        respondedAt: new Date().toISOString(),
        timedOut: false,
        originalAction: action,
        details,
      };
    }

    // Auto-reject mode (CI/headless)
    if (config.autoReject) {
      ctx.logger.info({ action }, 'Auto-rejected (autoReject=true)');
      return {
        approved: false,
        approvedBy: 'system:auto-reject',
        reason: 'Auto-rejected via config',
        respondedAt: new Date().toISOString(),
        timedOut: false,
        originalAction: action,
        details,
      };
    }

    const effectiveTimeout = input.timeout ?? config.defaultTimeout;

    // Emit approval request event for external systems to pick up
    await ctx.emit('human-approval.requested', {
      runId: ctx.metadata.runId,
      workflowId: ctx.metadata.workflowId,
      action,
      details,
      urgency,
      requestedAt: new Date().toISOString(),
      timeoutMs: effectiveTimeout,
    });

    // Checkpoint so we can resume after restart
    await ctx.checkpoint();

    ctx.logger.info({ action, urgency, timeout: effectiveTimeout }, 'Waiting for human approval');

    // Wait for the approval response event
    try {
      const response = (await ctx.wait(
        'human-approval.response',
        { runId: ctx.metadata.runId },
        effectiveTimeout,
      )) as { approved: boolean; approvedBy?: string; reason?: string } | null;

      if (!response) {
        ctx.logger.warn({ action }, 'Approval timed out — treating as rejected');
        return {
          approved: false,
          respondedAt: new Date().toISOString(),
          timedOut: true,
          originalAction: action,
          details,
        };
      }

      ctx.logger.info(
        { action, approved: response.approved, by: response.approvedBy },
        'Approval response received',
      );

      return {
        approved: response.approved,
        approvedBy: response.approvedBy,
        reason: response.reason,
        respondedAt: new Date().toISOString(),
        timedOut: false,
        originalAction: action,
        details,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes('timeout')) {
        ctx.logger.warn({ action }, 'Approval timed out');
        return {
          approved: false,
          respondedAt: new Date().toISOString(),
          timedOut: true,
          originalAction: action,
          details,
        };
      }
      throw err;
    }
  },
});
