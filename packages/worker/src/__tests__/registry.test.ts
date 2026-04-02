import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { WorkflowRegistry } from '../registry.js';
import type { WorkflowDefinition } from '@flowforge/shared';

function makeWorkflow(
  id: string,
  overrides?: Partial<WorkflowDefinition>,
): WorkflowDefinition {
  return {
    id,
    name: `workflow-${id}`,
    version: '1.0.0',
    trigger: { type: 'manual' },
    steps: [
      {
        name: 'step-1',
        node: {
          name: 'test/noop',
          version: '1.0.0',
          description: 'noop',
          category: 'custom' as const,
          inputSchema: z.any(),
          outputSchema: z.any(),
          configSchema: z.any(),
          handler: async () => null,
        },
      },
    ],
    ...overrides,
  };
}

describe('WorkflowRegistry', () => {
  it('registers and retrieves a workflow', () => {
    const registry = new WorkflowRegistry();
    const wf = makeWorkflow('wf-1');
    registry.register(wf);
    expect(registry.get('wf-1')).toBe(wf);
  });

  it('has() returns true for registered workflows', () => {
    const registry = new WorkflowRegistry();
    registry.register(makeWorkflow('wf-1'));
    expect(registry.has('wf-1')).toBe(true);
    expect(registry.has('wf-2')).toBe(false);
  });

  it('find() returns undefined for unregistered workflows', () => {
    const registry = new WorkflowRegistry();
    expect(registry.find('wf-nope')).toBeUndefined();
  });

  it('get() throws for unregistered workflows', () => {
    const registry = new WorkflowRegistry();
    expect(() => registry.get('wf-nope')).toThrow('Workflow not found');
  });

  it('lists all registered workflows', () => {
    const registry = new WorkflowRegistry();
    registry.register(makeWorkflow('wf-1'));
    registry.register(makeWorkflow('wf-2'));
    registry.register(makeWorkflow('wf-3'));
    expect(registry.list()).toHaveLength(3);
  });

  it('unregisters a workflow', () => {
    const registry = new WorkflowRegistry();
    registry.register(makeWorkflow('wf-1'));
    expect(registry.unregister('wf-1')).toBe(true);
    expect(registry.has('wf-1')).toBe(false);
    expect(registry.size).toBe(0);
  });

  it('unregister returns false for non-existent workflow', () => {
    const registry = new WorkflowRegistry();
    expect(registry.unregister('nope')).toBe(false);
  });

  it('clear() removes all workflows', () => {
    const registry = new WorkflowRegistry();
    registry.register(makeWorkflow('wf-1'));
    registry.register(makeWorkflow('wf-2'));
    registry.clear();
    expect(registry.size).toBe(0);
    expect(registry.list()).toHaveLength(0);
  });

  it('overwrites a workflow with the same id', () => {
    const registry = new WorkflowRegistry();
    const wf1 = makeWorkflow('wf-1', { version: '1.0.0' });
    const wf2 = makeWorkflow('wf-1', { version: '2.0.0' });
    registry.register(wf1);
    registry.register(wf2);
    expect(registry.size).toBe(1);
    expect(registry.get('wf-1').version).toBe('2.0.0');
  });

  it('findByEvent returns workflows matching an event type', () => {
    const registry = new WorkflowRegistry();
    registry.register(
      makeWorkflow('wf-event', {
        trigger: { type: 'event', event: 'user.created' },
      }),
    );
    registry.register(
      makeWorkflow('wf-manual', {
        trigger: { type: 'manual' },
      }),
    );
    registry.register(
      makeWorkflow('wf-event-2', {
        trigger: { type: 'event', event: 'user.created' },
      }),
    );
    registry.register(
      makeWorkflow('wf-other-event', {
        trigger: { type: 'event', event: 'order.placed' },
      }),
    );

    const matches = registry.findByEvent('user.created');
    expect(matches).toHaveLength(2);
    expect(matches.map((w) => w.id).sort()).toEqual(['wf-event', 'wf-event-2']);
  });

  it('findCronWorkflows returns only cron-triggered workflows', () => {
    const registry = new WorkflowRegistry();
    registry.register(
      makeWorkflow('wf-cron', {
        trigger: { type: 'cron', cron: '*/5 * * * *' },
      }),
    );
    registry.register(
      makeWorkflow('wf-event', {
        trigger: { type: 'event', event: 'foo' },
      }),
    );
    const crons = registry.findCronWorkflows();
    expect(crons).toHaveLength(1);
    expect(crons[0]!.id).toBe('wf-cron');
  });

  it('size reflects number of registered workflows', () => {
    const registry = new WorkflowRegistry();
    expect(registry.size).toBe(0);
    registry.register(makeWorkflow('wf-1'));
    expect(registry.size).toBe(1);
    registry.register(makeWorkflow('wf-2'));
    expect(registry.size).toBe(2);
    registry.unregister('wf-1');
    expect(registry.size).toBe(1);
  });
});
