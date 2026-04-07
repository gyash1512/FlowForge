import type { IntegrationAdaptor } from '@flowforgejs/shared';
import { IntegrationError } from '@flowforgejs/shared';

export interface EmailClient {
  send(message: EmailMessage): Promise<unknown>;
}

export interface EmailAttachment {
  filename: string;
  content: string;
  contentType?: string;
  encoding?: 'base64' | 'utf-8';
}

export interface EmailMessage {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  from?: string;
  replyTo?: string;
}

export class EmailAdaptor implements IntegrationAdaptor {
  readonly name = 'email';
  readonly actions = ['send'];

  constructor(private readonly client?: EmailClient) {}

  async execute(action: string, params: unknown, _connectionId: string): Promise<unknown> {
    switch (action) {
      case 'send':
        return this.send(params);
      default:
        throw new IntegrationError('email', `Unknown action: ${action}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    return this.client !== undefined;
  }

  private async send(params: unknown): Promise<unknown> {
    this.requireFields(params, ['to', 'subject']);
    const p = params as EmailMessage;
    if (!p.html && !p.text) {
      throw new IntegrationError('email', 'At least one of html or text is required');
    }
    if (!this.client) return { action: 'send', params };
    return this.client.send(p);
  }

  private requireFields(params: unknown, fields: string[]): void {
    if (typeof params !== 'object' || params === null) {
      throw new IntegrationError('email', 'params must be an object');
    }
    const p = params as Record<string, unknown>;
    for (const field of fields) {
      if (p[field] === undefined || p[field] === null) {
        throw new IntegrationError('email', `Missing required field: ${field}`);
      }
    }
  }
}
