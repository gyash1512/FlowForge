import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['archiveContact', 'archiveDeal', 'createTicket', 'readCompanies', 'cloneEmail']),
  contactId: z.string().optional(),
  dealId: z.string().optional(),
  subject: z.string().optional(),
  content: z.string().optional(),
  properties: z.record(z.unknown()).optional(),
  emailId: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('HubSpot integration connection identifier'),
});

export const hubspotNode = defineNode({
  name: 'communication/hubspot',
  version: '0.1.0',
  description:
    'Archive contacts and deals, create tickets, read companies, and clone emails via HubSpot',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['hubspot', 'crm', 'marketing'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'archiveContact': {
        const { contactId } = input;
        if (!contactId) throw new Error('contactId is required for action "archiveContact"');
        const data = await ctx.integrate('hubspot', 'archiveContact', {
          connectionId,
          contactId,
        });
        return { data, success: true };
      }

      case 'archiveDeal': {
        const { dealId } = input;
        if (!dealId) throw new Error('dealId is required for action "archiveDeal"');
        const data = await ctx.integrate('hubspot', 'archiveDeal', {
          connectionId,
          dealId,
        });
        return { data, success: true };
      }

      case 'createTicket': {
        const { subject, content, properties } = input;
        if (!subject) throw new Error('subject is required for action "createTicket"');
        const data = await ctx.integrate('hubspot', 'createTicket', {
          connectionId,
          subject,
          content,
          properties,
        });
        return { data, success: true };
      }

      case 'readCompanies': {
        const { properties } = input;
        const data = await ctx.integrate('hubspot', 'readCompanies', {
          connectionId,
          properties,
        });
        return { data, success: true };
      }

      case 'cloneEmail': {
        const { emailId } = input;
        if (!emailId) throw new Error('emailId is required for action "cloneEmail"');
        const data = await ctx.integrate('hubspot', 'cloneEmail', {
          connectionId,
          emailId,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
