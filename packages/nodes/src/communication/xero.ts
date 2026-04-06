import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum([
    'createInvoice',
    'createContact',
    'createPayment',
    'getBalanceSheet',
    'createTransaction',
  ]),
  contactId: z.string().optional(),
  lineItems: z.array(z.record(z.unknown())).optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  invoiceId: z.string().optional(),
  amount: z.number().optional(),
  accountCode: z.string().optional(),
  date: z.string().optional(),
  bankAccountId: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Xero integration connection identifier'),
});

export const xeroNode = defineNode({
  name: 'communication/xero',
  version: '0.1.0',
  description:
    'Create invoices, contacts, payments, and transactions, and retrieve balance sheets in Xero',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['xero', 'accounting', 'finance'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createInvoice': {
        const { contactId, lineItems } = input;
        if (!contactId || !lineItems)
          throw new Error('contactId and lineItems are required for action "createInvoice"');
        const data = await ctx.integrate('xero', 'createInvoice', {
          connectionId,
          contactId,
          lineItems,
        });
        return { data, success: true };
      }

      case 'createContact': {
        const { name, email } = input;
        if (!name) throw new Error('name is required for action "createContact"');
        const data = await ctx.integrate('xero', 'createContact', {
          connectionId,
          name,
          email,
        });
        return { data, success: true };
      }

      case 'createPayment': {
        const { invoiceId, amount, accountCode } = input;
        if (!invoiceId || !amount || !accountCode)
          throw new Error(
            'invoiceId, amount, and accountCode are required for action "createPayment"',
          );
        const data = await ctx.integrate('xero', 'createPayment', {
          connectionId,
          invoiceId,
          amount,
          accountCode,
        });
        return { data, success: true };
      }

      case 'getBalanceSheet': {
        const { date } = input;
        const data = await ctx.integrate('xero', 'getBalanceSheet', {
          connectionId,
          date,
        });
        return { data, success: true };
      }

      case 'createTransaction': {
        const { bankAccountId, lineItems, date } = input;
        if (!bankAccountId || !lineItems)
          throw new Error(
            'bankAccountId and lineItems are required for action "createTransaction"',
          );
        const data = await ctx.integrate('xero', 'createTransaction', {
          connectionId,
          bankAccountId,
          lineItems,
          date,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
