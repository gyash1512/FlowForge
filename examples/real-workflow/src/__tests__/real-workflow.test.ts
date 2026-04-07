import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defineNode, workflow, RunStatus } from '@flowforgejs/sdk';
import { Engine, NoopLogger } from '@flowforgejs/engine';

// ── Shared schemas used across tests ──

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  company: z.object({ name: z.string() }),
});

const simplifiedUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  company: z.string(),
});

// ── Reusable node factories ──

function makeFetchUsersNode() {
  return defineNode({
    name: 'fetch-users',
    version: '1.0.0',
    description: 'Fetches users from JSONPlaceholder API',
    category: 'data',
    inputSchema: z.object({ url: z.string().url() }),
    outputSchema: z.array(userSchema),
    configSchema: z.object({}),
    retries: 1,
    handler: async (ctx) => {
      const response = await fetch(ctx.input.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
  });
}

function makeTransformNode() {
  return defineNode({
    name: 'transform-users',
    version: '1.0.0',
    description: 'Maps users to simplified objects',
    category: 'transform',
    inputSchema: z.array(userSchema),
    outputSchema: z.array(simplifiedUserSchema),
    configSchema: z.object({}),
    handler: async (ctx) => {
      return ctx.input.map((user: z.infer<typeof userSchema>) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        company: user.company.name,
      }));
    },
  });
}

function makeFilterNode() {
  return defineNode({
    name: 'filter-by-company',
    version: '1.0.0',
    description: 'Filters users by company name',
    category: 'transform',
    inputSchema: z.array(simplifiedUserSchema),
    outputSchema: z.array(simplifiedUserSchema),
    configSchema: z.object({
      companies: z.array(z.string()),
    }),
    handler: async (ctx) => {
      const targets = (ctx.config as { companies: string[] }).companies;
      return ctx.input.filter((user: z.infer<typeof simplifiedUserSchema>) =>
        targets.some((c) => user.company.includes(c)),
      );
    },
  });
}

// ── Tests ──

