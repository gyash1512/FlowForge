import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { getRunStore } from './runs.js';

export const streamRoutes = new Hono();

/** GET /api/runs/:id/stream - SSE stream for real-time run updates */
streamRoutes.get('/:id/stream', (c) => {
  const id = c.req.param('id');
  const run = getRunStore().get(id);

  if (!run) {
    return c.json({ error: 'Run not found' }, 404);
  }

  return streamSSE(c, async (stream) => {
    // Send initial state
    await stream.writeSSE({
      event: 'run:status',
      data: JSON.stringify({
        id: run.id,
        status: run.status,
        startedAt: run.startedAt,
        updatedAt: run.updatedAt,
      }),
    });

    // Poll for updates until the run reaches a terminal state
    const terminalStatuses = new Set(['completed', 'failed', 'cancelled']);
    let lastStatus = run.status;
    let ticks = 0;
    const maxTicks = 300; // 5 minutes at 1s intervals

    while (!terminalStatuses.has(lastStatus) && ticks < maxTicks) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      ticks++;

      const current = getRunStore().get(id);
      if (!current) break;

      if (current.status !== lastStatus || current.updatedAt !== run.updatedAt) {
        lastStatus = current.status;
        await stream.writeSSE({
          event: 'run:status',
          data: JSON.stringify({
            id: current.id,
            status: current.status,
            output: current.output,
            error: current.error,
            startedAt: current.startedAt,
            completedAt: current.completedAt,
            updatedAt: current.updatedAt,
          }),
        });
      }
    }

    // Send final close event
    await stream.writeSSE({
      event: 'run:complete',
      data: JSON.stringify({ id, status: lastStatus }),
    });
  });
});
