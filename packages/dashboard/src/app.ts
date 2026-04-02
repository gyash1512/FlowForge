import { Hono } from 'hono';
import { apiKeyAuth } from './middleware/auth.js';
import { corsMiddleware } from './middleware/cors.js';
import { workflowRoutes } from './routes/workflows.js';
import { runRoutes } from './routes/runs.js';
import { eventRoutes } from './routes/events.js';
import { integrationRoutes } from './routes/integrations.js';
import { secretRoutes } from './routes/secrets.js';
import { metricsRoutes } from './routes/metrics.js';
import { streamRoutes } from './routes/stream.js';

/**
 * Create the main Hono app with all routes and middleware registered.
 */
export function createApp(): Hono {
  const app = new Hono();

  // Global middleware
  app.use('*', corsMiddleware());
  app.use('/api/*', apiKeyAuth());

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // API routes
  app.route('/api/workflows', workflowRoutes);
  app.route('/api/runs', runRoutes);
  app.route('/api/events', eventRoutes);
  app.route('/api/integrations', integrationRoutes);
  app.route('/api/secrets', secretRoutes);
  app.route('/api/metrics', metricsRoutes);

  // SSE stream routes are nested under /api/runs
  app.route('/api/runs', streamRoutes);

  // Global error handler
  app.onError((err, c) => {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = 'statusCode' in err ? (err as { statusCode: number }).statusCode : 500;
    return c.json({ error: message }, status as 500);
  });

  // 404 handler
  app.notFound((c) => {
    return c.json({ error: 'Not found' }, 404);
  });

  return app;
}
