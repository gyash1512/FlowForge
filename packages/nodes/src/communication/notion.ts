import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['createPage', 'updatePage', 'queryDatabase']),
  databaseId: z.string().optional(),
  pageId: z.string().optional(),
  parentPageId: z.string().optional(),
  properties: z.record(z.unknown()).optional(),
  children: z.array(z.record(z.unknown())).optional(),
  filter: z.record(z.unknown()).optional(),
  sorts: z.array(z.record(z.unknown())).optional(),
  pageSize: z.number().int().optional(),
});

const outputSchema = z.object({
  id: z.string().optional(),
  url: z.string().optional(),
  results: z.array(z.record(z.unknown())).optional(),
  hasMore: z.boolean().optional(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Notion integration connection identifier'),
});

export const notionNode = defineNode({
  name: 'communication/notion',
  version: '0.1.0',
  description: 'Create pages, update pages, and query databases in Notion',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['notion', 'wiki', 'documentation'],

  handler: async (ctx) => {
    const { action } = ctx.input;
    const { connectionId } = ctx.config;

    switch (action) {
      case 'createPage': {
        const { databaseId, parentPageId, properties, children } = ctx.input;
        if (!databaseId && !parentPageId) throw new Error('databaseId or parentPageId is required for action "createPage"');
        const parent = databaseId
          ? { database_id: databaseId }
          : { page_id: parentPageId };
        const result = await ctx.integrate('notion', 'createPage', {
          connectionId,
          parent,
          properties: properties ?? {},
          children,
        });
        const res = result as { id: string; url: string };
        return { id: res.id, url: res.url };
      }

      case 'updatePage': {
        const { pageId, properties } = ctx.input;
        if (!pageId) throw new Error('pageId is required for action "updatePage"');
        const result = await ctx.integrate('notion', 'updatePage', {
          connectionId,
          pageId,
          properties: properties ?? {},
        });
        const res = result as { id: string; url: string };
        return { id: res.id, url: res.url };
      }

      case 'queryDatabase': {
        const { databaseId, filter, sorts, pageSize } = ctx.input;
        if (!databaseId) throw new Error('databaseId is required for action "queryDatabase"');
        const result = await ctx.integrate('notion', 'queryDatabase', {
          connectionId,
          databaseId,
          filter,
          sorts,
          pageSize: pageSize ?? 100,
        });
        const res = result as { results: Record<string, unknown>[]; has_more: boolean };
        return { results: res.results, hasMore: res.has_more };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
