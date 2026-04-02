import type { MiddlewareHandler } from 'hono';

/**
 * Simple API key authentication middleware.
 * Expects the API key in the `Authorization: Bearer <key>` header
 * or as an `x-api-key` header.
 *
 * If no API key is configured (env var CONDUIT_API_KEY is unset),
 * all requests are allowed through.
 */
export function apiKeyAuth(): MiddlewareHandler {
  return async (c, next) => {
    const configuredKey = process.env['CONDUIT_API_KEY'];

    // If no API key is configured, allow all requests
    if (!configuredKey) {
      await next();
      return;
    }

    const authHeader = c.req.header('authorization');
    const apiKeyHeader = c.req.header('x-api-key');

    let providedKey: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      providedKey = authHeader.slice(7);
    } else if (apiKeyHeader) {
      providedKey = apiKeyHeader;
    }

    if (!providedKey || providedKey !== configuredKey) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    await next();
  };
}
