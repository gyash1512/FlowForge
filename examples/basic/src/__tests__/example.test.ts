import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defineNode, workflow, RunStatus } from '@flowforgejs/sdk';
import { Engine, NoopLogger } from '@flowforgejs/engine';

describe('basic example', () => {
  it('runs a simple pipeline using defineNode and workflow().node()', async () => {
    const doubleNode = defineNode({
      name: 'double',
      version: '1.0.0',
      description: 'Doubles the input',
      category: 'transform',
      inputSchema: z.number(),
      outputSchema: z.number(),
      configSchema: z.object({}),
      handler: async (ctx) => ctx.input * 2,
    });

    const addTenNode = defineNode({
      name: 'add-ten',
      version: '1.0.0',
      description: 'Adds ten to the input',
      category: 'transform',
      inputSchema: z.number(),
      outputSchema: z.number(),
      configSchema: z.object({}),
      handler: async (ctx) => ctx.input + 10,
    });

    const wf = workflow('math')
      .trigger({ type: 'manual' })
      .node('double', doubleNode)
      .node('add-ten', addTenNode, {
        input: (ctx) => ctx.steps['double'],
      })
      .build();

    const engine = new Engine({ logger: new NoopLogger() });
    engine.register(wf);

    const run = await engine.trigger('math', 5);
    expect(run.status).toBe(RunStatus.COMPLETED);
    expect(run.output).toBe(20); // 5*2 + 10
  });

  it('runs the user sync pipeline end to end', async () => {
    const fetchNode = defineNode({
      name: 'fetch-users',
      version: '1.0.0',
      description: 'Fetch users',
      category: 'data',
      inputSchema: z.any(),
      outputSchema: z.array(z.object({ id: z.string(), name: z.string(), email: z.string() })),
      configSchema: z.object({}),
      handler: async () => [
        { id: '1', name: 'Alice', email: 'alice@example.com' },
        { id: '2', name: 'Bob', email: 'bob@example.com' },
      ],
    });

    const transformNode = defineNode({
      name: 'transform-users',
      version: '1.0.0',
      description: 'Transform users',
      category: 'transform',
      inputSchema: z.any(),
      outputSchema: z.array(z.any()),
      configSchema: z.object({}),
      handler: async (ctx) => {
        const users = ctx.input as Array<{ name: string; email: string }>;
        return users.map((u) => ({ ...u, processed: true }));
      },
    });

    const notifyNode = defineNode({
      name: 'notify',
      version: '1.0.0',
      description: 'Send notifications',
      category: 'communication',
      inputSchema: z.any(),
      outputSchema: z.object({ sent: z.number() }),
      configSchema: z.object({}),
      handler: async (ctx) => {
        const users = ctx.input as unknown[];
        return { sent: users.length };
      },
    });

    const wf = workflow('user-sync-test')
      .trigger({ type: 'manual' })
      .node('fetch', fetchNode)
      .node('transform', transformNode, {
        input: (ctx) => ctx.steps['fetch'],
      })
      .node('notify', notifyNode, {
        input: (ctx) => ctx.steps['transform'],
      })
      .build();

    const engine = new Engine({ logger: new NoopLogger() });
    engine.register(wf);

    const run = await engine.trigger('user-sync-test');
    expect(run.status).toBe(RunStatus.COMPLETED);
    expect(run.output).toEqual({ sent: 2 });
  });

  it('handles conditional steps with workflow().if()', async () => {
    const successNode = defineNode({
      name: 'success-handler',
      version: '1.0.0',
      description: 'Handles success case',
      category: 'custom',
      inputSchema: z.any(),
      outputSchema: z.object({ result: z.string() }),
      configSchema: z.object({}),
      handler: async () => ({ result: 'success' }),
    });

    const failureNode = defineNode({
      name: 'failure-handler',
      version: '1.0.0',
      description: 'Handles failure case',
      category: 'custom',
      inputSchema: z.any(),
      outputSchema: z.object({ result: z.string() }),
      configSchema: z.object({}),
      handler: async () => ({ result: 'failure' }),
    });

    const checkNode = defineNode({
      name: 'check',
      version: '1.0.0',
      description: 'Checks input',
      category: 'control',
      inputSchema: z.any(),
      outputSchema: z.object({ valid: z.boolean() }),
      configSchema: z.object({}),
      handler: async (ctx) => ({ valid: (ctx.input as { valid?: boolean }).valid ?? false }),
    });

    const wf = workflow('conditional')
      .trigger({ type: 'manual' })
      .node('check', checkNode)
      .if('branch', {
        condition: (ctx) => (ctx.steps['check'] as { valid: boolean }).valid === true,
        then: [['on-success', successNode]],
        else: [['on-failure', failureNode]],
      })
      .build();

    const engine = new Engine({ logger: new NoopLogger() });
    engine.register(wf);

    const run = await engine.trigger('conditional', { valid: true });
    expect(run.status).toBe(RunStatus.COMPLETED);
  });
});
