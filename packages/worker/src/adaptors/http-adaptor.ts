import type { DataAdaptor } from '@flowforge/shared';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface HttpRequestParams {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

// ────────────────────────────────────────────────────────────────
// HttpAdaptor
// ────────────────────────────────────────────────────────────────

export class HttpAdaptor implements DataAdaptor {
  readonly name = 'http';

  async pull(params: unknown): Promise<unknown> {
    const p = params as HttpRequestParams;
    if (!p.url || typeof p.url !== 'string') {
      throw new Error('HttpAdaptor.pull() requires a "url" string');
    }

    const method = (p.method ?? 'GET').toUpperCase();
    const headers = p.headers ?? {};
    const hasBody = p.body !== undefined && p.body !== null;

    const init: RequestInit = {
      method,
      headers,
      ...(hasBody ? { body: serializeBody(p.body) } : {}),
    };

    if (p.timeout && p.timeout > 0) {
      init.signal = AbortSignal.timeout(p.timeout);
    }

    const response = await fetch(p.url, init);
    return parseResponse(response);
  }

  async push(params: unknown): Promise<unknown> {
    const p = params as HttpRequestParams;
    if (!p.url || typeof p.url !== 'string') {
      throw new Error('HttpAdaptor.push() requires a "url" string');
    }

    const method = (p.method ?? 'POST').toUpperCase();
    const headers = p.headers ?? {};
    const hasBody = p.body !== undefined && p.body !== null;

    // Auto-set Content-Type for JSON bodies if not already set
    if (
      hasBody &&
      typeof p.body === 'object' &&
      !headers['content-type'] &&
      !headers['Content-Type']
    ) {
      headers['Content-Type'] = 'application/json';
    }

    const init: RequestInit = {
      method,
      headers,
      ...(hasBody ? { body: serializeBody(p.body) } : {}),
    };

    if (p.timeout && p.timeout > 0) {
      init.signal = AbortSignal.timeout(p.timeout);
    }

    const response = await fetch(p.url, init);
    return parseResponse(response);
  }

  async healthCheck(): Promise<boolean> {
    // No persistent connection to check — always healthy
    return true;
  }
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function serializeBody(body: unknown): string {
  if (typeof body === 'string') return body;
  return JSON.stringify(body);
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';

  const result: Record<string, unknown> = {
    status: response.status,
    ok: response.ok,
    headers: Object.fromEntries(response.headers.entries()),
  };

  if (contentType.includes('application/json')) {
    result.data = await response.json();
  } else {
    result.data = await response.text();
  }

  return result;
}
