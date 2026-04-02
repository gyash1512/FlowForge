import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { workflow } from '../workflow-builder.js';
import { defineNode } from '../define-node.js';

const dummyNode = defineNode({
  name: 'test/dummy',
  version: '1.0.0',
  description: 'Dummy node',
  category: 'custom',
  inputSchema: z.any(),
  outputSchema: z.any(),
  configSchema: z.any(),
  handler: async () => 'ok',
});

const dummyNode2 = defineNode({
  name: 'test/dummy2',
  version: '1.0.0',
  description: 'Dummy node 2',
  category: 'custom',
  inputSchema: z.any(),
  outputSchema: z.any(),
  configSchema: z.any(),
  handler: async () => 'ok2',
});

describe('WorkflowBuilder', () => {
  it('builds a minimal workflow', () => {
    const wf = workflow('simple')
      .trigger({ type: 'manual' })
      .node('step-1', dummyNode)
      .build();

    expect(wf.id).toBe('simple');
    expect(wf.name).toBe('simple');
    expect(wf.version).toBe('1.0.0');
    expect(wf.trigger.type).toBe('manual');
    expect(wf.steps).toHaveLength(1);
  });

  it('throws without trigger', () => {
    expect(() =>
      workflow('no-trigger').node('a', dummyNode).build(),
    ).toThrow('requires a trigger');
  });

  it('throws without steps', () => {
    expect(() => workflow('no-steps').trigger({ type: 'manual' }).build()).toThrow(
      'requires at least one step',
    );
  });

  it('sets all builder properties', () => {
    const wf = workflow('full')
      .name('Full Workflow')
      .version('2.0.0')
      .description('A test workflow')
      .trigger({ type: 'event', event: 'user.created' })
      .timeout(60000)
      .retry({ maxAttempts: 5, backoff: 'linear', delayMs: 2000 })
      .metadata({ team: 'platform' })
      .node('a', dummyNode)
      .build();

    expect(wf.name).toBe('Full Workflow');
    expect(wf.version).toBe('2.0.0');
    expect(wf.description).toBe('A test workflow');
    expect(wf.trigger.event).toBe('user.created');
    expect(wf.timeout).toBe(60000);
    expect(wf.retry?.maxAttempts).toBe(5);
    expect(wf.metadata).toEqual({ team: 'platform' });
  });

  it('adds multiple node steps', () => {
    const wf = workflow('pipeline')
      .trigger({ type: 'manual' })
      .node('step-1', dummyNode)
      .node('step-2', dummyNode2)
      .node('step-3', dummyNode)
      .build();

    expect(wf.steps).toHaveLength(3);
  });

  it('supports inline handler functions', () => {
    const wf = workflow('inline')
      .trigger({ type: 'manual' })
      .node('compute', (ctx) => ({
        count: (ctx.steps['prev'] as unknown[])?.length ?? 0,
      }))
      .build();

    expect(wf.steps).toHaveLength(1);
    const step = wf.steps[0]!;
    expect('node' in step && step.node.name).toBe('inline/compute');
  });

  it('supports node step options (config, input, when, dependsOn)', () => {
    const wf = workflow('options')
      .trigger({ type: 'manual' })
      .node('step-1', dummyNode, {
        config: { key: 'value' },
        input: (ctx) => ctx.event.data,
        when: (ctx) => ctx.steps['prev'] !== undefined,
        dependsOn: ['other-step'],
      })
      .build();

    const step = wf.steps[0]! as { name: string; config: unknown; dependsOn: string[] };
    expect(step.config).toEqual({ key: 'value' });
    expect(step.dependsOn).toEqual(['other-step']);
  });

  it('supports if conditional', () => {
    const wf = workflow('conditional')
      .trigger({ type: 'manual' })
      .node('check', dummyNode)
      .if('branch', {
        condition: (ctx) => (ctx.steps['check'] as number) > 0,
        then: [['handle-positive', dummyNode]],
        else: [['handle-negative', dummyNode2]],
      })
      .build();

    expect(wf.steps).toHaveLength(2);
    const ifStep = wf.steps[1]!;
    expect('type' in ifStep && ifStep.type).toBe('if');
  });

  it('supports parallel fan-out', () => {
    const wf = workflow('fan-out')
      .trigger({ type: 'manual' })
      .parallel('process-items', {
        items: (ctx) => ctx.event.data as unknown[],
        concurrency: 5,
        pipeline: (item) => [['process', dummyNode, { input: () => item }]],
      })
      .build();

    expect(wf.steps).toHaveLength(1);
    const parallelStep = wf.steps[0]!;
    expect('type' in parallelStep && parallelStep.type).toBe('parallel');
  });

  it('supports forEach', () => {
    const wf = workflow('each')
      .trigger({ type: 'manual' })
      .forEach('iterate', {
        items: (ctx) => ctx.event.data as unknown[],
        concurrency: 10,
        pipeline: (item, idx) => [
          ['process', dummyNode, { input: () => ({ item, idx }) }],
        ],
      })
      .build();

    const step = wf.steps[0]!;
    expect('type' in step && step.type).toBe('forEach');
  });

  it('supports switch', () => {
    const wf = workflow('switch')
      .trigger({ type: 'manual' })
      .switch('route', {
        value: (ctx) => ctx.event.type,
        cases: {
          'user.created': [['handle-user', dummyNode]],
          'order.placed': [['handle-order', dummyNode2]],
        },
        default: [['handle-default', dummyNode]],
      })
      .build();

    const step = wf.steps[0]!;
    expect('type' in step && step.type).toBe('switch');
  });

  it('supports while loop', () => {
    const wf = workflow('loop')
      .trigger({ type: 'manual' })
      .while('retry-loop', {
        condition: (ctx) => (ctx.steps['attempt'] as number) < 3,
        maxIterations: 10,
        pipeline: [['attempt', dummyNode]],
      })
      .build();

    const step = wf.steps[0]!;
    expect('type' in step && step.type).toBe('while');
  });

  it('supports cron trigger', () => {
    const wf = workflow('cron-wf')
      .trigger({ type: 'cron', cron: '0 * * * *' })
      .node('tick', dummyNode)
      .build();

    expect(wf.trigger.type).toBe('cron');
    expect(wf.trigger.cron).toBe('0 * * * *');
  });

  it('supports webhook trigger', () => {
    const wf = workflow('webhook-wf')
      .trigger({ type: 'webhook', webhook: { path: '/hooks/stripe', method: 'POST' } })
      .node('handle', dummyNode)
      .build();

    expect(wf.trigger.type).toBe('webhook');
    expect(wf.trigger.webhook?.path).toBe('/hooks/stripe');
  });
});
