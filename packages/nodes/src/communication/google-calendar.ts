import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum(['createEvent', 'findEvent', 'deleteEvent', 'findFreeSlots', 'listEvents']),
  calendarId: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  attendees: z.array(z.string()).optional(),
  eventId: z.string().optional(),
  timeMin: z.string().optional(),
  timeMax: z.string().optional(),
  query: z.string().optional(),
});

const outputSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Google Calendar integration connection identifier'),
});

export const googleCalendarNode = defineNode({
  name: 'communication/google-calendar',
  version: '0.1.0',
  description: 'Create events, find free slots, and manage calendars via Google Calendar',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['google', 'calendar', 'scheduling'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'createEvent': {
        const { calendarId, summary, description, startTime, endTime, attendees } = input;
        if (!calendarId) throw new Error('calendarId is required for action "createEvent"');
        if (!summary) throw new Error('summary is required for action "createEvent"');
        if (!startTime) throw new Error('startTime is required for action "createEvent"');
        if (!endTime) throw new Error('endTime is required for action "createEvent"');
        const result = await ctx.integrate('google-calendar', 'createEvent', {
          connectionId,
          calendarId,
          summary,
          description,
          startTime,
          endTime,
          attendees,
        });
        return { success: true, data: result };
      }

      case 'findEvent': {
        const { calendarId, query } = input;
        if (!calendarId) throw new Error('calendarId is required for action "findEvent"');
        if (!query) throw new Error('query is required for action "findEvent"');
        const result = await ctx.integrate('google-calendar', 'findEvent', {
          connectionId,
          calendarId,
          query,
        });
        return { success: true, data: result };
      }

      case 'deleteEvent': {
        const { calendarId, eventId } = input;
        if (!calendarId) throw new Error('calendarId is required for action "deleteEvent"');
        if (!eventId) throw new Error('eventId is required for action "deleteEvent"');
        const result = await ctx.integrate('google-calendar', 'deleteEvent', {
          connectionId,
          calendarId,
          eventId,
        });
        return { success: true, data: result };
      }

      case 'findFreeSlots': {
        const { calendarId, timeMin, timeMax } = input;
        if (!calendarId) throw new Error('calendarId is required for action "findFreeSlots"');
        if (!timeMin) throw new Error('timeMin is required for action "findFreeSlots"');
        if (!timeMax) throw new Error('timeMax is required for action "findFreeSlots"');
        const result = await ctx.integrate('google-calendar', 'findFreeSlots', {
          connectionId,
          calendarId,
          timeMin,
          timeMax,
        });
        return { success: true, data: result };
      }

      case 'listEvents': {
        const { calendarId, timeMin, timeMax } = input;
        if (!calendarId) throw new Error('calendarId is required for action "listEvents"');
        const result = await ctx.integrate('google-calendar', 'listEvents', {
          connectionId,
          calendarId,
          timeMin,
          timeMax,
        });
        return { success: true, data: result };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
