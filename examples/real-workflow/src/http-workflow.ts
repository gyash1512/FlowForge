import { z } from 'zod';
import { defineNode, workflow } from '@flowforge/sdk';
import type { DataAdaptor } from '@flowforge/sdk';
import { Engine, NoopLogger } from '@flowforge/engine';

// ── HTTP Data Adaptor ──
// Registers as a DataAdaptor so nodes can use ctx.pull('http', { url, method })
// instead of calling fetch() directly. This proves the adaptor wiring works.

interface HttpPullParams {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

const httpDataAdaptor: DataAdaptor = {
  name: 'http',

  async pull(params: unknown): Promise<unknown> {
    const { url, method = 'GET', headers = {}, body } = params as HttpPullParams;

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
      (fetchOptions.headers as Record<string, string>)['Content-Type'] =
        (fetchOptions.headers as Record<string, string>)['Content-Type'] ?? 'application/json';
    }

    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP adaptor: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  },

  async push(params: unknown): Promise<unknown> {
    // For a real adaptor you could POST/PUT data here.
    // This example only demonstrates pull.
    const { url, method = 'POST', headers = {}, body } = params as HttpPullParams;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP adaptor push: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  },

  async healthCheck(): Promise<boolean> {
    try {
      const resp = await fetch('https://jsonplaceholder.typicode.com/', {
        method: 'HEAD',
      });
      return resp.ok;
    } catch {
      return false;
    }
  },
};

// ── Nodes that use ctx.pull('http', ...) ──

/**
 * Uses ctx.pull('http', ...) to fetch posts via the registered HTTP adaptor.
 * This proves the Engine -> DataAdaptorManager -> adaptor.pull() wiring works.
 */
const fetchPostsViaAdaptor = defineNode({
  name: 'fetch-posts-via-adaptor',
  version: '1.0.0',
  description: 'Fetches posts from JSONPlaceholder using ctx.pull()',
  category: 'data',
  inputSchema: z.object({
    userId: z.number().optional(),
  }),
  outputSchema: z.array(
    z.object({
      userId: z.number(),
      id: z.number(),
      title: z.string(),
      body: z.string(),
    }),
  ),
  configSchema: z.object({}),
  handler: async (ctx) => {
    const userId = ctx.input.userId;
    const url = userId
      ? `https://jsonplaceholder.typicode.com/posts?userId=${userId}`
      : 'https://jsonplaceholder.typicode.com/posts';

    // Use ctx.pull -- this routes through the engine's DataAdaptorManager
    const data = await ctx.pull('http', { url, method: 'GET' });
    return data as Array<{ userId: number; id: number; title: string; body: string }>;
  },
});

/**
 * Summarizes a list of posts into title + word count.
 */
const summarizePostsNode = defineNode({
  name: 'summarize-posts',
  version: '1.0.0',
  description: 'Summarizes posts with title and word count',
  category: 'transform',
  inputSchema: z.array(
    z.object({
      userId: z.number(),
      id: z.number(),
      title: z.string(),
      body: z.string(),
    }),
  ),
  outputSchema: z.object({
    postCount: z.number(),
    summaries: z.array(
      z.object({
        id: z.number(),
        title: z.string(),
        wordCount: z.number(),
      }),
    ),
  }),
  configSchema: z.object({
    limit: z.number().default(5),
  }),
  handler: async (ctx) => {
    const limit = (ctx.config as { limit: number }).limit;
    const posts = ctx.input.slice(0, limit);
    return {
      postCount: ctx.input.length,
      summaries: posts.map((post: { id: number; title: string; body: string }) => ({
        id: post.id,
        title: post.title,
        wordCount: post.body.split(/\s+/).length,
      })),
    };
  },
});

// ── Workflow Definition ──

const httpAdaptorWorkflow = workflow('http-adaptor-pipeline')
  .name('HTTP Adaptor Pipeline')
  .version('1.0.0')
  .description(
    'Demonstrates ctx.pull() with a registered HTTP data adaptor to fetch and summarize posts',
  )
  .trigger({ type: 'manual' })
  .timeout(15000)
  .node('fetch-posts', fetchPostsViaAdaptor, {
    input: () => ({ userId: 1 }),
  })
  .node('summarize', summarizePostsNode, {
    input: (ctx) => ctx.steps['fetch-posts'],
    config: { limit: 5 },
  })
  .build();

// ── Run ──

async function main() {
  const engine = new Engine();

  // Register the HTTP data adaptor -- this is the key step that wires ctx.pull('http', ...)
  engine.registerAdaptor(httpDataAdaptor);

  engine.register(httpAdaptorWorkflow);

  console.log('Registered adaptors:', engine.data.list());
  console.log(
    'Registered workflows:',
    engine.listWorkflows().map((w) => w.id),
  );
  console.log('\nExecuting http-adaptor-pipeline...\n');

  const run = await engine.trigger('http-adaptor-pipeline');

  console.log('Run status:', run.status);
  console.log('Run ID:', run.id);

  if (run.status === 'completed' && run.output) {
    const output = run.output as {
      postCount: number;
      summaries: Array<{ id: number; title: string; wordCount: number }>;
    };
    console.log(`\nTotal posts for userId=1: ${output.postCount}`);
    console.log(`Showing first ${output.summaries.length} summaries:\n`);
    for (const s of output.summaries) {
      console.log(`  [${s.id}] ${s.title} (${s.wordCount} words)`);
    }
  } else if (run.error) {
    console.error('Run failed:', run.error);
  }

  await engine.destroy();
}

main().catch(console.error);

export { httpDataAdaptor, fetchPostsViaAdaptor, summarizePostsNode, httpAdaptorWorkflow };
