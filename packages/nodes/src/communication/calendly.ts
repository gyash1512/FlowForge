import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum(['listEvents', 'getEvent', 'listEventTypes', 'cancelEvent', 'getInvitee']),
  eventUuid: z.string().optional(),
  minStartTime: z.string().optional(),
  maxStartTime: z.string().optional(),
  status: z.string().optional(),
  inviteeUuid: z.string().optional(),
  reason: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Calendly integration connection identifier'),
});

export const calendlyNode = defineNode({
  name: 'communication/calendly',
  version: '0.1.0',
  description:
    'List events, retrieve event details, manage event types, cancel events, and get invitees via Calendly',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['calendly', 'scheduling', 'calendar'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'listEvents': {
        const { minStartTime, maxStartTime, status } = input;
        const data = await ctx.integrate('calendly', 'listEvents', {
          connectionId,
          minStartTime,
          maxStartTime,
          status,
        });
        return { data, success: true };
      }

      case 'getEvent': {
        const { eventUuid } = input;
        if (!eventUuid) throw new Error('eventUuid is required for action "getEvent"');
        const data = await ctx.integrate('calendly', 'getEvent', {
          connectionId,
          eventUuid,
        });
        return { data, success: true };
      }

      case 'listEventTypes': {
        const data = await ctx.integrate('calendly', 'listEventTypes', {
          connectionId,
        });
        return { data, success: true };
      }

      case 'cancelEvent': {
        const { eventUuid, reason } = input;
        if (!eventUuid) throw new Error('eventUuid is required for action "cancelEvent"');
        const data = await ctx.integrate('calendly', 'cancelEvent', {
          connectionId,
          eventUuid,
          reason,
        });
        return { data, success: true };
      }

      case 'getInvitee': {
        const { eventUuid, inviteeUuid } = input;
        if (!eventUuid) throw new Error('eventUuid is required for action "getInvitee"');
        if (!inviteeUuid) throw new Error('inviteeUuid is required for action "getInvitee"');
        const data = await ctx.integrate('calendly', 'getInvitee', {
          connectionId,
          eventUuid,
          inviteeUuid,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
