import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum(['addFileMember', 'addFolderMember', 'addTags', 'archiveFolder']),
  fileId: z.string().optional(),
  folderId: z.string().optional(),
  memberEmail: z.string().optional(),
  accessLevel: z.enum(['viewer', 'editor', 'owner']).optional(),
  tags: z.array(z.string()).optional(),
  teamFolderId: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Dropbox integration connection identifier'),
});

export const dropboxNode = defineNode({
  name: 'communication/dropbox',
  version: '0.1.0',
  description: 'Add file and folder members, manage tags, and archive folders in Dropbox',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['dropbox', 'storage', 'file-sharing'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'addFileMember': {
        const { fileId, memberEmail, accessLevel } = input;
        if (!fileId || !memberEmail)
          throw new Error('fileId and memberEmail are required for action "addFileMember"');
        const data = await ctx.integrate('dropbox', 'addFileMember', {
          connectionId,
          fileId,
          memberEmail,
          accessLevel: accessLevel ?? 'viewer',
        });
        return { data, success: true };
      }

      case 'addFolderMember': {
        const { folderId, memberEmail, accessLevel } = input;
        if (!folderId || !memberEmail)
          throw new Error('folderId and memberEmail are required for action "addFolderMember"');
        const data = await ctx.integrate('dropbox', 'addFolderMember', {
          connectionId,
          folderId,
          memberEmail,
          accessLevel: accessLevel ?? 'viewer',
        });
        return { data, success: true };
      }

      case 'addTags': {
        const { fileId, tags } = input;
        if (!fileId || !tags || tags.length === 0)
          throw new Error('fileId and tags are required for action "addTags"');
        const data = await ctx.integrate('dropbox', 'addTags', {
          connectionId,
          fileId,
          tags,
        });
        return { data, success: true };
      }

      case 'archiveFolder': {
        const { teamFolderId } = input;
        if (!teamFolderId) throw new Error('teamFolderId is required for action "archiveFolder"');
        const data = await ctx.integrate('dropbox', 'archiveFolder', {
          connectionId,
          teamFolderId,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
