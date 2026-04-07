import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum(['addDeal', 'addPerson', 'addOrganization', 'addNote', 'addActivity']),
  title: z.string().optional(),
  value: z.number().optional(),
  currency: z.string().optional(),
  personId: z.number().int().optional(),
  orgId: z.number().int().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  content: z.string().optional(),
  dealId: z.number().int().optional(),
  type: z.string().optional(),
  subject: z.string().optional(),
  dueDate: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Pipedrive integration connection identifier'),
});

export const pipedriveNode = defineNode({
  name: 'communication/pipedrive',
  version: '0.1.0',
  description: 'Add deals, persons, organizations, notes, and activities in Pipedrive',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['pipedrive', 'crm', 'sales'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'addDeal': {
        const { title, value, currency, personId, orgId } = input;
        if (!title) throw new Error('title is required for action "addDeal"');
        const data = await ctx.integrate('pipedrive', 'addDeal', {
          connectionId,
          title,
          value,
          currency,
          personId,
          orgId,
        });
        return { data, success: true };
      }

      case 'addPerson': {
        const { name, email, phone, orgId } = input;
        if (!name) throw new Error('name is required for action "addPerson"');
        const data = await ctx.integrate('pipedrive', 'addPerson', {
          connectionId,
          name,
          email,
          phone,
          orgId,
        });
        return { data, success: true };
      }

      case 'addOrganization': {
        const { name } = input;
        if (!name) throw new Error('name is required for action "addOrganization"');
        const data = await ctx.integrate('pipedrive', 'addOrganization', {
          connectionId,
          name,
        });
        return { data, success: true };
      }

      case 'addNote': {
        const { content, dealId, personId, orgId } = input;
        if (!content) throw new Error('content is required for action "addNote"');
        const data = await ctx.integrate('pipedrive', 'addNote', {
          connectionId,
          content,
          dealId,
          personId,
          orgId,
        });
        return { data, success: true };
      }

      case 'addActivity': {
        const { type, subject, dueDate, dealId, personId, orgId } = input;
        if (!type || !subject)
          throw new Error('type and subject are required for action "addActivity"');
        const data = await ctx.integrate('pipedrive', 'addActivity', {
          connectionId,
          type,
          subject,
          dueDate,
          dealId,
          personId,
          orgId,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
