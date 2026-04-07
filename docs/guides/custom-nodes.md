# Building Custom Nodes

This guide covers how to create, test, and publish custom nodes for FlowForge.

## defineNode() API

The `defineNode()` function from `@flowforgejs/sdk` creates a `NodeDefinition` object:

```typescript
import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

export const sentimentNode = defineNode({
  name: 'custom/sentiment-analysis',
  version: '1.0.0',
  description: 'Analyze sentiment of text using an LLM',
  category: 'ai',

  inputSchema: z.object({
    text: z.string().min(1),
    language: z.string().default('en'),
  }),

  outputSchema: z.object({
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    confidence: z.number().min(0).max(1),
    explanation: z.string(),
  }),

  configSchema: z.object({
    model: z.string().default('gpt-4o-mini'),
    threshold: z.number().default(0.7),
  }),

  handler: async (ctx) => {
    const { text, language } = ctx.input as { text: string; language: string };
    const { model } = ctx.config as { model: string };

    const result = await ctx.ai.generateObject({
      model,
      schema: z.object({
        sentiment: z.enum(['positive', 'negative', 'neutral']),
        confidence: z.number(),
        explanation: z.string(),
      }),
      prompt: `Analyze the sentiment of the following ${language} text: "${text}"`,
    });

    return result.object;
  },

  // Optional lifecycle hooks
  onInit: async (config) => {
    console.log('Node initialized with config:', config);
  },

  onDestroy: async () => {
    console.log('Node destroyed, cleaning up resources');
  },

  onError: async (error, ctx) => {
    ctx.logger.error({ err: error }, 'Sentiment analysis failed');
  },

  // Optional metadata
  retries: 2,
  timeout: 30_000,
  tags: ['ai', 'nlp', 'sentiment'],
  author: 'your-name',
  repository: 'https://github.com/your-org/flowforge-sentiment',
});
```

## Full Options Reference

| Option         | Type                                                | Required | Default | Description                                                             |
| -------------- | --------------------------------------------------- | -------- | ------- | ----------------------------------------------------------------------- |
| `name`         | `string`                                            | Yes      | --      | Unique node identifier (convention: `category/name`)                    |
| `version`      | `string`                                            | Yes      | --      | Semver version string                                                   |
| `description`  | `string`                                            | Yes      | --      | Human-readable description                                              |
| `category`     | `NodeCategory`                                      | Yes      | --      | One of: `data`, `communication`, `ai`, `control`, `transform`, `custom` |
| `inputSchema`  | `z.ZodTypeAny`                                      | Yes      | --      | Zod schema for input validation                                         |
| `outputSchema` | `z.ZodTypeAny`                                      | Yes      | --      | Zod schema for output validation                                        |
| `configSchema` | `z.ZodTypeAny`                                      | Yes      | --      | Zod schema for static configuration                                     |
| `handler`      | `(ctx: NodeContext) => Promise<unknown>`            | Yes      | --      | Execution logic                                                         |
| `onInit`       | `(config: unknown) => Promise<void>`                | No       | --      | Called once when node is initialized                                    |
| `onDestroy`    | `() => Promise<void>`                               | No       | --      | Called when node is torn down                                           |
| `onError`      | `(error: Error, ctx: NodeContext) => Promise<void>` | No       | --      | Called on handler errors (before retry)                                 |
| `retries`      | `number`                                            | No       | `3`     | Max retry attempts on failure                                           |
| `timeout`      | `number`                                            | No       | --      | Handler timeout in milliseconds                                         |
| `tags`         | `string[]`                                          | No       | --      | Searchable tags                                                         |
| `author`       | `string`                                            | No       | --      | Author name                                                             |
| `repository`   | `string`                                            | No       | --      | Source repository URL                                                   |

## Input/Output/Config Schemas

