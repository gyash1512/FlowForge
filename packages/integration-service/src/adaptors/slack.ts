import type { IntegrationAdaptor } from '@flowforgejs/shared';
import { IntegrationError } from '@flowforgejs/shared';

export interface SlackClient {
  postMessage(channel: string, text: string, opts?: Record<string, unknown>): Promise<unknown>;
  updateMessage(channel: string, ts: string, text: string): Promise<unknown>;
  addReaction(channel: string, ts: string, name: string): Promise<unknown>;
  createChannel(name: string, isPrivate?: boolean): Promise<unknown>;
  listUsers(cursor?: string, limit?: number): Promise<unknown>;
  uploadFile(channels: string, content: string, filename: string, title?: string): Promise<unknown>;
}

interface SendMessageParams {
  channel: string;
  text: string;
  threadTs?: string;
  blocks?: unknown[];
}

interface UpdateMessageParams {
  channel: string;
  ts: string;
  text: string;
}

interface AddReactionParams {
  channel: string;
  ts: string;
  name: string;
}

interface CreateChannelParams {
  name: string;
  isPrivate?: boolean;
}

interface ListUsersParams {
  cursor?: string;
  limit?: number;
}

interface UploadFileParams {
  channels: string;
  content: string;
  filename: string;
  title?: string;
}

export class SlackAdaptor implements IntegrationAdaptor {
  readonly name = 'slack';
  readonly actions = [
    'sendMessage',
    'updateMessage',
    'addReaction',
    'createChannel',
    'listUsers',
    'uploadFile',
  ];

  constructor(private readonly client?: SlackClient) {}

  async execute(action: string, params: unknown, _connectionId: string): Promise<unknown> {
    switch (action) {
      case 'sendMessage':
        return this.sendMessage(params);
      case 'updateMessage':
        return this.updateMessage(params);
      case 'addReaction':
        return this.addReaction(params);
      case 'createChannel':
        return this.createChannel(params);
      case 'listUsers':
        return this.listUsers(params);
      case 'uploadFile':
        return this.uploadFile(params);
      default:
        throw new IntegrationError('slack', `Unknown action: ${action}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.listUsers(undefined, 1);
      return true;
    } catch {
      return false;
    }
  }

  private async sendMessage(params: unknown): Promise<unknown> {
    this.requireFields(params, ['channel', 'text']);
    const p = params as SendMessageParams;
    if (!this.client) return this.dryResult('sendMessage', params);
    return this.client.postMessage(p.channel, p.text, {
      thread_ts: p.threadTs,
      blocks: p.blocks,
    });
  }

  private async updateMessage(params: unknown): Promise<unknown> {
    this.requireFields(params, ['channel', 'ts', 'text']);
    const p = params as UpdateMessageParams;
    if (!this.client) return this.dryResult('updateMessage', params);
    return this.client.updateMessage(p.channel, p.ts, p.text);
  }

  private async addReaction(params: unknown): Promise<unknown> {
    this.requireFields(params, ['channel', 'ts', 'name']);
    const p = params as AddReactionParams;
    if (!this.client) return this.dryResult('addReaction', params);
    return this.client.addReaction(p.channel, p.ts, p.name);
  }

  private async createChannel(params: unknown): Promise<unknown> {
    this.requireFields(params, ['name']);
    const p = params as CreateChannelParams;
    if (!this.client) return this.dryResult('createChannel', params);
    return this.client.createChannel(p.name, p.isPrivate);
  }

  private async listUsers(params: unknown): Promise<unknown> {
    this.requireFields(params, []);
    const p = params as ListUsersParams;
    if (!this.client) return this.dryResult('listUsers', params);
    return this.client.listUsers(p.cursor, p.limit);
  }

  private async uploadFile(params: unknown): Promise<unknown> {
    this.requireFields(params, ['channels', 'content', 'filename']);
    const p = params as UploadFileParams;
    if (!this.client) return this.dryResult('uploadFile', params);
    return this.client.uploadFile(p.channels, p.content, p.filename, p.title);
  }

  private requireFields(params: unknown, fields: string[]): void {
    if (typeof params !== 'object' || params === null) {
      throw new IntegrationError('slack', 'params must be an object');
    }
    const p = params as Record<string, unknown>;
    for (const field of fields) {
      if (p[field] === undefined || p[field] === null) {
        throw new IntegrationError('slack', `Missing required field: ${field}`);
      }
    }
  }

  private dryResult(action: string, params: unknown): { action: string; params: unknown } {
    return { action, params };
  }
}
