import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpAdaptor } from '../http-adaptor.js';

describe('HttpAdaptor', () => {
  let adaptor: HttpAdaptor;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    adaptor = new HttpAdaptor();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('has the name "http"', () => {
    expect(adaptor.name).toBe('http');
  });

  it('healthCheck() always returns true', async () => {
    const healthy = await adaptor.healthCheck();
    expect(healthy).toBe(true);
  });

  it('pull() throws if url is missing', async () => {
    await expect(adaptor.pull({})).rejects.toThrow(
      'HttpAdaptor.pull() requires a "url" string',
    );
  });

  it('push() throws if url is missing', async () => {
    await expect(adaptor.push({ url: '' })).rejects.toThrow(
      'HttpAdaptor.push() requires a "url" string',
    );
  });

  it('pull() defaults to GET method', async () => {
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
      });
    }) as any;

    await adaptor.pull({ url: 'https://example.com/api' });
    expect(capturedInit?.method).toBe('GET');
  });

  it('push() defaults to POST method', async () => {
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({ created: true }), {
        headers: { 'content-type': 'application/json' },
      });
    }) as any;

    await adaptor.push({ url: 'https://example.com/api', body: { name: 'test' } });
    expect(capturedInit?.method).toBe('POST');
    expect(capturedInit?.body).toBe(JSON.stringify({ name: 'test' }));
  });

  it('pull() parses JSON responses correctly', async () => {
    const payload = { users: [{ id: 1, name: 'Alice' }] };
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(payload), {
        headers: { 'content-type': 'application/json' },
      });
    }) as any;

    const result = (await adaptor.pull({ url: 'https://example.com/users' })) as any;
    expect(result.status).toBe(200);
    expect(result.ok).toBe(true);
    expect(result.data).toEqual(payload);
  });

  it('pull() returns text for non-JSON responses', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('Hello, world!', {
        headers: { 'content-type': 'text/plain' },
      });
    }) as any;

    const result = (await adaptor.pull({ url: 'https://example.com/hello' })) as any;
    expect(result.status).toBe(200);
    expect(result.data).toBe('Hello, world!');
  });

  it('push() auto-sets Content-Type to application/json for object bodies', async () => {
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedInit = init;
      return new Response('{}', {
        headers: { 'content-type': 'application/json' },
      });
    }) as any;

    await adaptor.push({
      url: 'https://example.com/api',
      body: { key: 'value' },
    });

    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });
});
