import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  action: z.enum(['sendSms', 'makeCall', 'sendWhatsapp', 'lookupNumber', 'getCallLog']),
  to: z.string(),
  from: z.string().optional(),
  body: z.string().optional(),
  url: z.string().optional(),
  phoneNumber: z.string().optional(),
  callSid: z.string().optional(),
});

const outputSchema = z.object({
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  connectionId: z.string().describe('Twilio integration connection identifier'),
});

export const twilioNode = defineNode({
  name: 'communication/twilio',
  version: '0.1.0',
  description:
    'Send SMS, make calls, send WhatsApp messages, look up numbers, and retrieve call logs via Twilio',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['twilio', 'sms', 'voice', 'communications'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { action, to } = input;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;

    switch (action) {
      case 'sendSms': {
        const { from, body } = input;
        if (!body) throw new Error('body is required for action "sendSms"');
        const data = await ctx.integrate('twilio', 'sendSms', {
          connectionId,
          to,
          from,
          body,
        });
        return { data, success: true };
      }

      case 'makeCall': {
        const { from, url } = input;
        if (!url) throw new Error('url (TwiML URL) is required for action "makeCall"');
        const data = await ctx.integrate('twilio', 'makeCall', {
          connectionId,
          to,
          from,
          url,
        });
        return { data, success: true };
      }

      case 'sendWhatsapp': {
        const { from, body } = input;
        if (!body) throw new Error('body is required for action "sendWhatsapp"');
        const data = await ctx.integrate('twilio', 'sendWhatsapp', {
          connectionId,
          to,
          from,
          body,
        });
        return { data, success: true };
      }

      case 'lookupNumber': {
        const { phoneNumber } = input;
        if (!phoneNumber) throw new Error('phoneNumber is required for action "lookupNumber"');
        const data = await ctx.integrate('twilio', 'lookupNumber', {
          connectionId,
          phoneNumber,
        });
        return { data, success: true };
      }

      case 'getCallLog': {
        const { callSid } = input;
        if (!callSid) throw new Error('callSid is required for action "getCallLog"');
        const data = await ctx.integrate('twilio', 'getCallLog', {
          connectionId,
          callSid,
        });
        return { data, success: true };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
