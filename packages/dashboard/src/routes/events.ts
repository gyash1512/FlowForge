import { Hono } from 'hono';
import type { EventRecord } from '@flowforgejs/shared';
import { eventPayloadSchema, eventId } from '@flowforgejs/shared';

const eventStore: EventRecord[] = [];

export const eventRoutes = new Hono();

/** POST /api/events - emit an event */
eventRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = eventPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid event payload', details: parsed.error.flatten() }, 400);
  }

  const record: EventRecord = {
    id: eventId(),
    type: parsed.data.type,
    payload: parsed.data.data,
    source: parsed.data.source,
    createdAt: new Date(),
  };

  eventStore.push(record);
  return c.json(record, 201);
});

/** GET /api/events - list historical events */
eventRoutes.get('/', (c) => {
  const query = c.req.query();
  let events = [...eventStore];

  if (query['type']) {
    events = events.filter((e) => e.type === query['type']);
  }

  const limit = query['limit'] ? Number(query['limit']) : 50;
  const offset = query['offset'] ? Number(query['offset']) : 0;

  const paged = events.slice(offset, offset + limit);
  return c.json(paged);
});

export function getEventStore(): EventRecord[] {
  return eventStore;
}
