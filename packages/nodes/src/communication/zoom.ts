import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum([
    'createMeeting',
    'listMeetings',
    'getMeeting',
    'deleteMeeting',
    'listRecordings',
  ]),
  topic: z.string().optional(),
  startTime: z.string().optional(),
  duration: z.number().optional(),
  timezone: z.string().optional(),
  meetingId: z.union([z.string(), z.number()]).optional(),
  userId: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Zoom integration connection identifier'),
});

export const zoomNode = defineNode({
  name: 'communication/zoom',
  version: '0.1.0',
  description: 'Create, list, retrieve, and delete meetings and list recordings via Zoom',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['zoom', 'meetings', 'video'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;
    const userId = input.userId ?? 'me';

    switch (action) {
      case 'createMeeting': {
        const { topic, startTime, duration, timezone } = input;
        if (!topic) throw new Error('topic is required for action "createMeeting"');
        const data = await ctx.integrate('zoom', 'createMeeting', {
          connectionId,
          userId,
          topic,
          startTime,
          duration,
          timezone,
        });
        return { data, success: true };
      }

      case 'listMeetings': {
        const data = await ctx.integrate('zoom', 'listMeetings', {
          connectionId,
          userId,
        });
        return { data, success: true };
      }

      case 'getMeeting': {
        const { meetingId } = input;
        if (!meetingId) throw new Error('meetingId is required for action "getMeeting"');
        const data = await ctx.integrate('zoom', 'getMeeting', {
          connectionId,
          meetingId,
        });
        return { data, success: true };
      }

      case 'deleteMeeting': {
        const { meetingId } = input;
        if (!meetingId) throw new Error('meetingId is required for action "deleteMeeting"');
        const data = await ctx.integrate('zoom', 'deleteMeeting', {
          connectionId,
          meetingId,
        });
        return { data, success: true };
      }

      case 'listRecordings': {
        const data = await ctx.integrate('zoom', 'listRecordings', {
          connectionId,
          userId,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
