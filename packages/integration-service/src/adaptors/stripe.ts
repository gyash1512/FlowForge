import type { IntegrationAdaptor } from '@flowforge/shared';
import { IntegrationError } from '@flowforge/shared';

export interface StripeClient {
  createCharge(amount: number, currency: string, source: string, description?: string): Promise<unknown>;
  createCustomer(email: string, name?: string, metadata?: Record<string, string>): Promise<unknown>;
  createSubscription(customerId: string, priceId: string, metadata?: Record<string, string>): Promise<unknown>;
  listPayments(customerId?: string, limit?: number, startingAfter?: string): Promise<unknown>;
  createRefund(chargeId: string, amount?: number, reason?: string): Promise<unknown>;
}

interface CreateChargeParams {
  amount: number;
  currency: string;
  source: string;
  description?: string;
}

interface CreateCustomerParams {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

interface CreateSubscriptionParams {
  customerId: string;
  priceId: string;
  metadata?: Record<string, string>;
}

interface ListPaymentsParams {
  customerId?: string;
  limit?: number;
  startingAfter?: string;
}

interface CreateRefundParams {
  chargeId: string;
  amount?: number;
  reason?: string;
}

export class StripeAdaptor implements IntegrationAdaptor {
  readonly name = 'stripe';
  readonly actions = ['createCharge', 'createCustomer', 'createSubscription', 'listPayments', 'createRefund'];

  constructor(private readonly client?: StripeClient) {}

  async execute(action: string, params: unknown, _connectionId: string): Promise<unknown> {
    switch (action) {
      case 'createCharge':
        return this.createCharge(params);
      case 'createCustomer':
        return this.createCustomer(params);
      case 'createSubscription':
        return this.createSubscription(params);
      case 'listPayments':
        return this.listPayments(params);
      case 'createRefund':
        return this.createRefund(params);
      default:
        throw new IntegrationError('stripe', `Unknown action: ${action}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    return this.client !== undefined;
  }

  private async createCharge(params: unknown): Promise<unknown> {
    this.requireFields(params, ['amount', 'currency', 'source']);
    const p = params as CreateChargeParams;
    if (!this.client) return { action: 'createCharge', params };
    return this.client.createCharge(p.amount, p.currency, p.source, p.description);
  }

  private async createCustomer(params: unknown): Promise<unknown> {
    this.requireFields(params, ['email']);
    const p = params as CreateCustomerParams;
    if (!this.client) return { action: 'createCustomer', params };
    return this.client.createCustomer(p.email, p.name, p.metadata);
  }

  private async createSubscription(params: unknown): Promise<unknown> {
    this.requireFields(params, ['customerId', 'priceId']);
    const p = params as CreateSubscriptionParams;
    if (!this.client) return { action: 'createSubscription', params };
    return this.client.createSubscription(p.customerId, p.priceId, p.metadata);
  }

  private async listPayments(params: unknown): Promise<unknown> {
    this.requireFields(params, []);
    const p = params as ListPaymentsParams;
    if (!this.client) return { action: 'listPayments', params };
    return this.client.listPayments(p.customerId, p.limit, p.startingAfter);
  }

  private async createRefund(params: unknown): Promise<unknown> {
    this.requireFields(params, ['chargeId']);
    const p = params as CreateRefundParams;
    if (!this.client) return { action: 'createRefund', params };
    return this.client.createRefund(p.chargeId, p.amount, p.reason);
  }

  private requireFields(params: unknown, fields: string[]): void {
    if (typeof params !== 'object' || params === null) {
      throw new IntegrationError('stripe', 'params must be an object');
    }
    const p = params as Record<string, unknown>;
    for (const field of fields) {
      if (p[field] === undefined || p[field] === null) {
        throw new IntegrationError('stripe', `Missing required field: ${field}`);
      }
    }
  }
}
