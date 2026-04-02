import type { IntegrationAdaptor } from '@flowforge/shared';
import { IntegrationError } from '@flowforge/shared';

export interface WebhookClient {
  send(url: string, options: WebhookRequestOptions): Promise<unknown>;
}

export interface WebhookRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  signature?: string;
  signatureHeader?: string;
  timeout?: number;
}

interface SendParams {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  signature?: string;
  signatureHeader?: string;
  timeout?: number;
}

export class WebhookAdaptor implements IntegrationAdaptor {
  readonly name = 'webhook';
  readonly actions = ['send'];

  constructor(private readonly client?: WebhookClient) {}

  async execute(action: string, params: unknown, _connectionId: string): Promise<unknown> {
    switch (action) {
      case 'send':
        return this.send(params);
      default:
        throw new IntegrationError('webhook', `Unknown action: ${action}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  private async send(params: unknown): Promise<unknown> {
    this.requireFields(params, ['url']);
    const p = params as SendParams;

    const options: WebhookRequestOptions = {
      method: p.method ?? 'POST',
      headers: p.headers,
      body: p.body,
      signature: p.signature,
      signatureHeader: p.signatureHeader ?? 'x-webhook-signature',
      timeout: p.timeout,
    };

    if (!this.client) return { action: 'send', url: p.url, options };
    return this.client.send(p.url, options);
  }

  private requireFields(params: unknown, fields: string[]): void {
    if (typeof params !== 'object' || params === null) {
      throw new IntegrationError('webhook', 'params must be an object');
    }
    const p = params as Record<string, unknown>;
    for (const field of fields) {
      if (p[field] === undefined || p[field] === null) {
        throw new IntegrationError('webhook', `Missing required field: ${field}`);
      }
    }
  }
}
