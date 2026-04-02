import type { IntegrationAdaptor } from '@flowforge/shared';
import { IntegrationError } from '@flowforge/shared';

export interface TelegramClient {
  sendMessage(chatId: string | number, text: string, parseMode?: string, replyToMessageId?: number): Promise<unknown>;
  sendPhoto(chatId: string | number, photo: string, caption?: string): Promise<unknown>;
  sendDocument(chatId: string | number, document: string, caption?: string, filename?: string): Promise<unknown>;
}

interface SendMessageParams {
  chatId: string | number;
  text: string;
  parseMode?: string;
  replyToMessageId?: number;
}

interface SendPhotoParams {
  chatId: string | number;
  photo: string;
  caption?: string;
}

interface SendDocumentParams {
  chatId: string | number;
  document: string;
  caption?: string;
  filename?: string;
}

export class TelegramAdaptor implements IntegrationAdaptor {
  readonly name = 'telegram';
  readonly actions = ['sendMessage', 'sendPhoto', 'sendDocument'];

  constructor(private readonly client?: TelegramClient) {}

  async execute(action: string, params: unknown, _connectionId: string): Promise<unknown> {
    switch (action) {
      case 'sendMessage':
        return this.sendMessage(params);
      case 'sendPhoto':
        return this.sendPhoto(params);
      case 'sendDocument':
        return this.sendDocument(params);
      default:
        throw new IntegrationError('telegram', `Unknown action: ${action}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    return this.client !== undefined;
  }

  private async sendMessage(params: unknown): Promise<unknown> {
    this.requireFields(params, ['chatId', 'text']);
    const p = params as SendMessageParams;
    if (!this.client) return { action: 'sendMessage', params };
    return this.client.sendMessage(p.chatId, p.text, p.parseMode, p.replyToMessageId);
  }

  private async sendPhoto(params: unknown): Promise<unknown> {
    this.requireFields(params, ['chatId', 'photo']);
    const p = params as SendPhotoParams;
    if (!this.client) return { action: 'sendPhoto', params };
    return this.client.sendPhoto(p.chatId, p.photo, p.caption);
  }

  private async sendDocument(params: unknown): Promise<unknown> {
    this.requireFields(params, ['chatId', 'document']);
    const p = params as SendDocumentParams;
    if (!this.client) return { action: 'sendDocument', params };
    return this.client.sendDocument(p.chatId, p.document, p.caption, p.filename);
  }

  private requireFields(params: unknown, fields: string[]): void {
    if (typeof params !== 'object' || params === null) {
      throw new IntegrationError('telegram', 'params must be an object');
    }
    const p = params as Record<string, unknown>;
    for (const field of fields) {
      if (p[field] === undefined || p[field] === null) {
        throw new IntegrationError('telegram', `Missing required field: ${field}`);
      }
    }
  }
}
