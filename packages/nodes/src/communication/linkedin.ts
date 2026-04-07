import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum(['createPost', 'addComment', 'getMyInfo', 'getCompanyInfo', 'deletePost']),
  text: z.string().optional(),
  postId: z.string().optional(),
  comment: z.string().optional(),
  companyId: z.string().optional(),
  visibility: z.string().optional(),
});

const outputSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
});

const configSchema = z.object({
  connectionId: z.string().describe('LinkedIn integration connection identifier'),
});

export const linkedinNode = defineNode({
  name: 'communication/linkedin',
  version: '0.1.0',
  description: 'Create posts, add comments, and manage company info via LinkedIn',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['linkedin', 'social-media', 'professional'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createPost': {
        const { text, visibility } = input;
        if (!text) throw new Error('text is required for action "createPost"');
        const result = await ctx.integrate('linkedin', 'createPost', {
          connectionId,
          text,
          visibility,
        });
        return { success: true, data: result };
      }

      case 'addComment': {
        const { postId, comment } = input;
        if (!postId) throw new Error('postId is required for action "addComment"');
        if (!comment) throw new Error('comment is required for action "addComment"');
        const result = await ctx.integrate('linkedin', 'addComment', {
          connectionId,
          postId,
          comment,
        });
        return { success: true, data: result };
      }

      case 'getMyInfo': {
        const result = await ctx.integrate('linkedin', 'getMyInfo', {
          connectionId,
        });
        return { success: true, data: result };
      }

      case 'getCompanyInfo': {
        const { companyId } = input;
        if (!companyId) throw new Error('companyId is required for action "getCompanyInfo"');
        const result = await ctx.integrate('linkedin', 'getCompanyInfo', {
          connectionId,
          companyId,
        });
        return { success: true, data: result };
      }

      case 'deletePost': {
        const { postId } = input;
        if (!postId) throw new Error('postId is required for action "deletePost"');
        const result = await ctx.integrate('linkedin', 'deletePost', {
          connectionId,
          postId,
        });
        return { success: true, data: result };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
