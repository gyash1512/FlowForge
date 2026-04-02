import { describe, it, expect } from 'vitest';
import { createMockContext } from '../mock-context.js';
import { MockLogger } from '../mock-logger.js';

describe('createMockContext', () => {
  it('creates a context with default values', () => {
    const { ctx, calls } = createMockContext();

    expect(ctx.input).toEqual({});
    expect(ctx.config).toEqual({});
    expect(ctx.event.type).toBe('test');
    expect(ctx.steps).toEqual({});
    expect(ctx.metadata.workflowId).toBe('wf_mock');
    expect(ctx.metadata.runId).toBe('run_mock');
    expect(ctx.signal).toBeInstanceOf(AbortSignal);
    expect(calls).toHaveLength(0);
  });

  it('accepts input and config overrides', () => {
    const { ctx } = createMockContext({
      input: { name: 'test' },
      config: { retries: 5 },
    });

    expect(ctx.input).toEqual({ name: 'test' });
    expect(ctx.config).toEqual({ retries: 5 });
  });

  it('accepts event overrides', () => {
    const { ctx } = createMockContext({
      event: { type: 'user.created', data: { userId: '123' } },
    });

    expect(ctx.event.type).toBe('user.created');
    expect(ctx.event.data).toEqual({ userId: '123' });
  });

  it('accepts step overrides', () => {
    const { ctx } = createMockContext({
      steps: { 'fetch-data': { items: [1, 2, 3] } },
    });

    expect(ctx.steps['fetch-data']).toEqual({ items: [1, 2, 3] });
  });

  it('accepts metadata overrides', () => {
    const { ctx } = createMockContext({
      metadata: { workflowId: 'custom-wf', attempt: 3 },
    });

    expect(ctx.metadata.workflowId).toBe('custom-wf');
    expect(ctx.metadata.attempt).toBe(3);
  });

  it('tracks pull calls', async () => {
    const { ctx, calls } = createMockContext();

    await ctx.pull('postgres', { query: 'SELECT *' });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('pull');
    expect(calls[0]!.args).toEqual(['postgres', { query: 'SELECT *' }]);
  });

  it('tracks push calls', async () => {
    const { ctx, calls } = createMockContext();

    await ctx.push('s3', { bucket: 'my-bucket', data: 'hello' });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('push');
    expect(calls[0]!.args).toEqual(['s3', { bucket: 'my-bucket', data: 'hello' }]);
  });

  it('tracks integrate calls', async () => {
    const { ctx, calls } = createMockContext();

    await ctx.integrate('slack', 'send-message', { channel: '#general', text: 'hi' });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('integrate');
    expect(calls[0]!.args).toEqual(['slack', 'send-message', { channel: '#general', text: 'hi' }]);
  });

  it('tracks emit calls', async () => {
    const { ctx, calls } = createMockContext();

    await ctx.emit('user.updated', { userId: '123' });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('emit');
    expect(calls[0]!.args).toEqual(['user.updated', { userId: '123' }]);
  });

  it('tracks wait calls', async () => {
    const { ctx, calls } = createMockContext();

    await ctx.wait('approval.received', { runId: 'run_1' }, 5000);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('wait');
    expect(calls[0]!.args).toEqual(['approval.received', { runId: 'run_1' }, 5000]);
  });

  it('tracks sleep calls without actually sleeping', async () => {
    const { ctx, calls } = createMockContext();

    const start = Date.now();
    await ctx.sleep(10_000);
    const elapsed = Date.now() - start;

    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('sleep');
    expect(calls[0]!.args).toEqual([10_000]);
    // Should not actually sleep
    expect(elapsed).toBeLessThan(100);
  });

  it('tracks checkpoint calls', async () => {
    const { ctx, calls } = createMockContext();

    await ctx.checkpoint();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('checkpoint');
  });

  it('provides a MockLogger instance', () => {
    const { ctx, logger } = createMockContext();

    ctx.logger.info('hello world');
    ctx.logger.error('something failed');

    expect(logger).toBeInstanceOf(MockLogger);
    expect(logger.calls).toHaveLength(2);
    expect(logger.hasMessage('hello world')).toBe(true);
    expect(logger.hasMessage('something failed')).toBe(true);
  });

  it('tracks multiple calls across methods', async () => {
    const { ctx, calls } = createMockContext({ input: 'test-input' });

    await ctx.pull('db', { query: 'SELECT 1' });
    await ctx.emit('processed', { result: true });
    await ctx.checkpoint();
    await ctx.sleep(100);

    expect(calls).toHaveLength(4);
    expect(calls.map((c) => c.method)).toEqual(['pull', 'emit', 'checkpoint', 'sleep']);
  });
});
