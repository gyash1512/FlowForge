import { describe, it, expect, vi } from 'vitest';
import { delayNode } from '../control/delay.js';
import { waitForEventNode } from '../control/wait-for-event.js';
import { subWorkflowNode } from '../control/sub-workflow.js';
import { createMockContext } from './helpers.js';

describe('control/delay', () => {
  it('should call ctx.sleep with configured ms', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const ctx = createMockContext({
      input: { data: { key: 'value' } },
      config: { ms: 5000 },
      sleep,
    });

    const result = await delayNode.handler(ctx);

    expect(sleep).toHaveBeenCalledWith(5000);
    expect(result.delayMs).toBe(5000);
    expect(result.data).toEqual({ key: 'value' });
    expect(result.resumedAt).toBeDefined();
  });

  it('should pass through undefined data', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const ctx = createMockContext({
      input: {},
      config: { ms: 100 },
      sleep,
    });

    const result = await delayNode.handler(ctx);

    expect(sleep).toHaveBeenCalledWith(100);
    expect(result.data).toBeUndefined();
    expect(result.delayMs).toBe(100);
  });

  it('should produce a valid ISO timestamp for resumedAt', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const ctx = createMockContext({
      input: {},
      config: { ms: 0 },
      sleep,
    });

    const result = await delayNode.handler(ctx);

    expect(new Date(result.resumedAt).toISOString()).toBe(result.resumedAt);
  });
});

describe('control/wait-for-event', () => {
  it('should call ctx.wait with event, match, and timeout', async () => {
    const wait = vi.fn().mockResolvedValue({ orderId: '123' });
    const ctx = createMockContext({
      input: { event: 'order.approved', match: { orderId: '123' }, timeout: 60_000 },
      config: { defaultTimeout: 300_000 },
      wait,
    });

    const result = await waitForEventNode.handler(ctx);

    expect(wait).toHaveBeenCalledWith('order.approved', { orderId: '123' }, 60_000);
    expect(result.event).toBe('order.approved');
    expect(result.data).toEqual({ orderId: '123' });
    expect(result.timedOut).toBe(false);
  });

  it('should use defaultTimeout from config when input timeout is not provided', async () => {
    const wait = vi.fn().mockResolvedValue({});
    const ctx = createMockContext({
      input: { event: 'test.event' },
      config: { defaultTimeout: 120_000 },
      wait,
    });

    await waitForEventNode.handler(ctx);

    expect(wait).toHaveBeenCalledWith('test.event', undefined, 120_000);
  });

  it('should handle timeout errors gracefully', async () => {
    const wait = vi.fn().mockRejectedValue(new Error('Wait timeout exceeded'));
    const ctx = createMockContext({
      input: { event: 'never.happens', timeout: 1000 },
      config: { defaultTimeout: 300_000 },
      wait,
    });

    const result = await waitForEventNode.handler(ctx);

    expect(result.timedOut).toBe(true);
    expect(result.data).toBeNull();
    expect(result.event).toBe('never.happens');
  });

  it('should rethrow non-timeout errors', async () => {
    const wait = vi.fn().mockRejectedValue(new Error('Connection lost'));
    const ctx = createMockContext({
      input: { event: 'test.event', timeout: 1000 },
      config: { defaultTimeout: 300_000 },
      wait,
    });

    await expect(waitForEventNode.handler(ctx)).rejects.toThrow('Connection lost');
  });
});

describe('control/sub-workflow', () => {
  it('should emit an event to trigger the sub-workflow', async () => {
    const emit = vi.fn().mockResolvedValue(undefined);
    const ctx = createMockContext({
      input: { workflowId: 'wf-child-1', data: { foo: 'bar' }, waitForCompletion: false },
      config: { eventPrefix: 'workflow:trigger', timeout: 300_000 },
      emit,
    });

    const result = await subWorkflowNode.handler(ctx);

    expect(emit).toHaveBeenCalledWith('workflow:trigger:wf-child-1', {
      workflowId: 'wf-child-1',
      data: { foo: 'bar' },
      parentRunId: 'run-test-1',
    });
    expect(result.emitted).toBe(true);
    expect(result.workflowId).toBe('wf-child-1');
    expect(result.result).toBeUndefined();
  });

  it('should wait for completion when waitForCompletion is true', async () => {
    const emit = vi.fn().mockResolvedValue(undefined);
    const wait = vi.fn().mockResolvedValue({ status: 'done', output: 42 });
    const ctx = createMockContext({
      input: { workflowId: 'wf-child-2', data: null, waitForCompletion: true },
      config: { eventPrefix: 'workflow:trigger', timeout: 60_000 },
      emit,
      wait,
    });

    const result = await subWorkflowNode.handler(ctx);

    expect(emit).toHaveBeenCalled();
    expect(wait).toHaveBeenCalledWith(
      'workflow:trigger:wf-child-2:completed',
      { parentRunId: 'run-test-1' },
      60_000,
    );
    expect(result.emitted).toBe(true);
    expect(result.result).toEqual({ status: 'done', output: 42 });
  });

  it('should use custom event prefix', async () => {
    const emit = vi.fn().mockResolvedValue(undefined);
    const ctx = createMockContext({
      input: { workflowId: 'my-wf', data: {}, waitForCompletion: false },
      config: { eventPrefix: 'custom:prefix', timeout: 300_000 },
      emit,
    });

    await subWorkflowNode.handler(ctx);

    expect(emit).toHaveBeenCalledWith('custom:prefix:my-wf', expect.any(Object));
  });
});
