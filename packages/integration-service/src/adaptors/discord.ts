import type { IntegrationAdaptor } from '@flowforge/shared';
import { IntegrationError } from '@flowforge/shared';

export interface DiscordClient {
  sendMessage(channelId: string, content: string, embeds?: unknown[]): Promise<unknown>;
  createChannel(guildId: string, name: string, type?: number): Promise<unknown>;
  addRole(guildId: string, userId: string, roleId: string): Promise<unknown>;
  react(channelId: string, messageId: string, emoji: string): Promise<unknown>;
}

interface SendMessageParams {
  channelId: string;
  content: string;
  embeds?: unknown[];
}

interface CreateChannelParams {
  guildId: string;
  name: string;
  type?: number;
}

interface AddRoleParams {
  guildId: string;
  userId: string;
  roleId: string;
}

interface ReactParams {
  channelId: string;
  messageId: string;
  emoji: string;
}

export class DiscordAdaptor implements IntegrationAdaptor {
  readonly name = 'discord';
  readonly actions = ['sendMessage', 'createChannel', 'addRole', 'react'];

  constructor(private readonly client?: DiscordClient) {}

  async execute(action: string, params: unknown, _connectionId: string): Promise<unknown> {
    switch (action) {
      case 'sendMessage':
        return this.sendMessage(params);
      case 'createChannel':
        return this.createChannel(params);
      case 'addRole':
        return this.addRole(params);
      case 'react':
        return this.react(params);
      default:
        throw new IntegrationError('discord', `Unknown action: ${action}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    return this.client !== undefined;
  }

  private async sendMessage(params: unknown): Promise<unknown> {
    this.requireFields(params, ['channelId', 'content']);
    const p = params as SendMessageParams;
    if (!this.client) return { action: 'sendMessage', params };
    return this.client.sendMessage(p.channelId, p.content, p.embeds);
  }

  private async createChannel(params: unknown): Promise<unknown> {
    this.requireFields(params, ['guildId', 'name']);
    const p = params as CreateChannelParams;
    if (!this.client) return { action: 'createChannel', params };
    return this.client.createChannel(p.guildId, p.name, p.type);
  }

  private async addRole(params: unknown): Promise<unknown> {
    this.requireFields(params, ['guildId', 'userId', 'roleId']);
    const p = params as AddRoleParams;
    if (!this.client) return { action: 'addRole', params };
    return this.client.addRole(p.guildId, p.userId, p.roleId);
  }

  private async react(params: unknown): Promise<unknown> {
    this.requireFields(params, ['channelId', 'messageId', 'emoji']);
    const p = params as ReactParams;
    if (!this.client) return { action: 'react', params };
    return this.client.react(p.channelId, p.messageId, p.emoji);
  }

  private requireFields(params: unknown, fields: string[]): void {
    if (typeof params !== 'object' || params === null) {
      throw new IntegrationError('discord', 'params must be an object');
    }
    const p = params as Record<string, unknown>;
    for (const field of fields) {
      if (p[field] === undefined || p[field] === null) {
        throw new IntegrationError('discord', `Missing required field: ${field}`);
      }
    }
  }
}
