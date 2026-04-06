import { z } from 'zod';
import { defineNode, workflow } from '@flowforge/sdk';
import { Engine, NoopLogger } from '@flowforge/engine';

// ── Schemas ──

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  company: z.object({ name: z.string() }),
});

type User = z.infer<typeof userSchema>;

const simplifiedUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  company: z.string(),
});

type SimplifiedUser = z.infer<typeof simplifiedUserSchema>;

// ── Node Definitions ──

/**
 * Fetches real user data from JSONPlaceholder API.
 * This makes a REAL HTTP GET request -- no mocks, no stubs.
 */
const fetchUsersNode = defineNode({
  name: 'fetch-users',
  version: '1.0.0',
  description: 'Fetches users from JSONPlaceholder API',
  category: 'data',
  inputSchema: z.object({ url: z.string().url() }),
  outputSchema: z.array(userSchema),
  configSchema: z.object({}),
  handler: async (ctx) => {
    const response = await fetch(ctx.input.url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },
});

/**
 * Transforms raw API users into a simplified structure:
 * { id, name, email, company } where company is flattened to a string.
 */
const transformUsersNode = defineNode({
  name: 'transform-users',
  version: '1.0.0',
  description: 'Maps users to simplified {id, name, email, company} objects',
  category: 'transform',
  inputSchema: z.array(userSchema),
  outputSchema: z.array(simplifiedUserSchema),
  configSchema: z.object({}),
  handler: async (ctx) => {
    return ctx.input.map((user: User) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      company: user.company.name,
    }));
  },
});

/**
 * Filters users to only those from specific target companies.
 */
const filterByCompanyNode = defineNode({
  name: 'filter-by-company',
  version: '1.0.0',
  description: 'Filters users to only those from target companies',
  category: 'transform',
  inputSchema: z.array(simplifiedUserSchema),
  outputSchema: z.array(simplifiedUserSchema),
  configSchema: z.object({
    companies: z.array(z.string()),
  }),
  handler: async (ctx) => {
    const targetCompanies = (ctx.config as { companies: string[] }).companies;
    return ctx.input.filter((user: SimplifiedUser) =>
      targetCompanies.some((c) => user.company.includes(c)),
    );
  },
});

/**
 * Creates a human-readable summary report from the filtered user list.
 */
const createReportNode = defineNode({
  name: 'create-report',
  version: '1.0.0',
  description: 'Creates a summary report string from filtered users',
  category: 'transform',
  inputSchema: z.array(simplifiedUserSchema),
  outputSchema: z.object({
    totalUsers: z.number(),
    companies: z.array(z.string()),
    report: z.string(),
  }),
  configSchema: z.object({}),
  handler: async (ctx) => {
    const users = ctx.input as SimplifiedUser[];
    const companies = [...new Set(users.map((u) => u.company))];
    const lines = [
      `=== User Report ===`,
      `Total users: ${users.length}`,
      `Companies: ${companies.join(', ')}`,
      ``,
      ...users.map((u) => `  - ${u.name} (${u.email}) @ ${u.company}`),
      ``,
      `Generated at: ${new Date().toISOString()}`,
    ];
    return {
      totalUsers: users.length,
      companies,
      report: lines.join('\n'),
    };
  },
});

// ── Workflow Definition ──

const realWorkflow = workflow('real-user-pipeline')
  .name('Real User Pipeline')
  .version('1.0.0')
  .description(
    'Fetches real users from JSONPlaceholder, transforms, filters by company, and generates a report',
  )
  .trigger({ type: 'manual' })
  .timeout(30000)
  .node('fetch', fetchUsersNode, {
    input: () => ({ url: 'https://jsonplaceholder.typicode.com/users' }),
  })
  .node('transform', transformUsersNode, {
    input: (ctx) => ctx.steps['fetch'],
  })
  .node('filter', filterByCompanyNode, {
    input: (ctx) => ctx.steps['transform'],
    config: { companies: ['Romaguera', 'Yost', 'Hoeger'] },
  })
  .node('report', createReportNode, {
    input: (ctx) => ctx.steps['filter'],
  })
  .build();

// ── Run ──

async function main() {
  const engine = new Engine();
  engine.register(realWorkflow);

  console.log(
    'Registered workflows:',
    engine.listWorkflows().map((w) => w.id),
  );
  console.log('\nExecuting real-user-pipeline...\n');

  const run = await engine.trigger('real-user-pipeline');

  console.log('Run status:', run.status);
  console.log('Run ID:', run.id);

  if (run.status === 'completed' && run.output) {
    const output = run.output as { totalUsers: number; companies: string[]; report: string };
    console.log('\n' + output.report);
  } else if (run.error) {
    console.error('Run failed:', run.error);
  }

  const durationMs =
    run.completedAt && run.startedAt
      ? run.completedAt.getTime() - run.startedAt.getTime()
      : undefined;
  console.log(`\nDuration: ${durationMs}ms`);

  await engine.destroy();
}

main().catch(console.error);

export { fetchUsersNode, transformUsersNode, filterByCompanyNode, createReportNode, realWorkflow };
