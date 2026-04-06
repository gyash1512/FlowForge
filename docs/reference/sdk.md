# SDK Reference

The `@flowforge/sdk` package provides the primary API for defining nodes, agents, and workflows.

## defineNode(options)

Creates a `NodeDefinition` from the provided options.

```typescript
import { defineNode } from '@flowforge/sdk';
```

### Parameters

```typescript
interface DefineNodeInput {
  name: string; // Unique identifier (e.g. "custom/my-node")
  version: string; // Semver version
  description: string; // Human-readable description
  category: NodeCategory; // "data" | "communication" | "ai" | "control" | "transform" | "custom"

  inputSchema: z.ZodTypeAny; // Zod schema for input validation
  outputSchema: z.ZodTypeAny; // Zod schema for output validation
  configSchema: z.ZodTypeAny; // Zod schema for static configuration

  handler: (ctx: NodeContext) => Promise<unknown>; // Execution logic

  // Optional lifecycle hooks
  onInit?: (config: unknown) => Promise<void>;
  onDestroy?: () => Promise<void>;
  onError?: (error: Error, ctx: NodeContext) => Promise<void>;

  // Optional execution configuration
  retries?: number; // Default: 3
  timeout?: number; // In milliseconds, no default
  tags?: string[];
  author?: string;
  repository?: string;
}
```

### Returns

`NodeDefinition` -- a frozen object that can be used in workflows or published as a package.

### Example

```typescript
import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const myNode = defineNode({
  name: 'custom/hello',
  version: '1.0.0',
  description: 'A simple greeting node',
  category: 'custom',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ greeting: z.string() }),
  configSchema: z.object({ prefix: z.string().default('Hello') }),
  handler: async (ctx) => {
    const { name } = ctx.input as { name: string };
    const { prefix } = ctx.config as { prefix: string };
    return { greeting: `${prefix}, ${name}!` };
  },
});
```

---

## defineAgentNode(options)

Creates a `NodeDefinition` that runs an LLM tool-calling loop.

```typescript
import { defineAgentNode } from '@flowforge/sdk';
```

### Parameters

```typescript
interface AgentNodeOptions {
  name: string;
  version: string;
  description: string;
  model: string; // Default model ID (e.g. "gpt-4o")
  systemPrompt: string; // System prompt for the agent
  tools: Record<string, AgentToolDef>; // Tool definitions
  outputSchema: z.ZodTypeAny; // Schema for structured final output

  // Optional
  maxIterations?: number; // Default: 10
  temperature?: number;
  maxTokens?: number;
  tags?: string[];
  author?: string;
}

interface AgentToolDef {
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (ctx: NodeContext, input: unknown) => Promise<unknown>;
}
```

### Returns

`NodeDefinition` with:

- `category: 'ai'`
- `retries: 1`
- `timeout: 120_000`
- Tags: includes `'agent'` and `'ai'` automatically

### Behavior

1. Builds AI SDK tool definitions from the `tools` record.
2. Enters a loop calling `ctx.ai.generateText()` with tools.
3. Executes tool calls and feeds results back.
4. When the LLM stops calling tools, attempts to produce structured output via `ctx.ai.generateObject()` with the `outputSchema`.
5. If `maxIterations` is reached, produces best-effort output.

---

## workflow(id)

Creates a `WorkflowBuilder` for declaratively constructing workflow definitions.

```typescript
import { workflow } from '@flowforge/sdk';
```

### WorkflowBuilder Methods

#### .name(name: string)

Set the workflow display name.

#### .version(version: string)

Set the workflow version (default: `"1.0.0"`).

#### .description(desc: string)

Set the workflow description.

#### .trigger(trigger: TriggerDefinition)

**Required.** Set the workflow trigger.

```typescript
interface TriggerDefinition {
  type: 'event' | 'cron' | 'webhook' | 'manual' | 'sub-workflow';
  event?: string; // For type: 'event'
  cron?: string; // For type: 'cron' (cron expression)
  webhook?: {
    // For type: 'webhook'
    path: string;
    method?: string;
  };
}
```

Examples:

```typescript
.trigger({ type: 'manual' })
.trigger({ type: 'event', event: 'order.placed' })
.trigger({ type: 'cron', cron: '0 * * * *' })  // Every hour
.trigger({ type: 'webhook', webhook: { path: '/api/ingest', method: 'POST' } })
```

#### .node(stepName, nodeOrHandler, options?)

Add a node step to the workflow.

