import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['sendEmail', 'addContact', 'createList', 'addToList', 'getStats']),
  to: z.union([z.string(), z.array(z.string())]).optional(),
  from: z.string().optional(),
  subject: z.string().optional(),
  html: z.string().optional(),
  text: z.string().optional(),
  email: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  listName: z.string().optional(),
  listId: z.string().optional(),
  contactId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('SendGrid integration connection identifier'),
});

export const sendgridNode = defineNode({
  name: 'communication/sendgrid',
  version: '0.1.0',
  description: 'Send emails, manage contacts and lists, and retrieve stats via SendGrid',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['sendgrid', 'email', 'marketing'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'sendEmail': {
        const { to, from, subject, html, text } = input;
        if (!to) throw new Error('to is required for action "sendEmail"');
        if (!from) throw new Error('from is required for action "sendEmail"');
        if (!subject) throw new Error('subject is required for action "sendEmail"');
        if (!html && !text) throw new Error('html or text is required for action "sendEmail"');
        const data = await ctx.integrate('sendgrid', 'sendEmail', {
          connectionId,
          to,
          from,
          subject,
          html,
          text,
        });
        return { data, success: true };
      }

      case 'addContact': {
        const { email, firstName, lastName } = input;
        if (!email) throw new Error('email is required for action "addContact"');
        const data = await ctx.integrate('sendgrid', 'addContact', {
          connectionId,
          email,
          firstName,
          lastName,
        });
        return { data, success: true };
      }

      case 'createList': {
        const { listName } = input;
        if (!listName) throw new Error('listName is required for action "createList"');
        const data = await ctx.integrate('sendgrid', 'createList', {
          connectionId,
          listName,
        });
        return { data, success: true };
      }

      case 'addToList': {
        const { listId, contactId } = input;
        if (!listId) throw new Error('listId is required for action "addToList"');
        if (!contactId) throw new Error('contactId is required for action "addToList"');
        const data = await ctx.integrate('sendgrid', 'addToList', {
          connectionId,
          listId,
          contactId,
        });
        return { data, success: true };
      }

      case 'getStats': {
        const { startDate, endDate } = input;
        if (!startDate) throw new Error('startDate is required for action "getStats"');
        const data = await ctx.integrate('sendgrid', 'getStats', {
          connectionId,
          startDate,
          endDate,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
