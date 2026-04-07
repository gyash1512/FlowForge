import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum(['createLead', 'createOpportunity', 'createContact', 'query', 'createAccount']),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  soqlQuery: z.string().optional(),
  accountName: z.string().optional(),
  opportunityName: z.string().optional(),
  stageName: z.string().optional(),
  amount: z.number().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Salesforce integration connection identifier'),
});

export const salesforceNode = defineNode({
  name: 'communication/salesforce',
  version: '0.1.0',
  description: 'Create leads, contacts, opportunities, accounts, and run queries via Salesforce',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['salesforce', 'crm', 'sales'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createLead': {
        const { firstName, lastName, email, company, phone } = input;
        if (!lastName || !company)
          throw new Error('lastName and company are required for action "createLead"');
        const data = await ctx.integrate('salesforce', 'createLead', {
          connectionId,
          firstName,
          lastName,
          email,
          company,
          phone,
        });
        return { data, success: true };
      }

      case 'createOpportunity': {
        const { opportunityName, stageName, amount } = input;
        if (!opportunityName || !stageName)
          throw new Error(
            'opportunityName and stageName are required for action "createOpportunity"',
          );
        const data = await ctx.integrate('salesforce', 'createOpportunity', {
          connectionId,
          name: opportunityName,
          stageName,
          amount,
        });
        return { data, success: true };
      }

      case 'createContact': {
        const { firstName, lastName, email, phone } = input;
        if (!lastName) throw new Error('lastName is required for action "createContact"');
        const data = await ctx.integrate('salesforce', 'createContact', {
          connectionId,
          firstName,
          lastName,
          email,
          phone,
        });
        return { data, success: true };
      }

      case 'query': {
        const { soqlQuery } = input;
        if (!soqlQuery) throw new Error('soqlQuery is required for action "query"');
        const data = await ctx.integrate('salesforce', 'query', {
          connectionId,
          soqlQuery,
        });
        return { data, success: true };
      }

      case 'createAccount': {
        const { accountName, phone } = input;
        if (!accountName) throw new Error('accountName is required for action "createAccount"');
        const data = await ctx.integrate('salesforce', 'createAccount', {
          connectionId,
          name: accountName,
          phone,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
