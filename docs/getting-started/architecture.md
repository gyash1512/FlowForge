# Architecture

This page describes how FlowForge is structured, how workflows execute, and how the major subsystems connect.

---

## Monorepo Structure

```
FlowForge/
├── packages/
│   ├── sdk/                  # defineNode(), defineAgentNode(), workflow()
│   ├── engine/               # Engine, Runner, Scheduler, Retry, State
│   ├── nodes/                # 80+ built-in node definitions
│   │   ├── ai/               #   generate-text, generate-object, embed, agent, mcp-client
│   │   ├── communication/    #   46 integration nodes (Slack, GitHub, Jira, ...)
│   │   ├── control/          #   if, switch, forEach, parallel, while, delay, ...
│   │   ├── data/             #   postgres, redis, mongodb, s3, elasticsearch, ...
│   │   ├── tools/            #   filesystem, shell, code-interpreter, browser, ...
│   │   └── transform/        #   map, filter, reduce, template
│   ├── shared/               # Types, schemas, constants, error classes
│   ├── cli/                  # flowforge CLI (Commander-based)
│   ├── worker/               # BullMQ worker + Hono HTTP API
│   ├── dashboard/            # Monitoring dashboard API
│   ├── integration-service/  # Composio adaptor microservice
│   └── test-utils/           # Testing harness for node authors
├── examples/
│   ├── basic/                # Minimal workflow example
│   └── real-workflow/        # Production-style workflow
├── docker/                   # Container definitions
└── docs/                     # This documentation (MkDocs)
```

---

## Package Dependency Graph

```
┌─────────────┐
│   @flowforgejs/shared   │  ← types, schemas, error classes
└──────┬──────┘
       │
  ┌────┴────┐
  │         │
  ▼         ▼
┌─────┐  ┌────────┐
│ sdk │  │ engine │
└──┬──┘  └───┬────┘
   │         │
   ▼         │
┌──────┐     │
│ nodes│─────┘  (nodes depend on sdk + shared; engine depends on shared)
└──┬───┘
   │
   ├──▶ cli         (cli depends on shared + worker)
   ├──▶ worker      (worker depends on shared)
   ├──▶ dashboard   (dashboard depends on shared)
   └──▶ integration-service  (depends on shared)
```

Key relationships:

- **`@flowforgejs/shared`** is the foundation. Every other package depends on it for types.
- **`@flowforgejs/sdk`** depends only on `shared` and `zod`. It has no runtime dependencies on the engine.
- **`@flowforgejs/engine`** depends only on `shared`. It receives AI, data, and integration providers through dependency injection.
- **`@flowforgejs/nodes`** depends on both `sdk` and `shared`, plus third-party libraries for specific capabilities (Cheerio, Puppeteer, E2B, math.js, etc.).

---

## Workflow Execution

When you call `engine.trigger(workflowId, input)`, the following sequence executes:

```
engine.trigger(id, input)
       │
       ▼
┌──────────────────┐
│  1. Lookup        │  Find WorkflowDefinition by ID
└────────┬─────────┘
         ▼
┌──────────────────┐
│  2. Create Run    │  Generate RunId, create RunRecord (status: PENDING)
└────────┬─────────┘
         ▼
┌──────────────────┐
│  3. Build Event   │  Wrap input into a WorkflowEvent with ID and timestamp
└────────┬─────────┘
         ▼
┌──────────────────┐
│  4. Start Timeout │  If workflow.timeout is set, arm the abort controller
└────────┬─────────┘
         ▼
┌──────────────────┐
│  5. Execute Steps │  Process steps in order (see below)
└────────┬─────────┘
         ▼
┌──────────────────┐
│  6. Collect Output│  Last step's output becomes the run output
└────────┬─────────┘
         ▼
┌──────────────────┐
│  7. Return Run    │  RunRecord with status, output, timing, errors
└──────────────────┘
```

### Step execution

The runner processes steps in one of two modes:

**Declaration order** (default) -- Steps without `dependsOn` are executed sequentially in the order they were added to the builder.

**DAG order** -- When any step declares `dependsOn`, the scheduler performs a topological sort to determine execution layers. Steps within the same layer execute concurrently via `Promise.all()`.

For each individual step:

1. **Evaluate `when` predicate** -- Skip the step if the condition returns `false`.
2. **Resolve input** -- Call the `input` function with `StepContext`, or fall back to the trigger event data.
3. **Validate input** -- Parse against the node's `inputSchema`.
4. **Resolve config** -- Merge static config with defaults from `configSchema`.
5. **Build NodeContext** -- Assemble the full context object with providers, logger, and metadata.
6. **Execute handler** -- Call the node's handler, wrapped in retry logic and timeout enforcement.
7. **Validate output** -- Parse the return value against the node's `outputSchema`.
8. **Store output** -- Save to `stepOutputs` map, keyed by step name.

### Control flow steps

Control flow steps (`if`, `parallel`, `forEach`, `switch`, `while`) are handled by dedicated methods in the runner:

