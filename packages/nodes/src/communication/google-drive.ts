import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['createFile', 'downloadFile', 'findFile', 'createFolder', 'createPermission']),
  name: z.string().optional(),
  mimeType: z.string().optional(),
  content: z.string().optional(),
  fileId: z.string().optional(),
  query: z.string().optional(),
  folderId: z.string().optional(),
  parentId: z.string().optional(),
  role: z.string().optional(),
  type: z.string().optional(),
  emailAddress: z.string().optional(),
});

const outputSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Google Drive integration connection identifier'),
});

export const googleDriveNode = defineNode({
  name: 'communication/google-drive',
  version: '0.1.0',
  description: 'Create, download, find files and manage permissions via Google Drive',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['google', 'drive', 'storage'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createFile': {
        const { name, mimeType, content, folderId } = input;
        if (!name) throw new Error('name is required for action "createFile"');
        const result = await ctx.integrate('google-drive', 'createFile', {
          connectionId,
          name,
          mimeType,
          content,
          folderId,
        });
        return { success: true, data: result };
      }

      case 'downloadFile': {
        const { fileId } = input;
        if (!fileId) throw new Error('fileId is required for action "downloadFile"');
        const result = await ctx.integrate('google-drive', 'downloadFile', {
          connectionId,
          fileId,
        });
        return { success: true, data: result };
      }

      case 'findFile': {
        const { query } = input;
        if (!query) throw new Error('query is required for action "findFile"');
        const result = await ctx.integrate('google-drive', 'findFile', {
          connectionId,
          query,
        });
        return { success: true, data: result };
      }

      case 'createFolder': {
        const { name, parentId } = input;
        if (!name) throw new Error('name is required for action "createFolder"');
        const result = await ctx.integrate('google-drive', 'createFolder', {
          connectionId,
          name,
          parentId,
        });
        return { success: true, data: result };
      }

      case 'createPermission': {
        const { fileId, role, type, emailAddress } = input;
        if (!fileId) throw new Error('fileId is required for action "createPermission"');
        if (!role) throw new Error('role is required for action "createPermission"');
        if (!type) throw new Error('type is required for action "createPermission"');
        const result = await ctx.integrate('google-drive', 'createPermission', {
          connectionId,
          fileId,
          role,
          type,
          emailAddress,
        });
        return { success: true, data: result };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
