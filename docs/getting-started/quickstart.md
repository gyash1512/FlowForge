# Quick Start

Build and run a complete workflow in five minutes.

## Prerequisites

- **Node.js 20+**
- **pnpm** (recommended) or npm/yarn

## 1. Install packages

=== "pnpm"

    ```bash
    pnpm add @flowforge/sdk @flowforge/engine zod
    ```

=== "npm"

    ```bash
    npm install @flowforge/sdk @flowforge/engine zod
    ```

## 2. Define a node

Every node is created with `defineNode()`. You declare Zod schemas for input, output, and config, then write an async handler that receives a typed `NodeContext`.

```typescript
import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

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
  handler: async (_ctx) => {
    return [
      { id: '1', name: 'Alice', email: 'alice@example.com' },
      { id: '2', name: 'Bob', email: 'bob@example.com' },
    ];
  },
});
```

!!! info "Schema validation"
The engine validates inputs and outputs against your Zod schemas at runtime. If validation fails, the step errors immediately -- no silent data corruption.

## 3. Define a second node

```typescript
const enrichUsers = defineNode({
  name: 'enrich-users',
  version: '1.0.0',
  description: 'Adds domain info to each user',
  category: 'transform',
  inputSchema: z.array(z.object({ id: z.string(), name: z.string(), email: z.string() })),
  outputSchema: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      domain: z.string(),
    }),
  ),
  configSchema: z.object({}),
  handler: async (ctx) => {
    return ctx.input.map((user) => ({
      ...user,
      domain: user.email.split('@')[1],
    }));
  },
});
```

## 4. Build a workflow

Use the `workflow()` builder to chain a trigger and one or more node steps. Each step can map its input from previous step outputs via `ctx.steps`.

```typescript
import { workflow } from '@flowforge/sdk';

const userPipeline = workflow('user-pipeline')
  .name('User Pipeline')
  .version('1.0.0')
  .description('Fetch users and enrich with domain info')
  .trigger({ type: 'manual' })
  .node('fetch', fetchUsers)
  .node('enrich', enrichUsers, {
    input: (ctx) => ctx.steps['fetch'], // (1)!
  })
  .build();
```

1. `ctx.steps` is a record keyed by step name. Here, the enrich step receives the output of the fetch step.

## 5. Run with the Engine

```typescript
import { Engine } from '@flowforge/engine';

const engine = new Engine();
engine.register(userPipeline);

const run = await engine.trigger('user-pipeline');

console.log(run.status); // "completed"
console.log(run.output);
// [
//   { id: "1", name: "Alice", email: "alice@example.com", domain: "example.com" },
//   { id: "2", name: "Bob", email: "bob@example.com", domain: "example.com" },
// ]
```

!!! success "That's it"
You have defined two type-safe nodes, composed them into a workflow, and executed it with the engine. The engine handled schema validation, step ordering, and error propagation.

## 6. Add control flow

The builder supports `if`, `forEach`, `parallel`, `switch`, and `while` for branching and iteration:

```typescript
const pipeline = workflow('conditional-pipeline')
  .trigger({ type: 'manual' })
  .node('fetch', fetchUsers)
  .if('check-count', {
    condition: (ctx) => (ctx.steps['fetch'] as any[]).length > 1,
    then: [['enrich', enrichUsers, { input: (ctx) => ctx.steps['fetch'] }]],
    else: [['skip', async () => ({ skipped: true })]],
  })
  .build();
```

## Next steps

- [Installation](installation.md) -- Package details, TypeScript config, environment variables
- [Core Concepts](concepts.md) -- Deep dive into nodes, workflows, context, and integrations
- [Architecture](architecture.md) -- How the engine executes workflows
- [Building Custom Nodes](../guides/custom-nodes.md) -- Lifecycle hooks, retries, and publishing
- [Building Agents](../guides/agents.md) -- Create LLM-powered agent nodes with tool calling
