import { nanoid } from 'nanoid';
import type { WorkflowId, RunId, StepId, NodeId, EventId } from './types.js';

const PREFIXES = {
  workflow: 'wf',
  run: 'run',
  step: 'stp',
  node: 'nd',
  event: 'evt',
} as const;

function prefixedId(prefix: string, size = 21): string {
  return `${prefix}_${nanoid(size)}`;
}

export function workflowId(): WorkflowId {
  return prefixedId(PREFIXES.workflow) as WorkflowId;
}

export function runId(): RunId {
  return prefixedId(PREFIXES.run) as RunId;
}

export function stepId(): StepId {
  return prefixedId(PREFIXES.step) as StepId;
}

export function nodeId(): NodeId {
  return prefixedId(PREFIXES.node) as NodeId;
}

export function eventId(): EventId {
  return prefixedId(PREFIXES.event) as EventId;
}
