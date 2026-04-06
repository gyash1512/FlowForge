import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum([
    'addNote',
    'createAgent',
    'addWatcher',
    'bulkUpdateTickets',
    'createCannedResponse',
  ]),
  ticketId: z.string().optional(),
  body: z.string().optional(),
  isPrivate: z.boolean().optional(),
  agentEmail: z.string().optional(),
  agentName: z.string().optional(),
  watcherEmail: z.string().optional(),
  ticketIds: z.array(z.string()).optional(),
  title: z.string().optional(),
  content: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Freshdesk integration connection identifier'),
});

export const freshdeskNode = defineNode({
  name: 'communication/freshdesk',
  version: '0.1.0',
  description:
    'Add notes, create agents, add watchers, bulk-update tickets, and create canned responses via Freshdesk',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['freshdesk', 'support', 'helpdesk'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'addNote': {
        const { ticketId, body, isPrivate } = input;
        if (!ticketId || !body)
          throw new Error('ticketId and body are required for action "addNote"');
        const data = await ctx.integrate('freshdesk', 'addNote', {
          connectionId,
          ticketId,
          body,
          isPrivate: isPrivate ?? false,
        });
        return { data, success: true };
      }

      case 'createAgent': {
        const { agentEmail, agentName } = input;
        if (!agentEmail) throw new Error('agentEmail is required for action "createAgent"');
        const data = await ctx.integrate('freshdesk', 'createAgent', {
          connectionId,
          email: agentEmail,
          name: agentName,
        });
        return { data, success: true };
      }

      case 'addWatcher': {
        const { ticketId, watcherEmail } = input;
        if (!ticketId || !watcherEmail)
          throw new Error('ticketId and watcherEmail are required for action "addWatcher"');
        const data = await ctx.integrate('freshdesk', 'addWatcher', {
          connectionId,
          ticketId,
          watcherEmail,
        });
        return { data, success: true };
      }

      case 'bulkUpdateTickets': {
        const { ticketIds } = input;
        if (!ticketIds || ticketIds.length === 0)
          throw new Error('ticketIds is required for action "bulkUpdateTickets"');
        const data = await ctx.integrate('freshdesk', 'bulkUpdateTickets', {
          connectionId,
          ticketIds,
        });
        return { data, success: true };
      }

      case 'createCannedResponse': {
        const { title, content } = input;
        if (!title || !content)
          throw new Error('title and content are required for action "createCannedResponse"');
        const data = await ctx.integrate('freshdesk', 'createCannedResponse', {
          connectionId,
          title,
          content,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
