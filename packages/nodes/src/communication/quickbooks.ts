import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum([
    'createInvoice',
    'createCustomer',
    'createBill',
    'createPayment',
    'createEstimate',
  ]),
  customerRef: z.record(z.unknown()).optional(),
  lineItems: z.array(z.record(z.unknown())).optional(),
  displayName: z.string().optional(),
  email: z.string().optional(),
  vendorRef: z.record(z.unknown()).optional(),
  amount: z.number().optional(),
  paymentMethodRef: z.record(z.unknown()).optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('QuickBooks integration connection identifier'),
});

export const quickbooksNode = defineNode({
  name: 'communication/quickbooks',
  version: '0.1.0',
  description: 'Create invoices, customers, bills, payments, and estimates in QuickBooks',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['quickbooks', 'accounting', 'finance'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createInvoice': {
        const { customerRef, lineItems } = input;
        if (!customerRef || !lineItems)
          throw new Error('customerRef and lineItems are required for action "createInvoice"');
        const data = await ctx.integrate('quickbooks', 'createInvoice', {
          connectionId,
          customerRef,
          lineItems,
        });
        return { data, success: true };
      }

      case 'createCustomer': {
        const { displayName, email } = input;
        if (!displayName) throw new Error('displayName is required for action "createCustomer"');
        const data = await ctx.integrate('quickbooks', 'createCustomer', {
          connectionId,
          displayName,
          email,
        });
        return { data, success: true };
      }

      case 'createBill': {
        const { vendorRef, lineItems } = input;
        if (!vendorRef || !lineItems)
          throw new Error('vendorRef and lineItems are required for action "createBill"');
        const data = await ctx.integrate('quickbooks', 'createBill', {
          connectionId,
          vendorRef,
          lineItems,
        });
        return { data, success: true };
      }

      case 'createPayment': {
        const { customerRef, amount, paymentMethodRef } = input;
        if (!customerRef || !amount)
          throw new Error('customerRef and amount are required for action "createPayment"');
        const data = await ctx.integrate('quickbooks', 'createPayment', {
          connectionId,
          customerRef,
          amount,
          paymentMethodRef,
        });
        return { data, success: true };
      }

      case 'createEstimate': {
        const { customerRef, lineItems } = input;
        if (!customerRef || !lineItems)
          throw new Error('customerRef and lineItems are required for action "createEstimate"');
        const data = await ctx.integrate('quickbooks', 'createEstimate', {
          connectionId,
          customerRef,
          lineItems,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
