import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  url: z.string().url(),
  body: z.unknown(),
  headers: z.record(z.string()).optional(),
  secret: z.string().optional(),
});

const outputSchema = z.object({
  status: z.number(),
  data: z.unknown(),
  success: z.boolean(),
});

const configSchema = z.object({
  timeout: z.number().int().default(30_000).describe('Request timeout in milliseconds'),
  retryOnFailure: z.boolean().default(false),
  signatureHeader: z.string().default('X-Webhook-Signature').describe('Header name for HMAC signature'),
});

export const webhookNode = defineNode({
  name: 'communication/webhook',
  version: '0.1.0',
  description: 'Send a POST request to any webhook URL',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['webhook', 'http', 'notification'],

  handler: async (ctx) => {
    const { url, body, headers, secret } = ctx.input;
    const { timeout, signatureHeader } = ctx.config;

    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (secret) {
      // Compute HMAC signature if a secret is provided.
      // In a real environment this would use crypto.createHmac.
      // Here we delegate to the runtime's integrate call.
      const payload = JSON.stringify(body);
      const signResult = await ctx.integrate('crypto', 'hmacSha256', {
        secret,
        payload,
      });
      const sig = signResult as { signature: string };
      reqHeaders[signatureHeader] = sig.signature;
    }

    ctx.logger.info({ url }, 'Sending webhook');

    const response = await fetch(url, {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });

    let data: unknown;
    const ct = response.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    const success = response.status >= 200 && response.status < 300;

    if (!success) {
      ctx.logger.warn({ status: response.status, url }, 'Webhook returned non-2xx status');
    }

    return { status: response.status, data, success };
  },
});
