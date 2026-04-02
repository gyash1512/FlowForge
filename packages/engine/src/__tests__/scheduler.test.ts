import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { resolveExecutionOrder } from '../scheduler.js';
import type { WorkflowStep } from '@flowforge/shared';

function makeStep(name: string, dependsOn?: string[]): WorkflowStep {
  return {
    name,
    node: {
      name: `test/${name}`,
      version: '1.0.0',
      description: name,
      category: 'custom',
      inputSchema: z.any(),
      outputSchema: z.any(),
      configSchema: z.any(),
      handler: async () => 'ok',
    },
    dependsOn,
  };
}

describe('resolveExecutionOrder', () => {
  it('returns single layer for independent steps', () => {
    const steps = [makeStep('a'), makeStep('b'), makeStep('c')];
    const layers = resolveExecutionOrder(steps);
    expect(layers).toHaveLength(1);
    expect(layers[0]!.map((s) => s.name).sort()).toEqual(['a', 'b', 'c']);
  });

  it('resolves linear dependency chain', () => {
    const steps = [makeStep('a'), makeStep('b', ['a']), makeStep('c', ['b'])];
    const layers = resolveExecutionOrder(steps);
    expect(layers).toHaveLength(3);
    expect(layers[0]![0]!.name).toBe('a');
    expect(layers[1]![0]!.name).toBe('b');
    expect(layers[2]![0]!.name).toBe('c');
  });

  it('resolves fan-out pattern', () => {
    const steps = [makeStep('source'), makeStep('a', ['source']), makeStep('b', ['source'])];
    const layers = resolveExecutionOrder(steps);
    expect(layers).toHaveLength(2);
    expect(layers[0]![0]!.name).toBe('source');
    expect(layers[1]!.map((s) => s.name).sort()).toEqual(['a', 'b']);
  });

  it('resolves diamond pattern', () => {
    const steps = [
      makeStep('source'),
      makeStep('left', ['source']),
      makeStep('right', ['source']),
      makeStep('merge', ['left', 'right']),
    ];
    const layers = resolveExecutionOrder(steps);
    expect(layers).toHaveLength(3);
  });

  it('throws on duplicate step names', () => {
    const steps = [makeStep('a'), makeStep('a')];
    expect(() => resolveExecutionOrder(steps)).toThrow('Duplicate step name');
  });

  it('throws on unknown dependency', () => {
    const steps = [makeStep('a', ['nonexistent'])];
    expect(() => resolveExecutionOrder(steps)).toThrow('unknown step');
  });

  it('throws on cycle', () => {
    const steps = [makeStep('a', ['b']), makeStep('b', ['a'])];
    expect(() => resolveExecutionOrder(steps)).toThrow(/[Cc]ycle/);
  });

  it('throws on self-reference', () => {
    const steps = [makeStep('a', ['a'])];
    expect(() => resolveExecutionOrder(steps)).toThrow(/[Cc]ycle/);
  });
});
