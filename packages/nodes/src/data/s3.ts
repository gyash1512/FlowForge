import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['getObject', 'putObject', 'deleteObject', 'listObjects', 'presignedUrl']),
  bucket: z.string(),
  key: z.string().optional(),
  body: z.unknown().optional(),
  contentType: z.string().optional(),
  prefix: z.string().optional(),
  maxKeys: z.number().int().optional(),
  expiresIn: z.number().int().optional(),
  metadata: z.record(z.string()).optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  contentType: z.string().optional(),
  url: z.string().optional(),
  keys: z.array(z.string()).optional(),
});

const configSchema = z.object({
  connectionId: z.string().describe('S3-compatible storage connection identifier'),
  region: z.string().default('us-east-1'),
});

export const s3Node = defineNode({
  name: 'data/s3',
  version: '0.1.0',
  description: 'Interact with S3-compatible object storage',
  category: 'data',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['storage', 's3', 'object-storage'],

  handler: async (ctx) => {
    const { action, bucket, key, body, contentType, prefix, maxKeys, expiresIn, metadata } = ctx.input;
    const { connectionId, region } = ctx.config;

    const baseParams = { connectionId, region, bucket };

    switch (action) {
      case 'getObject': {
        if (!key) throw new Error('key is required for action "getObject"');
        const result = await ctx.pull('s3', {
          ...baseParams,
          operation: 'getObject',
          key,
        });
        const res = result as { body: unknown; contentType?: string };
        return { data: res.body, contentType: res.contentType };
      }

      case 'putObject': {
        if (!key) throw new Error('key is required for action "putObject"');
        await ctx.push('s3', {
          ...baseParams,
          operation: 'putObject',
          key,
          body,
          contentType,
          metadata,
        });
        return { data: null, url: `s3://${bucket}/${key}` };
      }

      case 'deleteObject': {
        if (!key) throw new Error('key is required for action "deleteObject"');
        await ctx.push('s3', {
          ...baseParams,
          operation: 'deleteObject',
          key,
        });
        return { data: null };
      }

      case 'listObjects': {
        const result = await ctx.pull('s3', {
          ...baseParams,
          operation: 'listObjects',
          prefix: prefix ?? '',
          maxKeys: maxKeys ?? 1000,
        });
        const res = result as { keys: string[] };
        return { data: result, keys: res.keys };
      }

      case 'presignedUrl': {
        if (!key) throw new Error('key is required for action "presignedUrl"');
        const result = await ctx.pull('s3', {
          ...baseParams,
          operation: 'presignedUrl',
          key,
          expiresIn: expiresIn ?? 3600,
        });
        const res = result as { url: string };
        return { data: null, url: res.url };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
