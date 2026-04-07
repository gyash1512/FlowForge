import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum([
    'createContact',
    'assignConversation',
    'closeConversation',
    'createArticle',
    'addTag',
  ]),
  email: z.string().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  conversationId: z.string().optional(),
  assigneeId: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  contactId: z.string().optional(),
  tagId: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Intercom integration connection identifier'),
});

export const intercomNode = defineNode({
  name: 'communication/intercom',
  version: '0.1.0',
  description: 'Create contacts, manage conversations, create articles, and add tags in Intercom',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['intercom', 'support', 'crm'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createContact': {
        const { email, name, phone } = input;
        if (!email) throw new Error('email is required for action "createContact"');
        const data = await ctx.integrate('intercom', 'createContact', {
          connectionId,
          email,
          name,
          phone,
        });
        return { data, success: true };
      }

      case 'assignConversation': {
        const { conversationId, assigneeId } = input;
        if (!conversationId || !assigneeId)
          throw new Error(
            'conversationId and assigneeId are required for action "assignConversation"',
          );
        const data = await ctx.integrate('intercom', 'assignConversation', {
          connectionId,
          conversationId,
          assigneeId,
        });
        return { data, success: true };
      }

      case 'closeConversation': {
        const { conversationId } = input;
        if (!conversationId)
          throw new Error('conversationId is required for action "closeConversation"');
        const data = await ctx.integrate('intercom', 'closeConversation', {
          connectionId,
          conversationId,
        });
        return { data, success: true };
      }

      case 'createArticle': {
        const { title, body } = input;
        if (!title || !body)
          throw new Error('title and body are required for action "createArticle"');
        const data = await ctx.integrate('intercom', 'createArticle', {
          connectionId,
          title,
          body,
        });
        return { data, success: true };
      }

      case 'addTag': {
        const { contactId, tagId } = input;
        if (!contactId || !tagId)
          throw new Error('contactId and tagId are required for action "addTag"');
        const data = await ctx.integrate('intercom', 'addTag', {
          connectionId,
          contactId,
          tagId,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
