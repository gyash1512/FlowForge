import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['createCharge', 'createCustomer', 'createSubscription', 'listPayments', 'createRefund']),
  amount: z.number().optional(),
  currency: z.string().optional(),
  source: z.string().optional(),
  description: z.string().optional(),
  email: z.string().optional(),
  name: z.string().optional(),
  customerId: z.string().optional(),
  priceId: z.string().optional(),
  chargeId: z.string().optional(),
  reason: z.string().optional(),
  limit: z.number().int().optional(),
  startingAfter: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

const outputSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Stripe integration connection identifier'),
});

export const stripeNode = defineNode({
  name: 'communication/stripe',
  version: '0.1.0',
  description: 'Process payments, manage customers, and handle subscriptions via Stripe',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['stripe', 'payments', 'billing'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createCharge': {
        const { amount, currency, source, description } = input;
        if (amount === undefined) throw new Error('amount is required for action "createCharge"');
        if (!currency) throw new Error('currency is required for action "createCharge"');
        if (!source) throw new Error('source is required for action "createCharge"');
        const result = await ctx.integrate('stripe', 'createCharge', {
          connectionId,
          amount,
          currency,
          source,
          description,
        });
        return { ok: true, data: result };
      }

      case 'createCustomer': {
        const { email, name, metadata } = input;
        if (!email) throw new Error('email is required for action "createCustomer"');
        const result = await ctx.integrate('stripe', 'createCustomer', {
          connectionId,
          email,
          name,
          metadata,
        });
        return { ok: true, data: result };
      }

      case 'createSubscription': {
        const { customerId, priceId, metadata } = input;
        if (!customerId) throw new Error('customerId is required for action "createSubscription"');
        if (!priceId) throw new Error('priceId is required for action "createSubscription"');
        const result = await ctx.integrate('stripe', 'createSubscription', {
          connectionId,
          customerId,
          priceId,
          metadata,
        });
        return { ok: true, data: result };
      }

      case 'listPayments': {
        const { customerId, limit, startingAfter } = input;
        const result = await ctx.integrate('stripe', 'listPayments', {
          connectionId,
          customerId,
          limit,
          startingAfter,
        });
        return { ok: true, data: result };
      }

      case 'createRefund': {
        const { chargeId, amount, reason } = input;
        if (!chargeId) throw new Error('chargeId is required for action "createRefund"');
        const result = await ctx.integrate('stripe', 'createRefund', {
          connectionId,
          chargeId,
          amount,
          reason,
        });
        return { ok: true, data: result };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