All three schemas use [Zod](https://zod.dev). They serve two purposes:

1. **Runtime validation** -- the engine validates input, output, and config before and after handler execution.
2. **Documentation** -- schemas are introspectable and can generate JSON Schema for dashboard UIs and API docs.

```typescript
// Schemas with descriptions for better documentation
const inputSchema = z.object({
  query: z.string().min(1).describe('Search query string'),
  limit: z.number().int().min(1).max(100).default(10).describe('Max results'),
  filters: z.record(z.string()).optional().describe('Key-value filter pairs'),
});
```

!!! tip "Use .describe()"
Adding `.describe()` to schema fields improves auto-generated documentation and helps LLM agents understand what each field does when the node is used as a tool.

## Handler Function

The handler receives a `NodeContext` object with full access to the FlowForge runtime:

```typescript
handler: async (ctx) => {
  // Access validated input and config
  const input = ctx.input as MyInput;
  const config = ctx.config as MyConfig;

  // Use data adaptors
  const records = await ctx.pull('postgres', { query: 'SELECT * FROM t' });

  // Use integrations
  await ctx.integrate('slack', 'sendMessage', { channel: '#alerts', text: 'Alert!' });

  // Use AI
  const response = await ctx.ai.generateText({ model: 'gpt-4o', prompt: 'Hello' });

  // Access previous step outputs
  const previousResult = ctx.steps['previous-step-name'];

  // Emit events
  await ctx.emit('processing.complete', { id: 123 });

  // Log
  ctx.logger.info({ recordCount: 42 }, 'Processing complete');

  // Return output (validated against outputSchema)
  return { result: response.text, count: 42 };
};
```

## Lifecycle Hooks

### onInit

Called once when the node is first loaded. Use it for setup work like establishing connections or validating configuration.

```typescript
onInit: async (config) => {
  const { apiKey } = config as { apiKey: string };
  if (!apiKey) throw new Error('apiKey is required');
  // Pre-warm connections, load models, etc.
},
```

### onDestroy

Called when the engine shuts down. Use it to clean up resources.

```typescript
onDestroy: async () => {
  await connectionPool.drain();
  await cache.flush();
},
```

### onError

Called when the handler throws an error, before the retry mechanism kicks in. Use it for custom error logging or alerting.

```typescript
onError: async (error, ctx) => {
  ctx.logger.error({ err: error, runId: ctx.metadata.runId }, 'Node failed');
  await ctx.integrate('slack', 'sendMessage', {
    connectionId: 'alerts',
    channel: '#errors',
    text: `Node ${ctx.metadata.workflowId} failed: ${error.message}`,
  });
},
```

## Testing with @flowforgejs/test-utils

The `@flowforgejs/test-utils` package provides `createMockContext()` for unit testing nodes:

```typescript
import { describe, it, expect } from 'vitest';
import { createMockContext } from '@flowforgejs/test-utils';
import { sentimentNode } from './sentiment';

describe('sentimentNode', () => {
  it('should analyze positive text', async () => {
    const { ctx, calls } = createMockContext({
      input: { text: 'I love this product!', language: 'en' },
      config: { model: 'gpt-4o-mini', threshold: 0.7 },
    });

    // Override AI mock to return a specific response
    ctx.ai.generateObject = async () => ({
      object: {
        sentiment: 'positive',
        confidence: 0.95,
        explanation: 'Strong positive language detected',
      },
    });

    const result = await sentimentNode.handler(ctx);

    expect(result).toEqual({
      sentiment: 'positive',
      confidence: 0.95,
      explanation: 'Strong positive language detected',
    });
  });

  it('should track integration calls', async () => {
    const { ctx, calls } = createMockContext({
      input: { text: 'test' },
      config: { model: 'gpt-4o-mini' },
    });

    await ctx.integrate('slack', 'sendMessage', { channel: '#test', text: 'hi' });

    expect(calls).toContainEqual({
      method: 'integrate',
      args: ['slack', 'sendMessage', { channel: '#test', text: 'hi' }],
    });
  });
});
```

### MockContext capabilities

The mock context provides:

- **Stub implementations** for `pull`, `push`, `integrate`, `emit`, `wait`, `sleep`, `checkpoint`
- **Call tracking** via the `calls` array -- every method invocation is recorded
- **Noop AI** -- all AI methods return empty responses by default; override them for specific test scenarios
- **MockLogger** -- captures log output without printing

## Publishing as an npm Package

Custom nodes are plain TypeScript objects. To share them:

```
my-flowforge-nodes/
  src/
    index.ts          # Re-exports all nodes
    sentiment.ts      # Node implementation
  package.json
  tsconfig.json
```

```json
{
  "name": "@my-org/flowforge-nodes",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "@flowforgejs/sdk": "^0.1.0",
    "zod": "^3.0.0"
  }
}
```

```typescript
// src/index.ts
export { sentimentNode } from './sentiment.js';
export { classifyNode } from './classify.js';
```

Consumers install and use:

```typescript
import { sentimentNode } from '@my-org/flowforge-nodes';
import { workflow } from '@flowforgejs/sdk';

const wf = workflow('analyze')
  .trigger({ type: 'manual' })
  .node('sentiment', sentimentNode, {
    config: { model: 'gpt-4o', threshold: 0.8 },
    input: (ctx) => ({ text: (ctx.event.data as { text: string }).text }),
  })
  .build();
```

!!! warning "Peer dependencies"
Always declare `@flowforgejs/sdk` and `zod` as peer dependencies to avoid version conflicts and duplicate instances.
