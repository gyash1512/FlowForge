import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { registerWorkflow } from '../routes/workflows.js';
import { addRun } from '../routes/runs.js';
import type { WorkflowSummary, RunRecord } from '@flowforge/shared';
import { RunStatus } from '@flowforge/shared';

async function makeRequest(app: ReturnType<typeof createApp>, path: string, init?: RequestInit) {
  return app.request(path, init);
}

describe('dashboard routes', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
  });

  describe('GET /health', () => {
    it('returns ok status', async () => {
      const res = await makeRequest(app, '/health');
      expect(res.status).toBe(200);

      const body = await res.json() as Record<string, unknown>;
      expect(body).toHaveProperty('status', 'ok');
      expect(body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/workflows', () => {
    it('returns an array of WorkflowSummary', async () => {
      const summary: WorkflowSummary = {
        id: 'test-wf',
        name: 'Test Workflow',
        version: '1.0.0',
        triggerType: 'manual',
        nodeCount: 3,
      };
      registerWorkflow(summary);

      const res = await makeRequest(app, '/api/workflows');
      expect(res.status).toBe(200);

      const body = await res.json() as Record<string, unknown>[];
      expect(Array.isArray(body)).toBe(true);

      const found = body.find((w) => w['id'] === 'test-wf');
      expect(found).toBeDefined();
      expect(found!.name).toBe('Test Workflow');
      expect(found!.nodeCount).toBe(3);
    });
  });

  describe('GET /api/runs', () => {
    it('returns an array of runs', async () => {
      const run: RunRecord = {
        id: 'run_test123' as RunRecord['id'],
        workflowId: 'test-wf',
        status: RunStatus.COMPLETED,
        trigger: { type: 'manual' },
        input: { foo: 'bar' },
        output: { result: 42 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      addRun(run);

      const res = await makeRequest(app, '/api/runs');
      expect(res.status).toBe(200);

      const body = await res.json() as Record<string, unknown>[];
      expect(Array.isArray(body)).toBe(true);

      const found = body.find((r) => r['id'] === 'run_test123');
      expect(found).toBeDefined();
      expect(found!.status).toBe('completed');
    });
  });

  describe('GET /api/runs/:id', () => {
    it('returns run detail with steps', async () => {
      const run: RunRecord = {
        id: 'run_detail1' as RunRecord['id'],
        workflowId: 'test-wf',
        status: RunStatus.COMPLETED,
        trigger: { type: 'manual' },
        input: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      addRun(run);

      const res = await makeRequest(app, '/api/runs/run_detail1');
      expect(res.status).toBe(200);

      const body = await res.json() as Record<string, unknown>;
      expect(body.id).toBe('run_detail1');
      expect(body).toHaveProperty('steps');
    });

    it('returns 404 for unknown run', async () => {
      const res = await makeRequest(app, '/api/runs/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/runs/:id/replay', () => {
    it('replays a failed run', async () => {
      const run: RunRecord = {
        id: 'run_replay1' as RunRecord['id'],
        workflowId: 'test-wf',
        status: RunStatus.FAILED,
        trigger: { type: 'manual' },
        input: { data: 'test' },
        error: 'something broke',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      addRun(run);

      const res = await makeRequest(app, '/api/runs/run_replay1/replay', { method: 'POST' });
      expect(res.status).toBe(201);

      const body = await res.json() as Record<string, unknown>;
      expect(body.status).toBe('pending');
      expect(body.id).toContain('replay');
    });

    it('rejects replay for non-failed runs', async () => {
      const run: RunRecord = {
        id: 'run_replay2' as RunRecord['id'],
        workflowId: 'test-wf',
        status: RunStatus.COMPLETED,
        trigger: { type: 'manual' },
        input: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      addRun(run);

      const res = await makeRequest(app, '/api/runs/run_replay2/replay', { method: 'POST' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/runs/:id/cancel', () => {
    it('cancels a running run', async () => {
      const run: RunRecord = {
        id: 'run_cancel1' as RunRecord['id'],
        workflowId: 'test-wf',
        status: RunStatus.RUNNING,
        trigger: { type: 'manual' },
        input: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      addRun(run);

      const res = await makeRequest(app, '/api/runs/run_cancel1/cancel', { method: 'POST' });
      expect(res.status).toBe(200);

      const body = await res.json() as Record<string, unknown>;
      expect(body.status).toBe('cancelled');
    });
  });

  describe('POST /api/events', () => {
    it('creates an event', async () => {
      const res = await makeRequest(app, '/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'user.created', data: { userId: '123' } }),
      });
      expect(res.status).toBe(201);

      const body = await res.json() as Record<string, unknown>;
      expect(body).toHaveProperty('id');
      expect(body.type).toBe('user.created');
    });

    it('rejects invalid events', async () => {
      const res = await makeRequest(app, '/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'missing type' }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/events', () => {
    it('returns an array of events', async () => {
      const res = await makeRequest(app, '/api/events');
      expect(res.status).toBe(200);

      const body = await res.json() as Record<string, unknown>[];
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe('GET /api/integrations', () => {
    it('returns an array of integration statuses', async () => {
      const res = await makeRequest(app, '/api/integrations');
      expect(res.status).toBe(200);

      const body = await res.json() as Record<string, unknown>[];
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe('secrets routes', () => {
    it('adds, lists, and deletes secrets', async () => {
      // Add
      const addRes = await makeRequest(app, '/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'MY_SECRET', value: 'supersecret' }),
      });
      expect(addRes.status).toBe(201);

      // List
      const listRes = await makeRequest(app, '/api/secrets');
      expect(listRes.status).toBe(200);
      const secrets = await listRes.json() as Record<string, unknown>[];
      expect(secrets.some((s) => s['key'] === 'MY_SECRET')).toBe(true);

      // Delete
      const delRes = await makeRequest(app, '/api/secrets/MY_SECRET', { method: 'DELETE' });
      expect(delRes.status).toBe(200);
      const delBody = await delRes.json() as Record<string, unknown>;
      expect(delBody.deleted).toBe(true);
    });

    it('returns 404 when deleting nonexistent secret', async () => {
      const res = await makeRequest(app, '/api/secrets/NOPE', { method: 'DELETE' });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/metrics', () => {
    it('returns a MetricsSnapshot shape', async () => {
      const res = await makeRequest(app, '/api/metrics');
      expect(res.status).toBe(200);

      const body = await res.json() as Record<string, unknown>;
      expect(body).toHaveProperty('totalRuns');
      expect(body).toHaveProperty('successCount');
      expect(body).toHaveProperty('failureCount');
      expect(body).toHaveProperty('avgDurationMs');
      expect(body).toHaveProperty('p95DurationMs');
      expect(body).toHaveProperty('throughputPerHour');
      expect(body).toHaveProperty('period');
    });
  });

  describe('404 handler', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await makeRequest(app, '/api/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
