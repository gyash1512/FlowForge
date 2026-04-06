import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const attachmentSchema = z.object({
  filename: z.string(),
  content: z.string().describe('Base64-encoded content or URL'),
  contentType: z.string().optional(),
});

const inputSchema = z.object({
  to: z.union([z.string(), z.array(z.string())]),
  cc: z.union([z.string(), z.array(z.string())]).optional(),
  bcc: z.union([z.string(), z.array(z.string())]).optional(),
  subject: z.string(),
  html: z.string().optional(),
  text: z.string().optional(),
  attachments: z.array(attachmentSchema).optional(),
  replyTo: z.string().optional(),
});

const outputSchema = z.object({
  messageId: z.string(),
  accepted: z.array(z.string()),
  rejected: z.array(z.string()),
});

const configSchema = z.object({
  connectionId: z.string().describe('SMTP connection identifier'),
  from: z.string().describe('Default sender address'),
});

export const emailSmtpNode = defineNode({
  name: 'communication/email-smtp',
  version: '0.1.0',
  description: 'Send emails via SMTP with support for HTML, text, and attachments',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['email', 'smtp', 'notification'],

  handler: async (ctx) => {
    const { to, cc, bcc, subject, html, text, attachments, replyTo } = ctx.input as z.infer<
      typeof inputSchema
    >;
    const { connectionId, from } = ctx.config as z.infer<typeof configSchema>;

    if (!html && !text) throw new Error('Either html or text content is required');

    const result = await ctx.integrate('smtp', 'send', {
      connectionId,
      from,
      to: Array.isArray(to) ? to : [to],
      cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
      bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
      subject,
      html,
      text,
      attachments,
      replyTo,
    });

    const res = result as { messageId: string; accepted: string[]; rejected: string[] };
    return {
      messageId: res.messageId,
      accepted: res.accepted,
      rejected: res.rejected,
    };
  },
});