| Type       | Behavior                                                                           |
| ---------- | ---------------------------------------------------------------------------------- |
| `if`       | Evaluates condition, then recursively executes the `then` or `else` branch         |
| `parallel` | Maps items through a pipeline with bounded concurrency via batched `Promise.all()` |
| `forEach`  | Same as parallel, but receives both item and index                                 |
| `switch`   | Evaluates value, selects matching case branch (or default)                         |
| `while`    | Loops up to `maxIterations`, re-evaluating condition each iteration                |

### Retry mechanism

When a step fails and has retries configured (node-level `retries` or workflow-level `retry`), the engine applies the retry policy:

| Backoff strategy | Delay calculation                                 |
| ---------------- | ------------------------------------------------- |
| `fixed`          | Same delay every attempt                          |
| `linear`         | `delayMs * attempt`                               |
| `exponential`    | `delayMs * 2^(attempt-1)`, capped at `maxDelayMs` |

The retry loop respects the workflow's abort signal. If the workflow is cancelled or times out during a retry delay, the retry terminates immediately.

---

## Integration Architecture

```
Node handler
  │
  ctx.integrate("slack", "send_message", params)
  │
  ▼
Engine (IntegrationManager)
  │
  ▼
IntegrationAdaptor (e.g., Composio adaptor)
  │
  ▼
External service (Slack API, GitHub API, etc.)
```

The integration path:

1. A node handler calls `ctx.integrate(name, action, params)`.
2. The engine routes the call to the `IntegrationManager`, which looks up the registered `IntegrationAdaptor` by name.
3. The adaptor executes the action against the external service.
4. The response is returned to the node handler.

For the 46 built-in communication nodes, each node is a thin wrapper that calls `ctx.integrate()` with the correct integration name and action. The actual API communication is handled by the Composio adaptor in the `integration-service` package.

### Custom adaptors

You can bypass Composio entirely by implementing `IntegrationAdaptor`:

```typescript
interface IntegrationAdaptor {
  name: string;
  actions: string[];
  execute(action: string, params: unknown, connectionId: string): Promise<unknown>;
  healthCheck(): Promise<boolean>;
  destroy?(): Promise<void>;
}
```

---

## AI Architecture

```
Node handler
  │
  ctx.ai.generateText({ model, prompt, tools })
  │
  ▼
Engine (AIContext)
  │
  ▼
Vercel AI SDK (generateText, streamText, generateObject, embed)
  │
  ▼
Model provider (OpenAI, Anthropic, etc.)
```

The AI subsystem is injected into the engine at construction time:

```typescript
const engine = new Engine({
  ai: {
    generateText: async (params) => {
      /* Vercel AI SDK call */
    },
    streamText: async (params) => {
      /* ... */
    },
    generateObject: async (params) => {
      /* ... */
    },
    embed: async (params) => {
      /* ... */
    },
  },
});
```

This design keeps the engine decoupled from any specific AI provider. The built-in AI nodes (`generate-text`, `generate-object`, `embed`, `agent`) all operate through `ctx.ai`, so they work with any provider that implements the `AIContext` interface.

### Agent loop

The `defineAgentNode()` function creates a node that runs an iterative tool-calling loop:

1. Send prompt to LLM with available tools.
2. If the LLM returns tool calls, execute each tool and feed results back.
3. Repeat until the LLM produces a final response (no tool calls) or `maxIterations` is reached.
4. Parse the final response into a structured object using `generateObject()`.

---

## Tool Architecture

```
Agent node (or direct use)
  │
  Calls tool node handler
  │
  ▼
Tool node (e.g., filesystemNode)
  │
  1. Validate input against schema
  2. Check permission scope
  3. Execute operation (read file, run command, etc.)
  4. Validate output
  │
  ▼
Result returned to agent / workflow
```

Tool nodes are standard `NodeDefinition` objects. What makes them "tools" is their design:

- **Granular Zod schemas** -- Each tool declares precise schemas for what it accepts and returns, making them safe to expose to LLMs.
- **Permission scopes** -- Tools like filesystem and shell accept configuration that restricts their capabilities (e.g., read-only mode, allowed directories, command allowlists).
- **Deterministic behavior** -- Tools produce predictable outputs from given inputs, which is essential for reliable agent loops.

When used with `defineAgentNode()`, tool nodes are converted to AI SDK tool definitions. The agent loop calls them via their handlers, and the results are fed back to the LLM.

---

## Data Architecture

```
Node handler
  │
  ctx.pull("postgres", { query: "SELECT ..." })
  ctx.push("redis", { key: "k", value: "v" })
  │
  ▼
Engine (DataAdaptorManager)
  │
  ▼
DataAdaptor (e.g., PostgresAdaptor)
  │
  ▼
External data store
```

Data adaptors implement the `DataAdaptor` interface:

```typescript
interface DataAdaptor {
  name: string;
  pull(params: unknown): Promise<unknown>;
  push(params: unknown): Promise<unknown>;
  healthCheck(): Promise<boolean>;
  destroy?(): Promise<void>;
}
```

The 8 built-in data nodes (PostgreSQL, Redis, MongoDB, Elasticsearch, Kafka, Pinecone, S3, HTTP) each wrap their respective client libraries and expose them through this uniform interface.
