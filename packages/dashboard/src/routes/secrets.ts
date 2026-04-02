import { Hono } from 'hono';

const secretStore = new Map<string, string>();

export const secretRoutes = new Hono();

/** GET /api/secrets - list secret keys (not values) */
secretRoutes.get('/', (c) => {
  const keys = [...secretStore.keys()].map((key) => ({
    key,
    createdAt: new Date().toISOString(),
  }));
  return c.json(keys);
});

/** POST /api/secrets - add a secret */
secretRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const { key, value } = body as { key?: string; value?: string };

  if (!key || typeof key !== 'string') {
    return c.json({ error: 'Missing or invalid "key"' }, 400);
  }
  if (!value || typeof value !== 'string') {
    return c.json({ error: 'Missing or invalid "value"' }, 400);
  }

  secretStore.set(key, value);
  return c.json({ key, created: true }, 201);
});

/** DELETE /api/secrets/:key - delete a secret */
secretRoutes.delete('/:key', (c) => {
  const key = c.req.param('key');
  const existed = secretStore.delete(key);

  if (!existed) {
    return c.json({ error: 'Secret not found' }, 404);
  }

  return c.json({ key, deleted: true });
});

export function getSecretStore(): Map<string, string> {
  return secretStore;
}
