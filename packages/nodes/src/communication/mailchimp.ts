import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['addMember', 'createCampaign', 'sendCampaign', 'getListMembers', 'addTag']),
  listId: z.string().optional(),
  email: z.string().optional(),
  status: z.string().optional(),
  mergeFields: z.record(z.unknown()).optional(),
  campaignId: z.string().optional(),
  subject: z.string().optional(),
  fromName: z.string().optional(),
  replyTo: z.string().optional(),
  tag: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Mailchimp integration connection identifier'),
});

export const mailchimpNode = defineNode({
  name: 'communication/mailchimp',
  version: '0.1.0',
  description: 'Manage members, campaigns, and tags via Mailchimp',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['mailchimp', 'email', 'marketing'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'addMember': {
        const { listId, email, status, mergeFields } = input;
        if (!listId) throw new Error('listId is required for action "addMember"');
        if (!email) throw new Error('email is required for action "addMember"');
        const data = await ctx.integrate('mailchimp', 'addMember', {
          connectionId,
          listId,
          email,
          status: status ?? 'subscribed',
          mergeFields,
        });
        return { data, success: true };
      }

      case 'createCampaign': {
        const { listId, subject, fromName, replyTo } = input;
        if (!listId) throw new Error('listId is required for action "createCampaign"');
        if (!subject) throw new Error('subject is required for action "createCampaign"');
        if (!fromName) throw new Error('fromName is required for action "createCampaign"');
        if (!replyTo) throw new Error('replyTo is required for action "createCampaign"');
        const data = await ctx.integrate('mailchimp', 'createCampaign', {
          connectionId,
          listId,
          subject,
          fromName,
          replyTo,
        });
        return { data, success: true };
      }

      case 'sendCampaign': {
        const { campaignId } = input;
        if (!campaignId) throw new Error('campaignId is required for action "sendCampaign"');
        const data = await ctx.integrate('mailchimp', 'sendCampaign', {
          connectionId,
          campaignId,
        });
        return { data, success: true };
      }

      case 'getListMembers': {
        const { listId } = input;
        if (!listId) throw new Error('listId is required for action "getListMembers"');
        const data = await ctx.integrate('mailchimp', 'getListMembers', {
          connectionId,
          listId,
        });
        return { data, success: true };
      }

      case 'addTag': {
        const { listId, email, tag } = input;
        if (!listId) throw new Error('listId is required for action "addTag"');
        if (!email) throw new Error('email is required for action "addTag"');
        if (!tag) throw new Error('tag is required for action "addTag"');
        const data = await ctx.integrate('mailchimp', 'addTag', {
          connectionId,
          listId,
          email,
          tag,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
