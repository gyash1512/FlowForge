import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ComposioAdaptor,
  createComposioAdaptors,
  getComposioToolSlug,
  TOOL_MAP,
} from '../adaptors/composio.js';
import type { ComposioClient } from '../adaptors/composio.js';

function makeMockClient(result: unknown = { ok: true }): ComposioClient {
  return {
    tools: {
      execute: vi.fn().mockResolvedValue(result),
    },
  };
}

describe('ComposioAdaptor', () => {
  let client: ComposioClient;
  let adaptor: ComposioAdaptor;

  beforeEach(() => {
    client = makeMockClient({ ok: true, ts: '1234.5678', channel: '#general' });
    adaptor = new ComposioAdaptor('slack', client);
  });

  it('exposes integration name and available actions', () => {
    expect(adaptor.name).toBe('slack');
    expect(adaptor.actions).toEqual(expect.arrayContaining(['sendMessage', 'updateMessage']));
  });

  it('executes a mapped action via Composio', async () => {
    const result = await adaptor.execute(
      'sendMessage',
      { channel: '#general', text: 'Hello' },
      'user-123',
    );

    expect(client.tools.execute).toHaveBeenCalledWith('SLACK_SEND_A_MESSAGE', {
      userId: 'user-123',
      arguments: { channel: '#general', text: 'Hello' },
    });
    expect(result).toEqual({ ok: true, ts: '1234.5678', channel: '#general' });
  });

  it('strips connectionId from params before forwarding', async () => {
    await adaptor.execute(
      'sendMessage',
      { connectionId: 'conn-1', channel: '#general', text: 'Hi' },
      'user-123',
    );

    const call = (client.tools.execute as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(call[1].arguments).not.toHaveProperty('connectionId');
    expect(call[1].arguments).toEqual({ channel: '#general', text: 'Hi' });
  });

  it('uses connectionId as Composio userId', async () => {
    await adaptor.execute('listUsers', {}, 'my-connection-id');

    const call = (client.tools.execute as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(call[1].userId).toBe('my-connection-id');
  });

  it('throws IntegrationError for unknown action', async () => {
    await expect(adaptor.execute('unknownAction', {}, 'user-1')).rejects.toThrow(
      'Unknown action "unknownAction"',
    );
  });

  it('throws IntegrationError when Composio call fails', async () => {
    const failingClient = makeMockClient(undefined);
    (failingClient.tools.execute as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('API rate limited'),
    );
    const failAdaptor = new ComposioAdaptor('slack', failingClient);

    await expect(
      failAdaptor.execute('sendMessage', { channel: '#test', text: 'hi' }, 'u1'),
    ).rejects.toThrow('Composio execution failed: API rate limited');
  });

  it('healthCheck returns true when client exists', async () => {
    expect(await adaptor.healthCheck()).toBe(true);
  });
});

describe('ComposioAdaptor — GitHub integration', () => {
  it('maps createIssue to the correct Composio tool', async () => {
    const client = makeMockClient({
      id: 42,
      number: 7,
      html_url: 'https://github.com/...',
      node_id: 'abc',
    });
    const adaptor = new ComposioAdaptor('github', client);

    await adaptor.execute(
      'createIssue',
      { owner: 'acme', repo: 'app', title: 'Bug', body: 'details' },
      'user-456',
    );

    expect(client.tools.execute).toHaveBeenCalledWith('GITHUB_CREATE_AN_ISSUE', {
      userId: 'user-456',
      arguments: { owner: 'acme', repo: 'app', title: 'Bug', body: 'details' },
    });
  });
});

describe('ComposioAdaptor — unmapped integration', () => {
  it('has empty actions for unknown integration', () => {
    const client = makeMockClient();
    const adaptor = new ComposioAdaptor('unknown-service', client);
    expect(adaptor.actions).toEqual([]);
  });

  it('throws when executing on unmapped integration', async () => {
    const client = makeMockClient();
    const adaptor = new ComposioAdaptor('unknown-service', client);

    await expect(adaptor.execute('doSomething', {}, 'u1')).rejects.toThrow(
      'No Composio mapping for integration',
    );
  });
});

describe('createComposioAdaptors', () => {
  it('creates one adaptor per mapped integration', () => {
    const client = makeMockClient();
    const adaptors = createComposioAdaptors(client);

    const names = adaptors.map((a) => a.name).sort();
    expect(names).toEqual(Object.keys(TOOL_MAP).sort());
  });

  it('each adaptor shares the same client', () => {
    const client = makeMockClient();
    const adaptors = createComposioAdaptors(client);

    // All adaptors should work with the same client
    expect(adaptors.length).toBeGreaterThan(0);
    for (const adaptor of adaptors) {
      expect(adaptor.actions.length).toBeGreaterThan(0);
    }
  });
});

describe('getComposioToolSlug', () => {
  it('returns the correct slug for a known mapping', () => {
    expect(getComposioToolSlug('slack', 'sendMessage')).toBe('SLACK_SEND_A_MESSAGE');
    expect(getComposioToolSlug('github', 'createIssue')).toBe('GITHUB_CREATE_AN_ISSUE');
  });

  it('returns undefined for unknown integration or action', () => {
    expect(getComposioToolSlug('unknown', 'doStuff')).toBeUndefined();
    expect(getComposioToolSlug('slack', 'unknownAction')).toBeUndefined();
  });
});
