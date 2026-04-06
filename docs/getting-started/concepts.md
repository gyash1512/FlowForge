# Core Concepts

FlowForge has six core primitives: **nodes**, **workflows**, the **engine**, **context**, **tools**, and **integrations**.

---

## Nodes

A node is a unit of work. It is defined by a `NodeDefinition` object that declares its identity, schemas, handler, and optional lifecycle hooks.

```typescript
import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const myNode = defineNode({
  name: 'my-node',
  version: '1.0.0',
  description: 'Does something useful',
  category: 'transform',

  // Zod schemas -- validated at runtime by the engine
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ upper: z.string() }),
  configSchema: z.object({ prefix: z.string().default('') }),

  // The main execution function
  handler: async (ctx) => {
    const prefix = (ctx.config as { prefix: string }).prefix;
    return { upper: prefix + ctx.input.text.toUpperCase() };
  },

  // Optional lifecycle hooks
  onInit: async (config) => {
    /* called once when node is first loaded */
  },
  onDestroy: async () => {
    /* cleanup resources */
  },
  onError: async (error, ctx) => {
    /* custom error handling */
  },

  // Retry and timeout
  retries: 3, // default: 3
  timeout: 10_000, // milliseconds
});
```

### Node categories

Every node belongs to one of six categories:

| Category        | Purpose                             | Examples                                                  |
| --------------- | ----------------------------------- | --------------------------------------------------------- |
| `data`          | Read and write external data stores | PostgreSQL, Redis, MongoDB, S3, Elasticsearch             |
| `communication` | Interact with third-party services  | Slack, GitHub, Jira, Salesforce, Email                    |
| `ai`            | LLM operations                      | generate-text, generate-object, embed, agent, mcp-client  |
| `control`       | Workflow control flow               | if, switch, forEach, parallel, while, delay, sub-workflow |
| `transform`     | Data transformation                 | map, filter, reduce, template                             |
| `custom`        | User-defined nodes                  | Anything you build with `defineNode()`                    |

### Handler function

The handler receives a `NodeContext` and must return a value that conforms to the `outputSchema`. The engine validates both the input before calling the handler and the output after it returns.

### Lifecycle hooks

| Hook                  | When it runs                                            |
| --------------------- | ------------------------------------------------------- |
| `onInit(config)`      | Once, when the node is first loaded with its config     |
| `onDestroy()`         | Once, during engine shutdown                            |
| `onError(error, ctx)` | On handler failure, before the retry mechanism kicks in |

---

## Workflows

A workflow is a directed acyclic graph (DAG) of steps, initiated by a trigger. You build workflows with the fluent `workflow()` builder.

```typescript
import { workflow } from '@flowforge/sdk';

const myWorkflow = workflow('my-workflow')
  .name('My Workflow')
  .version('1.0.0')
  .description('Processes incoming data')
  .trigger({ type: 'event', event: 'data.received' })
  .timeout(60_000)
  .retry({ maxAttempts: 3 })
  .node('step-1', nodeA)
  .node('step-2', nodeB, {
    input: (ctx) => ctx.steps['step-1'],
    when: (ctx) => ctx.steps['step-1'] !== null,
    dependsOn: ['step-1'],
  })
  .build();
```

### Triggers

A trigger determines how a workflow is started:

| Type           | Description                               | Example                                                   |
| -------------- | ----------------------------------------- | --------------------------------------------------------- |
| `manual`       | Started explicitly via `engine.trigger()` | `{ type: "manual" }`                                      |
| `event`        | Started when a matching event is emitted  | `{ type: "event", event: "order.created" }`               |
| `cron`         | Started on a schedule                     | `{ type: "cron", cron: "0 */6 * * *" }`                   |
| `webhook`      | Started by an incoming HTTP request       | `{ type: "webhook", webhook: { path: "/hooks/deploy" } }` |
| `sub-workflow` | Started by another workflow               | `{ type: "sub-workflow" }`                                |

### Step options

Each `.node()` call accepts optional configuration:

