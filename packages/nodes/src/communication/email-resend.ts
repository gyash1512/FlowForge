import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum(['send', 'batch', 'getStatus']),
  to: z.union([z.string(), z.array(z.string())]).optional(),
  subject: z.string().optional(),
  html: z.string().optional(),
  text: z.string().optional(),
  emails: z
    .array(
      z.object({
        to: z.union([z.string(), z.array(z.string())]),
        subject: z.string(),
        html: z.string().optional(),
        text: z.string().optional(),
      }),
    )
    .optional(),
  emailId: z.string().optional(),
  tags: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
});

const outputSchema = z.object({
  id: z.string().optional(),
  ids: z.array(z.string()).optional(),
  status: z.string().optional(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Resend API connection identifier'),
  from: z.string().describe('Default sender address'),
});

export const emailResendNode = defineNode({
  name: 'communication/email-resend',
  version: '0.1.0',
  description: 'Send transactional emails via Resend API',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['email', 'resend', 'transactional'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId, from } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'send': {
        const { to, subject, html, text, tags } = input;
        if (!to || !subject) throw new Error('to and subject are required for action "send"');
        const result = await ctx.integrate('resend', 'send', {
          connectionId,
          from,
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
          text,
          tags,
        });
        const res = result as { id: string };
        return { id: res.id };
      }

      case 'batch': {
        const { emails } = input;
        if (!emails?.length) throw new Error('emails array is required for action "batch"');
        const result = await ctx.integrate('resend', 'batch', {
          connectionId,
          emails: emails.map((e) => ({ ...e, from })),
        });
        const res = result as { ids: string[] };
        return { ids: res.ids };
      }

      case 'getStatus': {
        const { emailId } = input;
        if (!emailId) throw new Error('emailId is required for action "getStatus"');
        const result = await ctx.integrate('resend', 'getStatus', {
          connectionId,
          emailId,
        });
        const res = result as { status: string };
        return { status: res.status };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
