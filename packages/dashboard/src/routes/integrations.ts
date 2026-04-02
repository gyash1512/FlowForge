import { Hono } from 'hono';

export interface IntegrationStatus {
  name: string;
  actions: string[];
  healthy: boolean;
  lastChecked: Date;
  errorMessage?: string;
}

const integrationStore = new Map<string, IntegrationStatus>();

export const integrationRoutes = new Hono();

/** GET /api/integrations - list integrations with health status */
integrationRoutes.get('/', (c) => {
  const integrations = [...integrationStore.values()];
  return c.json(integrations);
});

// ── Helpers for other modules to manage integrations ──

export function registerIntegration(status: IntegrationStatus): void {
  integrationStore.set(status.name, status);
}

export function updateIntegrationHealth(
  name: string,
  healthy: boolean,
  errorMessage?: string,
): void {
  const existing = integrationStore.get(name);
  if (existing) {
    existing.healthy = healthy;
    existing.lastChecked = new Date();
    existing.errorMessage = errorMessage;
  }
}

export function getIntegrationStore(): Map<string, IntegrationStatus> {
  return integrationStore;
}
