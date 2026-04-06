import type { IntegrationAdaptor } from '@flowforge/shared';
import { IntegrationError } from '@flowforge/shared';

export interface NotionClient {
  createPage(
    parentId: string,
    properties: Record<string, unknown>,
    children?: unknown[],
  ): Promise<unknown>;
  updatePage(pageId: string, properties: Record<string, unknown>): Promise<unknown>;
  queryDatabase(
    databaseId: string,
    filter?: unknown,
    sorts?: unknown[],
    startCursor?: string,
    pageSize?: number,
  ): Promise<unknown>;
  appendBlock(blockId: string, children: unknown[]): Promise<unknown>;
}

interface CreatePageParams {
  parentId: string;
  properties: Record<string, unknown>;
  children?: unknown[];
}

interface UpdatePageParams {
  pageId: string;
  properties: Record<string, unknown>;
}

interface QueryDatabaseParams {
  databaseId: string;
  filter?: unknown;
  sorts?: unknown[];
  startCursor?: string;
  pageSize?: number;
}

interface AppendBlockParams {
  blockId: string;
  children: unknown[];
}

export class NotionAdaptor implements IntegrationAdaptor {
  readonly name = 'notion';
  readonly actions = ['createPage', 'updatePage', 'queryDatabase', 'appendBlock'];

  constructor(private readonly client?: NotionClient) {}

  async execute(action: string, params: unknown, _connectionId: string): Promise<unknown> {
    switch (action) {
      case 'createPage':
        return this.createPage(params);
      case 'updatePage':
        return this.updatePage(params);
      case 'queryDatabase':
        return this.queryDatabase(params);
      case 'appendBlock':
        return this.appendBlock(params);
      default:
        throw new IntegrationError('notion', `Unknown action: ${action}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    return this.client !== undefined;
  }

  private async createPage(params: unknown): Promise<unknown> {
    this.requireFields(params, ['parentId', 'properties']);
    const p = params as CreatePageParams;
    if (!this.client) return { action: 'createPage', params };
    return this.client.createPage(p.parentId, p.properties, p.children);
  }

  private async updatePage(params: unknown): Promise<unknown> {
    this.requireFields(params, ['pageId', 'properties']);
    const p = params as UpdatePageParams;
    if (!this.client) return { action: 'updatePage', params };
    return this.client.updatePage(p.pageId, p.properties);
  }

  private async queryDatabase(params: unknown): Promise<unknown> {
    this.requireFields(params, ['databaseId']);
    const p = params as QueryDatabaseParams;
    if (!this.client) return { action: 'queryDatabase', params };
    return this.client.queryDatabase(p.databaseId, p.filter, p.sorts, p.startCursor, p.pageSize);
  }

  private async appendBlock(params: unknown): Promise<unknown> {
    this.requireFields(params, ['blockId', 'children']);
    const p = params as AppendBlockParams;
    if (!this.client) return { action: 'appendBlock', params };
    return this.client.appendBlock(p.blockId, p.children);
  }

  private requireFields(params: unknown, fields: string[]): void {
    if (typeof params !== 'object' || params === null) {
      throw new IntegrationError('notion', 'params must be an object');
    }
    const p = params as Record<string, unknown>;
    for (const field of fields) {
      if (p[field] === undefined || p[field] === null) {
        throw new IntegrationError('notion', `Missing required field: ${field}`);
      }
    }
  }
}
