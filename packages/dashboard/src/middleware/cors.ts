import type { MiddlewareHandler } from 'hono';

export interface CorsOptions {
  origin?: string | string[];
  methods?: string[];
  allowHeaders?: string[];
  exposeHeaders?: string[];
  maxAge?: number;
  credentials?: boolean;
}

/**
 * CORS middleware for the dashboard API.
 */
export function corsMiddleware(options: CorsOptions = {}): MiddlewareHandler {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders = ['Content-Type', 'Authorization', 'X-API-Key'],
    exposeHeaders = [],
    maxAge = 86400,
    credentials = false,
  } = options;

  return async (c, next) => {
    const requestOrigin = c.req.header('origin') ?? '';

    // Determine allowed origin
    let allowedOrigin: string;
    if (Array.isArray(origin)) {
      allowedOrigin = origin.includes(requestOrigin) ? requestOrigin : origin[0] ?? '*';
    } else {
      allowedOrigin = origin;
    }

    c.header('Access-Control-Allow-Origin', allowedOrigin);
    c.header('Access-Control-Allow-Methods', methods.join(', '));
    c.header('Access-Control-Allow-Headers', allowHeaders.join(', '));

    if (exposeHeaders.length > 0) {
      c.header('Access-Control-Expose-Headers', exposeHeaders.join(', '));
    }

    if (credentials) {
      c.header('Access-Control-Allow-Credentials', 'true');
    }

    c.header('Access-Control-Max-Age', String(maxAge));

    // Handle preflight requests
    if (c.req.method === 'OPTIONS') {
      return c.body(null, 204);
    }

    await next();
  };
}
