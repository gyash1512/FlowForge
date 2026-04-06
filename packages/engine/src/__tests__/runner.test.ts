import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Runner } from '../runner.js';
import { NoopLogger } from '../logger.js';
import { RunStatus } from '@flowforge/shared';
import type { WorkflowDefinition, WorkflowStep, ControlFlowStep, NodeContext } from '@flowforge/shared';

type Ctx = NodeContext;

function makeNode(name: string, handler: (ctx: Ctx) => Promise<unknown>, opts?: Record<string, unknown>) {
  return {
    name,
    version: '1.0.0',
    description: name,
    category: 'custom' as const,
    inputSchema: z.any(),
    outputSchema: z.any(),
    configSchema: z.any(),
    handler,
    ...opts,
  };
}

function makeWorkflow(steps: Array<WorkflowStep | ControlFlowStep>, overrides?: Partial<WorkflowDefinition>): WorkflowDefinition {
  return {
    id: 'test-wf',
    name: 'Test Workflow',
    version: '1.0.0',
    trigger: { type: 'manual' },
    steps,
    ...overrides,
  };
}

describe('Runner', () => {
  const runner = new Runner({ logger: new NoopLogger() });

  it('executes a single-step workflow', async () => {
    const wf = makeWorkflow([
      { name: 'echo', node: makeNode('test/echo', async (ctx: Ctx) => ctx.input) },
    ]);
    const run = await runner.execute(wf, 'hello');
    expect(run.status).toBe(RunStatus.COMPLETED);
    expect(run.output).toBe('hello');
  });

  it('passes output between dependent steps', async () => {
    const wf = makeWorkflow([
      { name: 'add', node: makeNode('test/add', async () => 5) },
      {
        name: 'double',
        node: makeNode('test/double', async (ctx: Ctx) => (ctx.input as number) * 2),
        input: (ctx) => ctx.steps['add'],
        dependsOn: ['add'],
      },
    ]);
    const run = await runner.execute(wf, null);
    expect(run.status).toBe(RunStatus.COMPLETED);
    expect(run.output).toBe(10);
  });

  it('handles parallel steps (diamond)', async () => {
    const wf = makeWorkflow([
      { name: 'source', node: makeNode('test/source', async () => 1) },
      {
        name: 'left',
        node: makeNode('test/left', async (ctx: Ctx) => (ctx.input as number) + 10),
        input: (ctx) => ctx.steps['source'],
        dependsOn: ['source'],
      },
      {
        name: 'right',
        node: makeNode('test/right', async (ctx: Ctx) => (ctx.input as number) + 20),
        input: (ctx) => ctx.steps['source'],
        dependsOn: ['source'],
      },
      {
        name: 'merge',
        node: makeNode('test/merge', async (ctx: Ctx) => {
          return (ctx.steps['left'] as number) + (ctx.steps['right'] as number);
        }),
        input: (ctx) => ctx.steps,
        dependsOn: ['left', 'right'],
      },
    ]);
    const run = await runner.execute(wf, null);
    expect(run.status).toBe(RunStatus.COMPLETED);
    expect(run.output).toBe(32);
  });

  it('skips conditional steps', async () => {
    const handler = vi.fn().mockResolvedValue('ran');
    const wf = makeWorkflow([
      {
        name: 'conditional',
        node: makeNode('test/cond', handler),
        when: () => false,
      },
    ]);
    const run = await runner.execute(wf, null);
    expect(run.status).toBe(RunStatus.COMPLETED);
    expect(handler).not.toHaveBeenCalled();
  });

  it('retries failed steps', async () => {
    let attempt = 0;
    const wf = makeWorkflow([
      {
        name: 'retry',
        node: makeNode('test/retry', async () => {
          attempt++;
          if (attempt < 3) throw new Error('not yet');
          return 'done';
        }, { retries: 3 }),
      },
    ]);
    const run = await runner.execute(wf, null);
    expect(run.status).toBe(RunStatus.COMPLETED);
    expect(run.output).toBe('done');
  });

  it('fails after retry exhaustion', async () => {
    const wf = makeWorkflow([
      {
        name: 'fail',
        node: makeNode('test/fail', async () => { throw new Error('permanent'); }, { retries: 2 }),
      },
    ]);
    const run = await runner.execute(wf, null);
    expect(run.status).toBe(RunStatus.FAILED);
    expect(run.error).toContain('exhausted');
  });

  it('times out on slow steps', async () => {
    const wf = makeWorkflow([
      {
        name: 'slow',
        node: makeNode('test/slow', async () => new Promise((resolve) => setTimeout(resolve, 500)), { timeout: 50 }),
      },
    ]);
    const run = await runner.execute(wf, null);
    expect(run.status).toBe(RunStatus.FAILED);
    expect(run.error).toContain('timed out');
  });

  it('executes if control flow', async () => {
    const wf = makeWorkflow([
      { name: 'check', node: makeNode('test/check', async () => 5) },
      {
        type: 'if' as const,
        name: 'branch',
        condition: (ctx) => (ctx.steps['check'] as number) > 3,
        then: [
          { name: 'positive', node: makeNode('test/pos', async () => 'yes') },
        ],
        else: [
          { name: 'negative', node: makeNode('test/neg', async () => 'no') },
        ],
      },
    ]);
    const run = await runner.execute(wf, null);
    expect(run.status).toBe(RunStatus.COMPLETED);
  });

  it('executes parallel control flow', async () => {
    const wf: WorkflowDefinition = {
      id: 'parallel-wf',
      name: 'Parallel',
      version: '1.0.0',
      trigger: { type: 'manual' },
      steps: [
        {
          type: 'parallel' as const,
          name: 'process-items',
          items: () => [1, 2, 3],
          concurrency: 2,
          pipeline: (item: unknown) => [
            { name: 'double', node: makeNode('test/double', async (ctx: Ctx) => (ctx.input as number) * 2), input: () => item },
          ],
        },
      ],
    };
    const run = await runner.execute(wf, null);
    expect(run.status).toBe(RunStatus.COMPLETED);
    expect(run.output).toEqual([2, 4, 6]);
  });

  it('provides metadata in context', async () => {
    const wf = makeWorkflow([
      {
        name: 'meta',
        node: makeNode('test/meta', async (ctx: Ctx) => ({
          runId: ctx.metadata.runId,
          workflowId: ctx.metadata.workflowId,
        })),
      },
    ]);
    const run = await runner.execute(wf, null);
    expect(run.status).toBe(RunStatus.COMPLETED);
    const output = run.output as Record<string, unknown>;
    expect(output['runId']).toMatch(/^run_/);
    expect(output['workflowId']).toBe('test-wf');
  });
});