- **`input`** -- A function `(ctx: StepContext) => unknown` or a static object. Maps data from the trigger event or previous step outputs into this step's input.
- **`config`** -- Static configuration passed to the node's `configSchema`.
- **`when`** -- A predicate `(ctx: StepContext) => boolean`. If it returns `false`, the step is skipped.
- **`dependsOn`** -- An array of step names. The engine uses these to build the DAG and determine execution order.

### Control flow

The builder exposes control flow methods that compose with regular node steps:

| Method                                                 | Description                |
| ------------------------------------------------------ | -------------------------- |
| `.if(name, { condition, then, else })`                 | Conditional branching      |
| `.switch(name, { value, cases, default })`             | Multi-way branching        |
| `.forEach(name, { items, concurrency, pipeline })`     | Iterate over a collection  |
| `.parallel(name, { items, concurrency, pipeline })`    | Fan-out parallel execution |
| `.while(name, { condition, maxIterations, pipeline })` | Loop while condition holds |

---

## Engine

The `Engine` is the runtime that registers workflows and executes them.

```typescript
import { Engine } from '@flowforge/engine';

const engine = new Engine();

// Register workflows
engine.register(myWorkflow);

// Trigger a workflow directly
const run = await engine.trigger('my-workflow', { key: 'value' });

// Or emit an event -- all workflows listening for it will trigger
const runs = await engine.emit('data.received', { key: 'value' });

// Inspect runs
console.log(run.status); // "completed" | "failed" | "cancelled"
console.log(run.output); // output of the last step

// Cleanup
await engine.destroy();
```

### Key methods

| Method                         | Description                                                               |
| ------------------------------ | ------------------------------------------------------------------------- |
| `register(workflow)`           | Register a workflow definition. Event-triggered workflows auto-subscribe. |
| `unregister(workflowId)`       | Remove a workflow.                                                        |
| `trigger(workflowId, input?)`  | Execute a workflow and return a `RunRecord`.                              |
| `emit(event, payload?)`        | Emit an event. Returns `RunRecord[]` for all triggered workflows.         |
| `registerAdaptor(adaptor)`     | Register a data adaptor for `ctx.pull()`/`ctx.push()`.                    |
| `registerIntegration(adaptor)` | Register an integration adaptor for `ctx.integrate()`.                    |
| `getRun(runId)`                | Retrieve a run record by ID.                                              |
| `listRuns(workflowId?)`        | List all runs, optionally filtered by workflow.                           |
| `cancelRun(runId)`             | Cancel a running workflow.                                                |
| `destroy()`                    | Shut down the engine and release all resources.                           |

---

## Context

Every node handler receives a `NodeContext` object. This is the primary interface between your code and the engine runtime.

```typescript
interface NodeContext<TInput = unknown, TConfig = unknown> {
  input: TInput; // Validated input data
  config: TConfig; // Validated config data
  event: WorkflowEvent; // The trigger event
  steps: Record<string, unknown>; // Outputs from previous steps
  logger: Logger; // Structured logger (Pino-compatible)
  signal: AbortSignal; // Abort signal for cancellation
  metadata: WorkflowMetadata; // Run ID, workflow ID, attempt number

  // Data operations
  pull(source: string, params: unknown): Promise<unknown>;
  push(target: string, params: unknown): Promise<unknown>;

  // Integration operations
  integrate(name: string, action: string, params: unknown): Promise<unknown>;

  // AI operations
  ai: AIContext;

  // Event operations
  emit(event: string, data: unknown): Promise<void>;
  wait(event: string, match?: unknown, timeout?: number): Promise<unknown>;
  sleep(ms: number): Promise<void>;
  checkpoint(): Promise<void>;
}
```

### Data operations: `pull` and `push`

These connect to registered data adaptors (PostgreSQL, Redis, MongoDB, etc.):

```typescript
handler: async (ctx) => {
  const users = await ctx.pull('postgres', {
    query: 'SELECT * FROM users WHERE active = true',
  });
  await ctx.push('redis', {
    key: 'active-users',
    value: JSON.stringify(users),
  });
  return users;
};
```

