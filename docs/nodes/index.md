# Nodes

Nodes are the fundamental building blocks of FlowForge workflows. Each node encapsulates a discrete unit of work -- reading from a database, calling an API, transforming data, or invoking an LLM -- and exposes a typed contract of inputs, outputs, and configuration.

## What is a Node?

A node is defined by the `NodeDefinition` interface from `@flowforgejs/shared`:

```typescript
interface NodeDefinition {
  name: string; // Unique identifier, e.g. "ai/generate-text"
  version: string; // Semver version
  description: string; // Human-readable description
  category: NodeCategory; // One of: data, communication, ai, control, transform, custom

  inputSchema: z.ZodTypeAny; // Zod schema for input validation
  outputSchema: z.ZodTypeAny; // Zod schema for output validation
  configSchema: z.ZodTypeAny; // Zod schema for static configuration

  handler: (ctx: NodeContext) => Promise<unknown>; // Execution logic

  // Lifecycle hooks (optional)
  onInit?: (config: unknown) => Promise<void>;
  onDestroy?: () => Promise<void>;
  onError?: (error: Error, ctx: NodeContext) => Promise<void>;

  // Execution options (optional)
  retries?: number;
  timeout?: number;
  tags?: string[];
  author?: string;
  repository?: string;
}
```

Every node receives a `NodeContext` at runtime, which provides access to data sources, integrations, AI capabilities, event operations, and workflow metadata.

## Node Categories

FlowForge ships with **50+ built-in nodes** organized into the following categories:

| Category                              | Description                             | Count | Examples                                       |
| ------------------------------------- | --------------------------------------- | ----- | ---------------------------------------------- |
| **[AI](ai.md)**                       | LLM generation, embeddings, agents, MCP | 5     | `generate-text`, `agent`, `mcp-client`         |
| **[Data](data.md)**                   | Database and storage connectors         | 9     | `postgres`, `redis`, `s3`, `http`              |
| **[Communication](communication.md)** | Third-party service integrations        | 47    | `slack`, `github`, `stripe`, `notion`          |
| **[Control](control.md)**             | Flow control and orchestration          | 9     | `if`, `parallel`, `forEach`, `human-approval`  |
| **[Transform](transform.md)**         | Data transformation primitives          | 4     | `map`, `filter`, `reduce`, `template`          |
| **Tools**                             | System-level utilities                  | 10    | `filesystem`, `shell`, `browser`, `web-search` |
| **Log**                               | Logging and observability               | 1     | `console`                                      |

## Using Nodes in Workflows

Nodes are used as steps inside workflows. You can reference built-in nodes or custom ones:

```typescript
import { workflow } from '@flowforgejs/sdk';
import { generateTextNode } from '@flowforgejs/nodes';

const myWorkflow = workflow('summarize')
  .name('Summarize Document')
  .trigger({ type: 'event', event: 'document.uploaded' })
  .node('summarize', generateTextNode, {
    config: { model: 'gpt-4o', temperature: 0.3 },
    input: (ctx) => ({
      prompt: `Summarize: ${(ctx.event.data as { text: string }).text}`,
    }),
  })
  .build();
```

You can also use inline functions as steps without defining a full node:

```typescript
const wf = workflow('quick')
  .trigger({ type: 'manual' })
  .node('process', (ctx) => {
    return { processed: true, input: ctx.event.data };
  })
  .build();
```

## Creating Custom Nodes

Use `defineNode()` from `@flowforgejs/sdk` to create reusable nodes:

```typescript
import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

export const myNode = defineNode({
  name: 'custom/my-node',
  version: '1.0.0',
  description: 'A custom node that does something useful',
  category: 'custom',
  inputSchema: z.object({
    message: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
    processedAt: z.string(),
  }),
  configSchema: z.object({
    uppercase: z.boolean().default(false),
  }),
  handler: async (ctx) => {
    const { message } = ctx.input as { message: string };
    const { uppercase } = ctx.config as { uppercase: boolean };
    return {
      result: uppercase ? message.toUpperCase() : message,
      processedAt: new Date().toISOString(),
    };
  },
});
```

!!! tip "Publishing nodes"
Custom nodes are plain TypeScript objects that conform to `NodeDefinition`. You can publish them as npm packages and import them in any FlowForge project. See the [Custom Nodes Guide](../guides/custom-nodes.md) for details.

## NodeContext

Every node handler receives a `NodeContext` object with these capabilities:

| Property/Method                       | Description                                                             |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `ctx.input`                           | Validated input data                                                    |
| `ctx.config`                          | Validated static configuration                                          |
| `ctx.event`                           | The workflow trigger event                                              |
| `ctx.steps`                           | Outputs from previous steps (keyed by step name)                        |
| `ctx.logger`                          | Pino-compatible logger                                                  |
| `ctx.ai`                              | AI operations (`generateText`, `generateObject`, `embed`, `streamText`) |
| `ctx.pull(source, params)`            | Read from a registered data adaptor                                     |
| `ctx.push(target, params)`            | Write to a registered data adaptor                                      |
| `ctx.integrate(name, action, params)` | Call a registered integration                                           |
| `ctx.emit(event, data)`               | Emit an event for downstream workflows                                  |
| `ctx.wait(event, match?, timeout?)`   | Pause and wait for an event                                             |
| `ctx.sleep(ms)`                       | Pause execution for a duration                                          |
| `ctx.checkpoint()`                    | Save state for durable execution                                        |
| `ctx.metadata`                        | Run metadata (runId, workflowId, attempt, etc.)                         |
| `ctx.signal`                          | AbortSignal for cancellation                                            |
