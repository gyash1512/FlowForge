import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['createTicket', 'updateTicket', 'replyTicket', 'listTickets', 'search']),
  subject: z.string().optional(),
  description: z.string().optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
  ticketId: z.string().optional(),
  comment: z.string().optional(),
  query: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Zendesk integration connection identifier'),
});

export const zendeskNode = defineNode({
  name: 'communication/zendesk',
  version: '0.1.0',
  description: 'Create, update, reply to, list, and search tickets via Zendesk',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['zendesk', 'support', 'tickets'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createTicket': {
        const { subject, description, priority } = input;
        if (!subject) throw new Error('subject is required for action "createTicket"');
        const data = await ctx.integrate('zendesk', 'createTicket', {
          connectionId,
          subject,
          description,
          priority,
        });
        return { data, success: true };
      }

      case 'updateTicket': {
        const { ticketId, status, priority, subject, description } = input;
        if (!ticketId) throw new Error('ticketId is required for action "updateTicket"');
        const data = await ctx.integrate('zendesk', 'updateTicket', {
          connectionId,
          ticketId,
          status,
          priority,
          subject,
          description,
        });
        return { data, success: true };
      }

      case 'replyTicket': {
        const { ticketId, comment } = input;
        if (!ticketId || !comment)
          throw new Error('ticketId and comment are required for action "replyTicket"');
        const data = await ctx.integrate('zendesk', 'replyTicket', {
          connectionId,
          ticketId,
          comment,
        });
        return { data, success: true };
      }

      case 'listTickets': {
        const { status } = input;
        const data = await ctx.integrate('zendesk', 'listTickets', {
          connectionId,
          status,
        });
        return { data, success: true };
      }

      case 'search': {
        const { query } = input;
        if (!query) throw new Error('query is required for action "search"');
        const data = await ctx.integrate('zendesk', 'search', {
          connectionId,
          query,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
