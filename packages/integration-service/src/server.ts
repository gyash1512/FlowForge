import { Hono } from 'hono';
import type { IntegrationRequest, IntegrationResponse } from '@flowforge/shared';
import { FlowForgeError } from '@flowforge/shared';
import { AdaptorRegistry } from './adaptor-registry.js';
import { RateLimiter } from './rate-limiter.js';
import { CircuitBreaker } from './circuit-breaker.js';

export interface ServerDeps {
  registry: AdaptorRegistry;
  rateLimiter: RateLimiter;
  circuitBreaker: CircuitBreaker;
}

export function createApp(deps: ServerDeps): Hono {
  const { registry, rateLimiter, circuitBreaker } = deps;
  const app = new Hono();

  // ── POST /execute ───────────────────────────────────────────
  app.post('/execute', async (c) => {
    let request: IntegrationRequest;
    try {
      request = (await c.req.json()) as IntegrationRequest;
    } catch {
      const response: IntegrationResponse = {
        success: false,
        errorMessage: 'Invalid JSON body',
        statusCode: 400,
      };
      return c.json(response, 400);
    }

    const { integrationName, action, paramsJson, connectionId } = request;

    if (!integrationName || !action || !connectionId) {
      const response: IntegrationResponse = {
        success: false,
        errorMessage: 'Missing required fields: integrationName, action, connectionId',
        statusCode: 400,
      };
      return c.json(response, 400);
    }

    const adaptor = registry.get(integrationName);
    if (!adaptor) {
      const response: IntegrationResponse = {
        success: false,
        errorMessage: `Unknown integration: ${integrationName}`,
        statusCode: 404,
      };
      return c.json(response, 404);
    }

    // Rate limiting
    if (!rateLimiter.acquire(integrationName)) {
      const response: IntegrationResponse = {
        success: false,
        errorMessage: `Rate limit exceeded for integration: ${integrationName}`,
        statusCode: 429,
      };
      return c.json(response, 429);
    }

    // Parse params
    let params: unknown;
    try {
      params = paramsJson ? JSON.parse(paramsJson) : {};
    } catch {
      const response: IntegrationResponse = {
        success: false,
        errorMessage: 'Invalid paramsJson: must be valid JSON',
        statusCode: 400,
      };
      return c.json(response, 400);
    }

    // Execute with circuit breaker
    try {
      const result = await circuitBreaker.execute(integrationName, () =>
        adaptor.execute(action, params, connectionId),
      );

      const response: IntegrationResponse = {
        success: true,
        resultJson: JSON.stringify(result),
        statusCode: 200,
      };
      return c.json(response, 200);
    } catch (error) {
      const statusCode =
        error instanceof FlowForgeError ? error.statusCode : 500;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      const response: IntegrationResponse = {
        success: false,
        errorMessage,
        statusCode,
      };
      return new Response(JSON.stringify(response), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  });

  // ── GET /health ─────────────────────────────────────────────
  app.get('/health', async (c) => {
    const results = await registry.healthCheckAll();
    const status: Record<string, boolean> = {};
    for (const [name, healthy] of results) {
      status[name] = healthy;
    }

    const allHealthy = [...results.values()].every(Boolean);
    return c.json(
      { healthy: allHealthy, integrations: status },
      allHealthy ? 200 : 503,
    );
  });

  // ── GET /integrations ───────────────────────────────────────
  app.get('/integrations', (c) => {
    const adaptors = registry.list();
    const integrations = adaptors.map((a) => ({
      name: a.name,
      actions: a.actions,
    }));
    return c.json({ integrations });
  });

  return app;
}