```typescript
// With a NodeDefinition
.node('step-name', myNodeDefinition, {
  config: { key: 'value' },
  input: (ctx) => ({ field: ctx.event.data }),
  when: (ctx) => ctx.event.type === 'specific-type',
  dependsOn: ['other-step'],
})

// With an inline handler
.node('step-name', (ctx) => {
  return { processed: ctx.event.data };
})
```

**NodeStepOptions:**

| Option      | Type                                                         | Description                             |
| ----------- | ------------------------------------------------------------ | --------------------------------------- |
| `config`    | `Record<string, unknown>`                                    | Static configuration passed to the node |
| `input`     | `((ctx: StepContext) => unknown) \| Record<string, unknown>` | Dynamic or static input                 |
| `when`      | `(ctx: StepContext) => boolean \| Promise<boolean>`          | Conditional execution                   |
| `dependsOn` | `string[]`                                                   | Step names this step depends on         |

#### .if(stepName, options)

Conditional branching.

```typescript
.if('check', {
  condition: (ctx) => (ctx.event.data as { active: boolean }).active,
  then: [
    ['active-step', activeNode, { config: {} }],
  ],
  else: [
    ['inactive-step', inactiveNode],
  ],
})
```

#### .parallel(stepName, options)

Fan-out parallel execution.

```typescript
.parallel('process-all', {
  items: (ctx) => (ctx.event.data as { list: unknown[] }).list,
  concurrency: 5,
  pipeline: (item) => [
    ['process', processNode, { input: () => ({ item }) }],
  ],
})
```

#### .forEach(stepName, options)

Iterate with concurrency control.

```typescript
.forEach('iterate', {
  items: (ctx) => (ctx.event.data as { records: unknown[] }).records,
  concurrency: 3,
  pipeline: (item, index) => [
    ['transform', transformNode, { input: () => ({ item, index }) }],
  ],
})
```

#### .switch(stepName, options)

Multi-way branching.

```typescript
.switch('route', {
  value: (ctx) => (ctx.event.data as { type: string }).type,
  cases: {
    'typeA': [['handle-a', nodeA]],
    'typeB': [['handle-b', nodeB]],
  },
  default: [['handle-default', defaultNode]],
})
```

#### .while(stepName, options)

Loop with guard.

```typescript
.while('poll', {
  condition: (ctx) => !(ctx.steps as { done?: boolean }).done,
  maxIterations: 50,
  pipeline: [
    ['check', checkNode, { config: {} }],
  ],
})
```

#### .timeout(ms: number)

Set workflow-level timeout in milliseconds.

#### .retry(config)

Set workflow-level retry configuration.

```typescript
.retry({
  maxAttempts: 3,
  backoff: 'exponential',   // 'fixed' | 'exponential' | 'linear'
  delayMs: 1000,
  maxDelayMs: 30_000,
})
```

#### .metadata(meta: Record\<string, unknown>)

Attach arbitrary metadata to the workflow.

#### .build()

**Required.** Finalize and return the `WorkflowDefinition`. Throws if no trigger or steps are defined.

### Complete Example

```typescript
import { workflow } from '@flowforge/sdk';
import { generateTextNode, slackNode, postgresNode } from '@flowforge/nodes';

const wf = workflow('order-notification')
  .name('Order Notification Pipeline')
  .version('2.0.0')
  .description('Process new orders and notify the team')
  .trigger({ type: 'event', event: 'order.placed' })
  .timeout(60_000)
  .retry({ maxAttempts: 3, backoff: 'exponential', delayMs: 2000 })

  .node('save-order', postgresNode, {
    config: { connectionId: 'main-db' },
    input: (ctx) => ({
      action: 'insert' as const,
      table: 'orders',
      data: ctx.event.data as Record<string, unknown>,
      returning: ['id'],
    }),
  })

  .node('generate-summary', generateTextNode, {
    config: { model: 'gpt-4o-mini', temperature: 0.3 },
    input: (ctx) => ({
      prompt: `Summarize this order for the sales team: ${JSON.stringify(ctx.event.data)}`,
    }),
    dependsOn: ['save-order'],
  })

  .node('notify-team', slackNode, {
    config: { connectionId: 'slack-bot' },
    input: (ctx) => ({
      action: 'sendMessage' as const,
      channel: '#orders',
      text: (ctx.steps as { 'generate-summary': { text: string } })['generate-summary'].text,
    }),
    dependsOn: ['generate-summary'],
  })

  .build();
```
