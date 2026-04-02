import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Engine } from '../engine.js';
import { NoopLogger } from '../logger.js';
import type { WorkflowDefinition, WorkflowStep } from '@flowforge/shared';
import { RunStatus } from '@flowforge/shared';

function makeNode(name: string, handler: (...args: unknown[]) => Promise<unknown>) {
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

function makeWorkflow(id: string, steps: WorkflowStep[], overrides?: Partial<WorkflowDefinition>): WorkflowDefinition {
  return {
    id,
    name: id,
    version: '1.0.0',
    trigger: { type: 'manual' },
    steps,
    ...overrides,
  };
}

describe('Engine', () => {
  it('registers and lists workflows', () => {
    const engine = new Engine({ logger: new NoopLogger() });
    const wf = makeWorkflow('test', [
      { name: 'step-1', node: makeNode('test/step', async (ctx: any) => ctx.input) },
    ]);
    engine.register(wf);
    expect(engine.getWorkflow('test')).toBe(wf);
    expect(engine.listWorkflows()).toHaveLength(1);
  });

  it('triggers a workflow and returns run record', async () => {
    const engine = new Engine({ logger: new NoopLogger() });
    engine.register(
      makeWorkflow('test', [
        { name: 'step-1', node: makeNode('test/echo', async (ctx: any) => `echo: ${JSON.stringify(ctx.input)}`) },
      ]),
    );
    const run = await engine.trigger('test', { name: 'test' });
    expect(run.status).toBe(RunStatus.COMPLETED);
    expect(run.id).toMatch(/^run_/);
  });

  it('throws for unknown workflow', async () => {
    const engine = new Engine({ logger: new NoopLogger() });
    await expect(engine.trigger('nonexistent')).rejects.toThrow('Workflow not found');
  });

  it('handles multi-step workflow', async () => {
    const engine = new Engine({ logger: new NoopLogger() });
    engine.register(
      makeWorkflow('multi', [
        { name: 'add', node: makeNode('test/add', async () => 10) },
        {
          name: 'double',
          node: makeNode('test/double', async (ctx: any) => (ctx.steps?.add as number) * 2),
          input: (ctx) => ctx.steps['add'],
          dependsOn: ['add'],
        },
      ]),
    );
    const run = await engine.trigger('multi');
    expect(run.status).toBe(RunStatus.COMPLETED);
    expect(run.output).toBe(20);
  });

  it('emits events to matching workflows', async () => {
    const engine = new Engine({ logger: new NoopLogger() });
    engine.register(
      makeWorkflow('event-wf', [
        { name: 'step', node: makeNode('test/echo', async (ctx: any) => ctx.input) },
      ], { trigger: { type: 'event', event: 'user.created' } }),
    );
    const runs = await engine.emit('user.created', { userId: '123' });
    expect(runs).toHaveLength(1);
    expect(runs[0]!.status).toBe(RunStatus.COMPLETED);
  });

  it('captures failure in run record', async () => {
    const engine = new Engine({ logger: new NoopLogger() });
    engine.register(
      makeWorkflow('failing', [
        { name: 'fail', node: makeNode('test/fail', async () => { throw new Error('boom'); }) },
      ]),
    );
    const run = await engine.trigger('failing');
    expect(run.status).toBe(RunStatus.FAILED);
    expect(run.error).toContain('boom');
  });

  it('stores and retrieves runs', async () => {
    const engine = new Engine({ logger: new NoopLogger() });
    engine.register(
      makeWorkflow('test', [
        { name: 'step', node: makeNode('test/ok', async () => 'ok') },
      ]),
    );
    const run = await engine.trigger('test');
    expect(engine.getRun(run.id)).toBe(run);
  });

  it('lists runs filtered by workflow', async () => {
    const engine = new Engine({ logger: new NoopLogger() });
    engine.register(makeWorkflow('wf-a', [{ name: 's', node: makeNode('a', async () => 1) }]));
    engine.register(makeWorkflow('wf-b', [{ name: 's', node: makeNode('b', async () => 2) }]));
    await engine.trigger('wf-a');
    await engine.trigger('wf-b');
    await engine.trigger('wf-a');
    expect(engine.listRuns('wf-a')).toHaveLength(2);
    expect(engine.listRuns('wf-b')).toHaveLength(1);
  });
});