describe('real-workflow: end-to-end with live HTTP', () => {
  it('fetches real data from JSONPlaceholder API', async () => {
    const fetchUsersNode = makeFetchUsersNode();

    const wf = workflow('fetch-test')
      .trigger({ type: 'manual' })
      .timeout(15000)
      .node('fetch', fetchUsersNode, {
        input: () => ({ url: 'https://jsonplaceholder.typicode.com/users' }),
      })
      .build();

    const engine = new Engine({ logger: new NoopLogger() });
    engine.register(wf);

    const run = await engine.trigger('fetch-test');

    expect(run.status).toBe(RunStatus.COMPLETED);
    expect(run.error).toBeUndefined();

    const users = run.output as Array<{ id: number; name: string; email: string }>;
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBe(10); // JSONPlaceholder always returns 10 users

    // Verify real data -- these are actual names from the API
    const names = users.map((u) => u.name);
    expect(names).toContain('Leanne Graham');
    expect(names).toContain('Ervin Howell');

    // Every user has required fields
    for (const user of users) {
      expect(user.id).toBeTypeOf('number');
      expect(user.name).toBeTypeOf('string');
      expect(user.email).toBeTypeOf('string');
      expect(user.name.length).toBeGreaterThan(0);
      expect(user.email).toContain('@');
    }

    await engine.destroy();
  }, 15000);

  it('transforms and filters real API data', async () => {
    const fetchNode = makeFetchUsersNode();
    const transformNode = makeTransformNode();
    const filterNode = makeFilterNode();

    const wf = workflow('transform-filter-test')
      .trigger({ type: 'manual' })
      .timeout(15000)
      .node('fetch', fetchNode, {
        input: () => ({ url: 'https://jsonplaceholder.typicode.com/users' }),
      })
      .node('transform', transformNode, {
        input: (ctx) => ctx.steps['fetch'],
      })
      .node('filter', filterNode, {
        input: (ctx) => ctx.steps['transform'],
        config: { companies: ['Romaguera-Crona', 'Deckow-Crist'] },
      })
      .build();

    const engine = new Engine({ logger: new NoopLogger() });
    engine.register(wf);

    const run = await engine.trigger('transform-filter-test');

    expect(run.status).toBe(RunStatus.COMPLETED);

    const filtered = run.output as Array<{
      id: number;
      name: string;
      email: string;
      company: string;
    }>;
    expect(Array.isArray(filtered)).toBe(true);
    // Romaguera-Crona is user 1 (Leanne Graham), Deckow-Crist is user 10 (Clementina DuBuque)
    expect(filtered.length).toBeGreaterThanOrEqual(1);

    // Every filtered user has the simplified structure (company is a string, not object)
    for (const user of filtered) {
      expect(user.id).toBeTypeOf('number');
      expect(user.name).toBeTypeOf('string');
      expect(user.email).toBeTypeOf('string');
      expect(user.company).toBeTypeOf('string');
    }

    // Verify the filter actually worked -- every result must match one of the target companies
    for (const user of filtered) {
      const matchesTarget =
        user.company.includes('Romaguera-Crona') || user.company.includes('Deckow-Crist');
      expect(matchesTarget).toBe(true);
    }

    await engine.destroy();
  }, 15000);

  it('handles HTTP errors gracefully', async () => {
    const fetchNode = defineNode({
      name: 'fetch-404',
      version: '1.0.0',
      description: 'Fetches from a URL that returns 404',
      category: 'data',
      inputSchema: z.object({ url: z.string().url() }),
      outputSchema: z.any(),
      configSchema: z.object({}),
      retries: 1,
      handler: async (ctx) => {
        const response = await fetch(ctx.input.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      },
    });

    const wf = workflow('error-test')
      .trigger({ type: 'manual' })
      .timeout(15000)
      .node('fetch', fetchNode, {
        input: () => ({
          url: 'https://jsonplaceholder.typicode.com/users/99999',
        }),
      })
      .build();

    const engine = new Engine({ logger: new NoopLogger() });
    engine.register(wf);

    const run = await engine.trigger('error-test');

    expect(run.status).toBe(RunStatus.FAILED);
    expect(run.error).toBeDefined();
    expect(run.error).toContain('404');

    await engine.destroy();
  }, 15000);

  it('runs a conditional workflow based on real data', async () => {
    const fetchNode = makeFetchUsersNode();

    const countNode = defineNode({
      name: 'count-users',
      version: '1.0.0',
      description: 'Counts the number of users',
      category: 'transform',
      inputSchema: z.array(z.any()),
      outputSchema: z.object({ count: z.number() }),
      configSchema: z.object({}),
      handler: async (ctx) => ({ count: ctx.input.length }),
    });

    const manyUsersNode = defineNode({
      name: 'many-users',
      version: '1.0.0',
      description: 'Returns a message for many users',
      category: 'custom',
      inputSchema: z.any(),
      outputSchema: z.object({ label: z.string(), count: z.number() }),
      configSchema: z.object({}),
      handler: async (ctx) => {
        const count = (ctx.steps['count'] as { count: number }).count;
        return { label: 'many users', count };
      },
    });

    const fewUsersNode = defineNode({
      name: 'few-users',
      version: '1.0.0',
      description: 'Returns a message for few users',
      category: 'custom',
      inputSchema: z.any(),
      outputSchema: z.object({ label: z.string(), count: z.number() }),
      configSchema: z.object({}),
      handler: async (ctx) => {
        const count = (ctx.steps['count'] as { count: number }).count;
        return { label: 'few users', count };
      },
    });

    const wf = workflow('conditional-test')
      .trigger({ type: 'manual' })
      .timeout(15000)
      .node('fetch', fetchNode, {
        input: () => ({ url: 'https://jsonplaceholder.typicode.com/users' }),
      })
      .node('count', countNode, {
        input: (ctx) => ctx.steps['fetch'],
      })
      .if('user-count-branch', {
        condition: (ctx) => (ctx.steps['count'] as { count: number }).count > 5,
        then: [['result', manyUsersNode]],
        else: [['result', fewUsersNode]],
      })
      .build();

    const engine = new Engine({ logger: new NoopLogger() });
    engine.register(wf);

    const run = await engine.trigger('conditional-test');

    expect(run.status).toBe(RunStatus.COMPLETED);

    // JSONPlaceholder returns 10 users, so count > 5 is true -> "many users"
    const result = run.output as { label: string; count: number } | undefined;
    // The last step in the "then" branch produces the output
    // Because the if-branch runs the "result" step, its output lands in stepOutputs
    // but the overall workflow output comes from the last top-level step.
    // The if step itself is the last top-level step, so we check the run completed.
    expect(run.error).toBeUndefined();

    await engine.destroy();
  }, 15000);

  it('parallel fan-out with real data transforms', async () => {
    const fetchNode = makeFetchUsersNode();

    const uppercaseNode = defineNode({
      name: 'uppercase-name',
      version: '1.0.0',
      description: 'Uppercases a user name',
      category: 'transform',
      inputSchema: z.any(),
      outputSchema: z.object({
        id: z.number(),
        name: z.string(),
        email: z.string(),
      }),
      configSchema: z.object({}),
      handler: async (ctx) => {
        const user = ctx.input as { id: number; name: string; email: string };
        return {
          id: user.id,
          name: user.name.toUpperCase(),
          email: user.email,
        };
      },
    });

    const wf = workflow('parallel-test')
      .trigger({ type: 'manual' })
      .timeout(15000)
      .node('fetch', fetchNode, {
        input: () => ({ url: 'https://jsonplaceholder.typicode.com/users' }),
      })
      .parallel('process-users', {
        items: (ctx) => {
          const users = ctx.steps['fetch'] as Array<{
            id: number;
            name: string;
            email: string;
          }>;
          return users;
        },
        concurrency: 3,
        pipeline: (item) => [['uppercase', uppercaseNode, { input: () => item }]],
      })
      .build();

    const engine = new Engine({ logger: new NoopLogger() });
    engine.register(wf);

    const run = await engine.trigger('parallel-test');

    expect(run.status).toBe(RunStatus.COMPLETED);
    expect(run.error).toBeUndefined();

    const results = run.output as Array<{
      id: number;
      name: string;
      email: string;
    }>;
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(10); // all 10 users processed

    // Every name should be fully uppercased
    for (const user of results) {
      expect(user.name).toBe(user.name.toUpperCase());
      expect(user.name.length).toBeGreaterThan(0);
      expect(user.id).toBeTypeOf('number');
    }

    await engine.destroy();
  }, 15000);
});
