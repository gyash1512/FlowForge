import { Hono } from 'hono';
import type { Logger, RunRecord, WorkflowDefinition, RunFilter } from '@flowforgejs/shared';
import { RunStatus, eventPayloadSchema, runFilterSchema } from '@flowforgejs/shared';
import type { WorkflowRegistry } from './registry.js';

// ────────────────────────────────────────────────────────────────
// Types for the server's run store abstraction
// ────────────────────────────────────────────────────────────────

export interface RunStore {
  get(runId: string): RunRecord | undefined;
  list(filter?: RunFilter): RunRecord[];
  set(run: RunRecord): void;
}

/**
 * Simple in-memory RunStore backed by a Map.
 */
export class InMemoryRunStore implements RunStore {
  private runs = new Map<string, RunRecord>();

  get(runId: string): RunRecord | undefined {
    return this.runs.get(runId);
  }

  list(filter?: RunFilter): RunRecord[] {
    let results = [...this.runs.values()];

    if (filter?.workflowId) {
      results = results.filter((r) => r.workflowId === filter.workflowId);
    }
    if (filter?.status) {
      results = results.filter((r) => r.status === filter.status);
    }
    if (filter?.tenantId) {
      results = results.filter((r) => r.tenantId === filter.tenantId);
    }
    if (filter?.from) {
      results = results.filter((r) => r.createdAt >= filter.from!);
    }
    if (filter?.to) {
      results = results.filter((r) => r.createdAt <= filter.to!);
    }

    // Sort by createdAt descending
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? 20;
    return results.slice(offset, offset + limit);
  }

  set(run: RunRecord): void {
    this.runs.set(run.id, run);
  }

  get size(): number {
    return this.runs.size;
  }
}

// ────────────────────────────────────────────────────────────────
// Hono Server Factory
// ────────────────────────────────────────────────────────────────

export interface ServerDeps {
  registry: WorkflowRegistry;
  runStore: RunStore;
  logger?: Logger;
  onEvent?: (type: string, data: unknown) => Promise<RunRecord[]>;
  onReplay?: (runId: string) => Promise<RunRecord>;
  onCancel?: (runId: string) => Promise<void>;
}

export function createServer(deps: ServerDeps): Hono {
  const app = new Hono();
  const { registry, runStore, logger, onEvent, onReplay, onCancel } = deps;

  // ── Health check ──
  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      workflows: registry.size,
      uptime: process.uptime(),
    });
  });

  // ── POST /events ──
  app.post('/events', async (c) => {
    const body = await c.req.json();
    const parsed = eventPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: 'Invalid event payload', details: parsed.error.issues }, 400);
    }

    const { type, data } = parsed.data;
    logger?.info(`Received event: ${type}`);

    if (!onEvent) {
      return c.json({ error: 'Event handling not configured' }, 503);
    }

    try {
      const runs = await onEvent(type, data);
      return c.json(
        {
          accepted: true,
          runIds: runs.map((r) => r.id),
          matchedWorkflows: runs.length,
        },
        202,
      );
    } catch (err) {
      logger?.error(`Event handling failed: ${err instanceof Error ? err.message : String(err)}`);
      return c.json({ error: 'Event handling failed' }, 500);
    }
  });

  // ── GET /workflows ──
  app.get('/workflows', (c) => {
    const workflows = registry.list();
    return c.json({
      workflows: workflows.map(summarizeWorkflow),
      total: workflows.length,
    });
  });

  // ── GET /runs ──
  app.get('/runs', (c) => {
    const query = c.req.query();
    const filterInput: Record<string, unknown> = {};
    if (query['workflowId']) filterInput['workflowId'] = query['workflowId'];
    if (query['status']) filterInput['status'] = query['status'];
    if (query['tenantId']) filterInput['tenantId'] = query['tenantId'];
    if (query['from']) filterInput['from'] = query['from'];
    if (query['to']) filterInput['to'] = query['to'];
    if (query['limit']) filterInput['limit'] = Number(query['limit']);
    if (query['offset']) filterInput['offset'] = Number(query['offset']);

    const parsed = runFilterSchema.safeParse(filterInput);
    if (!parsed.success) {
      return c.json({ error: 'Invalid filter parameters', details: parsed.error.issues }, 400);
    }

    const runs = runStore.list(parsed.data);
    return c.json({ runs, total: runs.length });
  });

  // ── GET /runs/:id ──
  app.get('/runs/:id', (c) => {
    const id = c.req.param('id');
    const run = runStore.get(id);
    if (!run) {
      return c.json({ error: `Run not found: ${id}` }, 404);
    }
    return c.json(run);
  });

  // ── POST /runs/:id/replay ──
  app.post('/runs/:id/replay', async (c) => {
    const id = c.req.param('id');
    const run = runStore.get(id);
    if (!run) {
      return c.json({ error: `Run not found: ${id}` }, 404);
    }
    if (run.status !== RunStatus.FAILED) {
      return c.json({ error: 'Only failed runs can be replayed' }, 400);
    }

    if (!onReplay) {
      return c.json({ error: 'Replay not configured' }, 503);
    }

    try {
      const newRun = await onReplay(id);
      runStore.set(newRun);
      return c.json({ runId: newRun.id, status: newRun.status }, 202);
    } catch (err) {
      logger?.error(`Replay failed: ${err instanceof Error ? err.message : String(err)}`);
      return c.json({ error: 'Replay failed' }, 500);
    }
  });

  // ── POST /runs/:id/cancel ──
  app.post('/runs/:id/cancel', async (c) => {
    const id = c.req.param('id');
    const run = runStore.get(id);
    if (!run) {
      return c.json({ error: `Run not found: ${id}` }, 404);
    }
    if (run.status !== RunStatus.RUNNING && run.status !== RunStatus.PENDING) {
      return c.json({ error: 'Only running or pending runs can be cancelled' }, 400);
    }

    if (!onCancel) {
      return c.json({ error: 'Cancel not configured' }, 503);
    }

    try {
      await onCancel(id);
      run.status = RunStatus.CANCELLED;
      run.updatedAt = new Date();
      runStore.set(run);
      return c.json({ runId: id, status: RunStatus.CANCELLED });
    } catch (err) {
      logger?.error(`Cancel failed: ${err instanceof Error ? err.message : String(err)}`);
      return c.json({ error: 'Cancel failed' }, 500);
    }
  });

  return app;
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function summarizeWorkflow(wf: WorkflowDefinition) {
  return {
    id: wf.id,
    name: wf.name,
    version: wf.version,
    description: wf.description,
    triggerType: wf.trigger.type,
    stepCount: wf.steps.length,
  };
}
