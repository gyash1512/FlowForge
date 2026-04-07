import { z } from 'zod';
import { defineNode, workflow } from '@flowforgejs/sdk';
import { Engine } from '@flowforgejs/engine';

// ── Node Definitions ──

const fetchUsers = defineNode({
  name: 'fetch-users',
  version: '1.0.0',
  description: 'Fetches users from the data source',
  category: 'data',
  inputSchema: z.any(),
  outputSchema: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
  ),
  configSchema: z.object({}),
  timeout: 5000,
  handler: async (_ctx) => {
    // Simulate API call
    return [
      { id: '1', name: 'Alice', email: 'alice@example.com' },
      { id: '2', name: 'Bob', email: 'bob@example.com' },
      { id: '3', name: 'Charlie', email: 'charlie@example.com' },
    ];
  },
});

const enrichUsers = defineNode({
  name: 'enrich-users',
  version: '1.0.0',
  description: 'Enriches users with domain information',
  category: 'transform',
  inputSchema: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
  ),
  outputSchema: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      domain: z.string().optional(),
      enrichedAt: z.string(),
    }),
  ),
  configSchema: z.object({}),
  handler: async (ctx) => {
    return ctx.input.map((u) => ({
      ...u,
      domain: u.email.split('@')[1],
      enrichedAt: new Date().toISOString(),
    }));
  },
});

const filterActive = defineNode({
  name: 'filter-active',
  version: '1.0.0',
  description: 'Filters to only active users',
  category: 'transform',
  inputSchema: z.array(z.any()),
  outputSchema: z.array(z.any()),
  configSchema: z.object({
    maxUsers: z.number().default(2),
  }),
  handler: async (ctx) => {
    const max = (ctx.config as { maxUsers: number }).maxUsers;
    return ctx.input.slice(0, max);
  },
});

const sendNotifications = defineNode({
  name: 'send-notifications',
  version: '1.0.0',
  description: 'Sends notifications to users',
  category: 'communication',
  inputSchema: z.array(z.object({ name: z.string(), email: z.string() }).passthrough()),
  outputSchema: z.object({
    sent: z.number(),
    timestamp: z.string(),
  }),
  configSchema: z.object({}),
  retries: 3,
  handler: async (ctx) => {
    ctx.logger.info(`Sending notifications to ${ctx.input.length} users`);
    return { sent: ctx.input.length, timestamp: new Date().toISOString() };
  },
});

// ── Workflow Definition ──

const userSyncWorkflow = workflow('user-sync')
  .name('User Sync Pipeline')
  .version('1.0.0')
  .description('Fetches users, enriches them, filters active ones, and sends notifications')
  .trigger({ type: 'cron', cron: '0 */6 * * *' })
  .timeout(30000)
  .node('fetch', fetchUsers)
  .node('enrich', enrichUsers, {
    input: (ctx) => ctx.steps['fetch'],
  })
  .node('filter', filterActive, {
    input: (ctx) => ctx.steps['enrich'],
    config: { maxUsers: 2 },
  })
  .node('notify', sendNotifications, {
    input: (ctx) => ctx.steps['filter'],
  })
  .build();

// ── Run ──

async function main() {
  const engine = new Engine();
  engine.register(userSyncWorkflow);

  console.log(
    'Registered workflows:',
    engine.listWorkflows().map((w) => w.id),
  );

  const run = await engine.trigger('user-sync');
  console.log('Run result:', {
    id: run.id,
    status: run.status,
    output: run.output,
    durationMs:
      run.completedAt && run.startedAt
        ? run.completedAt.getTime() - run.startedAt.getTime()
        : undefined,
  });
}

main().catch(console.error);

export { fetchUsers, enrichUsers, filterActive, sendNotifications, userSyncWorkflow };
