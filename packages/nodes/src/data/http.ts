import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  query: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  auth: z
    .object({
      type: z.enum(['bearer', 'basic', 'api-key']),
      token: z.string().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      headerName: z.string().optional(),
    })
    .optional(),
});

const outputSchema = z.object({
  status: z.number(),
  statusText: z.string(),
  headers: z.record(z.string()),
  data: z.unknown(),
});

const configSchema = z.object({
  timeout: z.number().int().default(30_000).describe('Request timeout in milliseconds'),
  followRedirects: z.boolean().default(true),
  validateStatus: z.boolean().default(true).describe('Throw on non-2xx responses'),
});

export const httpNode = defineNode({
  name: 'data/http',
  version: '0.1.0',
  description: 'Make HTTP requests with configurable method, auth, headers, and body',
  category: 'data',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['http', 'api', 'rest'],

  handler: async (ctx) => {
    const { method, url, headers, query, body, auth } = ctx.input;
    const { timeout, followRedirects, validateStatus } = ctx.config;

    const reqHeaders: Record<string, string> = { ...headers };

    if (auth) {
      switch (auth.type) {
        case 'bearer':
          reqHeaders['Authorization'] = `Bearer ${auth.token}`;
          break;
        case 'basic': {
          const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
          reqHeaders['Authorization'] = `Basic ${encoded}`;
          break;
        }
        case 'api-key':
          reqHeaders[auth.headerName ?? 'X-API-Key'] = auth.token ?? '';
          break;
      }
    }

    let targetUrl = url;
    if (query && Object.keys(query).length > 0) {
      const params = new URLSearchParams(query);
      targetUrl = `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers: reqHeaders,
      redirect: followRedirects ? 'follow' : 'manual',
      signal: AbortSignal.timeout(timeout),
    };

    if (body !== undefined && method !== 'GET') {
      if (typeof body === 'string') {
        fetchOptions.body = body;
      } else {
        fetchOptions.body = JSON.stringify(body);
        reqHeaders['Content-Type'] = reqHeaders['Content-Type'] ?? 'application/json';
      }
    }

    ctx.logger.info({ method, url: targetUrl }, 'Making HTTP request');

    const response = await fetch(targetUrl, fetchOptions);

    if (validateStatus && (response.status < 200 || response.status >= 300)) {
      const errorBody = await response.text();
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorBody}`);
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let data: unknown;
    const ct = response.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data,
    };
  },
});
