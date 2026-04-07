import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum(['sendMessage', 'addChatMember', 'addTeamMember', 'archiveTeam']),
  chatId: z.string().optional(),
  teamId: z.string().optional(),
  content: z.string().optional(),
  userId: z.string().optional(),
  roles: z.array(z.string()).optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Microsoft Teams integration connection identifier'),
});

export const microsoftTeamsNode = defineNode({
  name: 'communication/microsoft-teams',
  version: '0.1.0',
  description: 'Send messages, manage chat and team members, and archive teams in Microsoft Teams',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['microsoft-teams', 'teams', 'messaging', 'chat'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'sendMessage': {
        const { chatId, content } = input;
        if (!chatId || !content)
          throw new Error('chatId and content are required for action "sendMessage"');
        const data = await ctx.integrate('microsoft-teams', 'sendMessage', {
          connectionId,
          chatId,
          content,
        });
        return { data, success: true };
      }

      case 'addChatMember': {
        const { chatId, userId, roles } = input;
        if (!chatId || !userId)
          throw new Error('chatId and userId are required for action "addChatMember"');
        const data = await ctx.integrate('microsoft-teams', 'addChatMember', {
          connectionId,
          chatId,
          userId,
          roles,
        });
        return { data, success: true };
      }

      case 'addTeamMember': {
        const { teamId, userId, roles } = input;
        if (!teamId || !userId)
          throw new Error('teamId and userId are required for action "addTeamMember"');
        const data = await ctx.integrate('microsoft-teams', 'addTeamMember', {
          connectionId,
          teamId,
          userId,
          roles,
        });
        return { data, success: true };
      }

      case 'archiveTeam': {
        const { teamId } = input;
        if (!teamId) throw new Error('teamId is required for action "archiveTeam"');
        const data = await ctx.integrate('microsoft-teams', 'archiveTeam', {
          connectionId,
          teamId,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
