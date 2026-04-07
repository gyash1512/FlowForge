import { Hono } from 'hono';
import type { WorkflowSummary } from '@flowforgejs/shared';

const workflowStore = new Map<string, WorkflowSummary>();

export const workflowRoutes = new Hono();

/** GET /api/workflows - list registered workflows */
workflowRoutes.get('/', (c) => {
  const workflows = [...workflowStore.values()];
  return c.json(workflows);
});

// ── Helpers for other modules to manage workflows ──

export function registerWorkflow(summary: WorkflowSummary): void {
  workflowStore.set(summary.id, summary);
}

export function unregisterWorkflow(id: string): void {
  workflowStore.delete(id);
}

export function getWorkflowStore(): Map<string, WorkflowSummary> {
  return workflowStore;
}
