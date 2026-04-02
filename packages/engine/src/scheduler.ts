import type { WorkflowStep } from '@flowforge/shared';
import { ValidationError } from '@flowforge/shared';

/**
 * Resolves node execution order using topological sort.
 * Returns groups of steps where each group can be executed in parallel.
 * Only operates on WorkflowStep (not ControlFlowStep — those are handled by the runner).
 */
export function resolveExecutionOrder(steps: WorkflowStep[]): WorkflowStep[][] {
  const stepMap = new Map<string, WorkflowStep>();
  for (const s of steps) {
    if (stepMap.has(s.name)) {
      throw new ValidationError(`Duplicate step name: ${s.name}`);
    }
    stepMap.set(s.name, s);
  }

  // Validate all dependencies exist
  for (const s of steps) {
    for (const dep of s.dependsOn ?? []) {
      if (!stepMap.has(dep)) {
        throw new ValidationError(`Step "${s.name}" depends on unknown step "${dep}"`);
      }
    }
  }

  // Detect cycles using DFS
  detectCycles(steps);

  // Kahn's algorithm for topological sort in layers
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const s of steps) {
    inDegree.set(s.name, s.dependsOn?.length ?? 0);
    for (const dep of s.dependsOn ?? []) {
      const existing = dependents.get(dep) ?? [];
      existing.push(s.name);
      dependents.set(dep, existing);
    }
  }

  const layers: WorkflowStep[][] = [];
  let queue = steps.filter((s) => (inDegree.get(s.name) ?? 0) === 0);

  while (queue.length > 0) {
    layers.push(queue);

    const nextQueue: WorkflowStep[] = [];
    for (const s of queue) {
      for (const depName of dependents.get(s.name) ?? []) {
        const deg = (inDegree.get(depName) ?? 1) - 1;
        inDegree.set(depName, deg);
        if (deg === 0) {
          nextQueue.push(stepMap.get(depName)!);
        }
      }
    }
    queue = nextQueue;
  }

  const processed = layers.reduce((sum, layer) => sum + layer.length, 0);
  if (processed !== steps.length) {
    throw new ValidationError('Workflow contains a cycle');
  }

  return layers;
}

function detectCycles(steps: WorkflowStep[]): void {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;

  const color = new Map<string, number>();
  const stepMap = new Map<string, WorkflowStep>();

  for (const s of steps) {
    color.set(s.name, WHITE);
    stepMap.set(s.name, s);
  }

  function dfs(name: string): void {
    color.set(name, GRAY);
    const s = stepMap.get(name)!;
    for (const dep of s.dependsOn ?? []) {
      const c = color.get(dep);
      if (c === GRAY) {
        throw new ValidationError(`Cycle detected involving steps "${name}" and "${dep}"`);
      }
      if (c === WHITE) {
        dfs(dep);
      }
    }
    color.set(name, BLACK);
  }

  for (const s of steps) {
    if (color.get(s.name) === WHITE) {
      dfs(s.name);
    }
  }
}