### Integration operations: `integrate`

Calls a registered integration adaptor (Composio-backed or custom):

```typescript
handler: async (ctx) => {
  await ctx.integrate('slack', 'send_message', {
    channel: '#alerts',
    text: `Pipeline completed: ${ctx.steps['report']}`,
  });
};
```

### AI operations: `ai`

Wraps the Vercel AI SDK for LLM interactions:

```typescript
handler: async (ctx) => {
  const result = await ctx.ai.generateText({
    model: 'gpt-4o',
    prompt: `Summarize: ${ctx.input.text}`,
  });
  return { summary: result.text };
};
```

The `AIContext` interface exposes four methods:

| Method                   | Description                                                 |
| ------------------------ | ----------------------------------------------------------- |
| `generateText(params)`   | Generate text, optionally with tool calling                 |
| `streamText(params)`     | Stream text generation                                      |
| `generateObject(params)` | Generate a structured object validated against a Zod schema |
| `embed(params)`          | Generate vector embeddings                                  |

### Event operations

| Method                          | Description                                     |
| ------------------------------- | ----------------------------------------------- |
| `emit(event, data)`             | Emit an event that can trigger other workflows  |
| `wait(event, match?, timeout?)` | Pause execution until a matching event arrives  |
| `sleep(ms)`                     | Pause execution for a duration                  |
| `checkpoint()`                  | Persist the current workflow state for recovery |

---

## Tools

Tool nodes are specialized nodes designed to be called by AI agents. They wrap capabilities like filesystem access, shell execution, and web browsing behind Zod-validated interfaces with configurable permission scopes.

FlowForge ships 9 tool nodes:

| Tool             | Description                                    |
| ---------------- | ---------------------------------------------- |
| Filesystem       | Read, write, list, and delete files            |
| Shell            | Execute shell commands                         |
| Code Interpreter | Run Python/JS in a sandboxed E2B environment   |
| Web Search       | Search the web via DuckDuckGo                  |
| Web Scrape       | Extract content from web pages with Cheerio    |
| Browser          | Automate browsers with Puppeteer               |
| Git              | Clone, commit, push, and manage repositories   |
| Document Parser  | Parse PDFs and structured documents            |
| Math             | Evaluate mathematical expressions with math.js |

Tool nodes are regular `NodeDefinition` objects. You can use them as standalone workflow steps or pass them as tools to an agent node.

!!! warning "Safety"
Tool nodes that access the filesystem, shell, or network should be gated by permission scopes. See [Safety and Permissions](../guides/safety.md) for configuration details.

---

## Integrations

FlowForge provides 46 communication nodes backed by the Composio integration platform. Each integration is a `NodeDefinition` that calls `ctx.integrate()` under the hood, routing requests through the integration service to the appropriate Composio adaptor.

Integrations span messaging, email, developer tools, project management, CRM, payments, social media, support, and analytics. See [Integrations Overview](../integrations/index.md) for the full list.

### Custom integrations

You can register your own integration adaptor by implementing the `IntegrationAdaptor` interface:

```typescript
const myAdaptor: IntegrationAdaptor = {
  name: 'my-service',
  actions: ['send', 'fetch'],
  execute: async (action, params, connectionId) => {
    // Call your service
  },
  healthCheck: async () => true,
};

engine.registerIntegration(myAdaptor);
```

---

## Safety and Permissions

FlowForge supports a human-in-the-loop approval model for sensitive operations. The `human-approval` control node pauses workflow execution and waits for external approval before allowing downstream steps to proceed.

Combined with configurable permission scopes on tool nodes, this provides layered safety:

1. **Permission scopes** -- Restrict what a tool node is allowed to do (read-only filesystem, no network, etc.)
2. **Human approval gates** -- Require explicit approval before executing dangerous steps
3. **Abort signals** -- Cancel running workflows at any time via `engine.cancelRun()`
4. **Timeouts** -- Node-level and workflow-level timeout enforcement

See [Safety and Permissions](../guides/safety.md) for implementation details.
