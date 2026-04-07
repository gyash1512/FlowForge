import { Hono } from 'hono';
import type { RunRecord, StepRecord, RunFilter } from '@flowforgejs/shared';
import { RunStatus, runFilterSchema } from '@flowforgejs/shared';

const runStore = new Map<string, RunRecord>();
const stepStore = new Map<string, StepRecord[]>();

export const runRoutes = new Hono();

/** GET /api/runs - list runs with filters */
runRoutes.get('/', (c) => {
  const query = c.req.query();

  const filter: Partial<RunFilter> = {
    workflowId: query['workflowId'] ?? undefined,
    status: (query['status'] as RunFilter['status']) ?? undefined,
    eventType: query['eventType'] ?? undefined,
    tenantId: query['tenantId'] ?? undefined,
    limit: query['limit'] ? Number(query['limit']) : 20,
    offset: query['offset'] ? Number(query['offset']) : 0,
    from: query['from'] ? new Date(query['from']) : undefined,
    to: query['to'] ? new Date(query['to']) : undefined,
  };

  const parsed = runFilterSchema.safeParse(filter);
  const validFilter = parsed.success ? parsed.data : filter;

  let runs = [...runStore.values()];

  if (validFilter.workflowId) {
    runs = runs.filter((r) => r.workflowId === validFilter.workflowId);
  }
  if (validFilter.status) {
    runs = runs.filter((r) => r.status === validFilter.status);
  }
  if (validFilter.tenantId) {
    runs = runs.filter((r) => r.tenantId === validFilter.tenantId);
  }
  if (validFilter.from) {
    const from = validFilter.from;
    runs = runs.filter((r) => r.createdAt >= from);
  }
  if (validFilter.to) {
    const to = validFilter.to;
    runs = runs.filter((r) => r.createdAt <= to);
  }

  const offset = validFilter.offset ?? 0;
  const limit = validFilter.limit ?? 20;
  const paged = runs.slice(offset, offset + limit);

  return c.json(paged);
});

/** GET /api/runs/:id - get run detail with step results */
runRoutes.get('/:id', (c) => {
  const id = c.req.param('id');
  const run = runStore.get(id);

  if (!run) {
    return c.json({ error: 'Run not found' }, 404);
  }

  const steps = stepStore.get(id) ?? [];
  return c.json({ ...run, steps });
});

/** POST /api/runs/:id/replay - replay a failed run */
runRoutes.post('/:id/replay', (c) => {
  const id = c.req.param('id');
  const run = runStore.get(id);

  if (!run) {
    return c.json({ error: 'Run not found' }, 404);
  }

  if (run.status !== RunStatus.FAILED) {
    return c.json({ error: 'Only failed runs can be replayed' }, 400);
  }

  const replayRun: RunRecord = {
    ...run,
    id: `${run.id}_replay_${Date.now()}` as RunRecord['id'],
    status: RunStatus.PENDING,
    error: undefined,
    output: undefined,
    startedAt: undefined,
    completedAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  runStore.set(replayRun.id, replayRun);
  return c.json(replayRun, 201);
});

/** POST /api/runs/:id/cancel - cancel a running run */
runRoutes.post('/:id/cancel', (c) => {
  const id = c.req.param('id');
  const run = runStore.get(id);

  if (!run) {
    return c.json({ error: 'Run not found' }, 404);
  }

  if (run.status !== RunStatus.RUNNING && run.status !== RunStatus.PENDING) {
    return c.json({ error: 'Only running or pending runs can be cancelled' }, 400);
  }

  run.status = RunStatus.CANCELLED;
  run.updatedAt = new Date();
  runStore.set(id, run);

  return c.json(run);
});

// ── Helpers for other modules to manage runs ──

export function addRun(run: RunRecord): void {
  runStore.set(run.id, run);
}

export function addStepRecords(runId: string, steps: StepRecord[]): void {
  stepStore.set(runId, steps);
}

export function getRunStore(): Map<string, RunRecord> {
  return runStore;
}
