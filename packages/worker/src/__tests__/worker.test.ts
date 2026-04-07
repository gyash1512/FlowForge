import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { Worker } from '../worker.js';
import type { WorkflowDefinition, WorkflowStep, NodeDefinition } from '@flowforgejs/shared';
import { RunStatus } from '@flowforgejs/shared';

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function makeNode(name: string, handler: (...args: unknown[]) => Promise<unknown>): NodeDefinition {
  return {
    name,
    version: '1.0.0',
    description: name,
    category: 'custom' as const,
    inputSchema: z.any(),
    outputSchema: z.any(),
    configSchema: z.any(),
    handler,
  };
}

function makeWorkflow(
  id: string,
  steps: WorkflowStep[],
  overrides?: Partial<WorkflowDefinition>,
): WorkflowDefinition {
  return {
    id,
    name: `workflow-${id}`,
    version: '1.0.0',
    trigger: { type: 'manual' },
    steps,
    ...overrides,
  };
}

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => noopLogger,
};

// ────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────

describe('Worker', () => {
  let worker: Worker;

  beforeEach(() => {
    worker = new Worker({ logger: noopLogger });
  });

  afterEach(async () => {
    await worker.stop();
  });

  it('creates a worker in local mode', () => {
    expect(worker).toBeDefined();
    expect(worker.isRunning).toBe(false);
  });

  it('registers and lists workflows', () => {
    const wf = makeWorkflow('wf-1', [
      { name: 'step-1', node: makeNode('test/noop', async () => null) },
    ]);
    worker.register(wf);
    expect(worker.listWorkflows()).toHaveLength(1);
    expect(worker.listWorkflows()[0]!.id).toBe('wf-1');
  });

  it('unregisters workflows', () => {
    const wf = makeWorkflow('wf-1', [
      { name: 'step-1', node: makeNode('test/noop', async () => null) },
    ]);
    worker.register(wf);
    worker.unregister('wf-1');
    expect(worker.listWorkflows()).toHaveLength(0);
  });

  it('handles events and triggers matching workflows', async () => {
    const wf = makeWorkflow(
      'event-wf',
      [
        {
          name: 'step-1',
          node: makeNode('test/echo', async (ctx: any) => ctx.input),
        },
      ],
      { trigger: { type: 'event', event: 'user.signup' } },
    );
    worker.register(wf);

    const runs = await worker.handleEvent('user.signup', { email: 'test@test.com' });

    expect(runs).toHaveLength(1);
    expect(runs[0]!.status).toBe(RunStatus.COMPLETED);
    expect(runs[0]!.workflowId).toBe('event-wf');
  });

  it('returns empty array when no workflows match an event', async () => {
    const wf = makeWorkflow(
      'wf-1',
      [{ name: 'step-1', node: makeNode('test/noop', async () => null) }],
      { trigger: { type: 'event', event: 'user.signup' } },
    );
    worker.register(wf);

    const runs = await worker.handleEvent('order.placed', { orderId: '123' });
    expect(runs).toHaveLength(0);
  });

  it('stores runs and retrieves them', async () => {
    const wf = makeWorkflow(
      'wf-store',
      [
        {
          name: 'step-1',
          node: makeNode('test/echo', async (ctx: any) => ctx.input),
        },
      ],
      { trigger: { type: 'event', event: 'test.event' } },
    );
    worker.register(wf);

    const runs = await worker.handleEvent('test.event', { value: 42 });
    const runId = runs[0]!.id;

    const retrieved = worker.getRun(runId);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(runId);
    expect(retrieved!.status).toBe(RunStatus.COMPLETED);
  });

  it('lists runs with filtering', async () => {
    const wfA = makeWorkflow(
      'wf-a',
      [{ name: 'step-1', node: makeNode('test/ok', async () => 'a') }],
      { trigger: { type: 'event', event: 'evt-a' } },
    );
    const wfB = makeWorkflow(
      'wf-b',
      [{ name: 'step-1', node: makeNode('test/ok', async () => 'b') }],
      { trigger: { type: 'event', event: 'evt-b' } },
    );
    worker.register(wfA);
    worker.register(wfB);

    await worker.handleEvent('evt-a', {});
    await worker.handleEvent('evt-b', {});
    await worker.handleEvent('evt-a', {});

    const allRuns = worker.listRuns();
    expect(allRuns).toHaveLength(3);

    const filteredRuns = worker.listRuns({ workflowId: 'wf-a' });
    expect(filteredRuns).toHaveLength(2);
  });

  it('captures failed workflows in run records', async () => {
    const wf = makeWorkflow(
      'fail-wf',
      [
        {
          name: 'fail-step',
          node: makeNode('test/fail', async () => {
            throw new Error('boom');
          }),
        },
      ],
      { trigger: { type: 'event', event: 'fail.event' } },
    );
    worker.register(wf);

    const runs = await worker.handleEvent('fail.event', {});
    expect(runs).toHaveLength(1);
    expect(runs[0]!.status).toBe(RunStatus.FAILED);
    expect(runs[0]!.error).toContain('boom');
  });

  it('triggers multiple workflows for the same event', async () => {
    const wf1 = makeWorkflow(
      'multi-1',
      [{ name: 'step-1', node: makeNode('test/ok', async () => 'from-1') }],
      { trigger: { type: 'event', event: 'shared.event' } },
    );
    const wf2 = makeWorkflow(
      'multi-2',
      [{ name: 'step-1', node: makeNode('test/ok', async () => 'from-2') }],
      { trigger: { type: 'event', event: 'shared.event' } },
    );
    worker.register(wf1);
    worker.register(wf2);

    const runs = await worker.handleEvent('shared.event', {});
    expect(runs).toHaveLength(2);
    expect(runs.every((r) => r.status === RunStatus.COMPLETED)).toBe(true);
  });

  it('exposes the Hono app for testing', () => {
    expect(worker.honoApp).toBeDefined();
    expect(typeof worker.honoApp.fetch).toBe('function');
  });

  it('manual trigger via handleEvent with workflowId in data', async () => {
    const wf = makeWorkflow(
      'manual-wf',
      [{ name: 'step-1', node: makeNode('test/ok', async () => 'triggered') }],
      { trigger: { type: 'manual' } },
    );
    worker.register(wf);

    const runs = await worker.handleEvent('manual', { workflowId: 'manual-wf' });
    expect(runs).toHaveLength(1);
    expect(runs[0]!.status).toBe(RunStatus.COMPLETED);
  });
});
