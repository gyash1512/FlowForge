# AI Nodes

FlowForge provides five AI nodes for LLM text generation, structured output, embeddings, autonomous agents, and Model Context Protocol (MCP) integration. All AI nodes use the Vercel AI SDK under the hood through the `ctx.ai` interface.

## generate-text

Generate text using any LLM supported by the Vercel AI SDK.

**Input:**

| Field      | Type                     | Required               | Description              |
| ---------- | ------------------------ | ---------------------- | ------------------------ |
| `prompt`   | `string`                 | One of prompt/messages | Simple text prompt       |
| `messages` | `Array<{role, content}>` | One of prompt/messages | Chat-style message array |
| `system`   | `string`                 | No                     | System prompt            |

**Config:**

| Field         | Type     | Default  | Description                                                  |
| ------------- | -------- | -------- | ------------------------------------------------------------ |
| `model`       | `string` | `gpt-4o` | Model identifier (e.g. `anthropic/claude-sonnet-4-20250514`) |
| `maxTokens`   | `number` | --       | Maximum tokens to generate                                   |
| `temperature` | `number` | --       | Sampling temperature (0-2)                                   |

**Output:** `{ text: string, usage?: { promptTokens, completionTokens }, finishReason?: string }`

```typescript
import { generateTextNode } from '@flowforgejs/nodes';

workflow('generate')
  .trigger({ type: 'manual' })
  .node('write-poem', generateTextNode, {
    config: { model: 'gpt-4o', temperature: 0.9 },
    input: () => ({
      prompt: 'Write a haiku about distributed systems',
      system: 'You are a poet who understands technology deeply.',
    }),
  })
  .build();
```

---

## generate-object

Generate structured JSON output from an LLM. The output conforms to a schema you provide.

**Input:**

| Field      | Type                      | Required               | Description                              |
| ---------- | ------------------------- | ---------------------- | ---------------------------------------- |
| `prompt`   | `string`                  | One of prompt/messages | Text prompt                              |
| `messages` | `Array<{role, content}>`  | One of prompt/messages | Chat messages                            |
| `system`   | `string`                  | No                     | System prompt                            |
| `schema`   | `Record<string, unknown>` | Yes                    | JSON description of desired output shape |

**Config:** Same as `generate-text` (`model`, `maxTokens`, `temperature`).

**Output:** `{ object: unknown, usage?: { promptTokens, completionTokens } }`

```typescript
import { generateObjectNode } from '@flowforgejs/nodes';

workflow('extract-entities')
  .trigger({ type: 'event', event: 'text.received' })
  .node('extract', generateObjectNode, {
    config: { model: 'gpt-4o' },
    input: (ctx) => ({
      prompt: `Extract entities from: ${(ctx.event.data as { text: string }).text}`,
      schema: {
        people: 'array of person names',
        organizations: 'array of org names',
        locations: 'array of location names',
      },
    }),
  })
  .build();
```

---

## embed

Generate vector embeddings for text, suitable for semantic search and RAG pipelines.

**Input:**

| Field   | Type     | Required | Description   |
| ------- | -------- | -------- | ------------- |
| `value` | `string` | Yes      | Text to embed |

**Config:**

| Field   | Type     | Default                  | Description                |
| ------- | -------- | ------------------------ | -------------------------- |
| `model` | `string` | `text-embedding-3-small` | Embedding model identifier |

**Output:** `{ embedding: number[], usage?: { tokens: number } }`

```typescript
import { embedNode } from '@flowforgejs/nodes';

workflow('index-document')
  .trigger({ type: 'event', event: 'document.created' })
  .node('embed', embedNode, {
    config: { model: 'text-embedding-3-small' },
    input: (ctx) => ({
      value: (ctx.event.data as { content: string }).content,
    }),
  })
  .build();
```

---

## agent

Run a configurable agent loop with tool calling and iterative reasoning. The agent repeatedly calls an LLM, executing any tool calls until the LLM produces a final text response or the iteration limit is reached.

**Input:**

| Field     | Type                                     | Required | Description             |
| --------- | ---------------------------------------- | -------- | ----------------------- |
| `prompt`  | `string`                                 | Yes      | The task for the agent  |
| `tools`   | `Array<{name, description, parameters}>` | No       | Tool definitions        |
| `context` | `unknown`                                | No       | Additional context data |

**Config:**

| Field           | Type     | Default                    | Description                             |
| --------------- | -------- | -------------------------- | --------------------------------------- |
| `model`         | `string` | `gpt-4o`                   | Model identifier                        |
| `systemPrompt`  | `string` | `You are a helpful agent.` | System prompt                           |
| `maxIterations` | `number` | `10`                       | Max tool-calling loop iterations (1-50) |
| `maxTokens`     | `number` | --                         | Max tokens per LLM call                 |
| `temperature`   | `number` | --                         | Sampling temperature                    |

**Output:** `{ result: unknown, toolsUsed: string[], iterations: number, text: string }`

```typescript
import { agentNode } from '@flowforgejs/nodes';

workflow('research-agent')
  .trigger({ type: 'manual' })
  .node('research', agentNode, {
    config: {
      model: 'gpt-4o',
      systemPrompt: 'You are a research assistant. Use tools to find information.',
      maxIterations: 15,
    },
    input: () => ({
      prompt: 'Find the latest quarterly revenue for Acme Corp',
      tools: [
        {
          name: 'web-search',
          description: 'Search the web for information',
          parameters: { query: 'string' },
        },
      ],
    }),
  })
  .build();
```

!!! note "Timeout"
The agent node has a default timeout of 120 seconds and retries set to 1, since agent loops can be long-running.

---

## mcp-client

Connect to an MCP (Model Context Protocol) server and interact with its tools and resources. Supports three transport modes: `stdio`, `sse`, and `streamable-http`.

**Input:**

| Field         | Type                                                             | Required           | Description            |
| ------------- | ---------------------------------------------------------------- | ------------------ | ---------------------- |
| `action`      | `'listTools' \| 'callTool' \| 'listResources' \| 'readResource'` | Yes                | MCP action             |
| `toolName`    | `string`                                                         | For `callTool`     | Tool to invoke         |
| `toolArgs`    | `Record<string, unknown>`                                        | No                 | Arguments for the tool |
| `resourceUri` | `string`                                                         | For `readResource` | URI of the resource    |

**Config:**

| Field       | Type                                    | Default | Description                                  |
| ----------- | --------------------------------------- | ------- | -------------------------------------------- |
| `transport` | `'stdio' \| 'sse' \| 'streamable-http'` | `stdio` | Transport protocol                           |
| `command`   | `string`                                | --      | Command for stdio transport                  |
| `args`      | `string[]`                              | --      | Arguments for stdio transport                |
| `url`       | `string`                                | --      | URL for SSE/HTTP transport                   |
| `env`       | `Record<string, string>`                | --      | Environment variables for the server process |

**Output:** `{ result: unknown, tools?: Array<{name, description}>, resources?: Array<{uri, name}> }`

=== "stdio transport"

    ```typescript
    import { mcpClientNode } from '@flowforgejs/nodes';

    // List tools from a local MCP server
    workflow('mcp-tools')
      .trigger({ type: 'manual' })
      .node('list-tools', mcpClientNode, {
        config: {
          transport: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp/workspace'],
        },
        input: () => ({ action: 'listTools' as const }),
      })
      .node('call-tool', mcpClientNode, {
        config: {
          transport: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp/workspace'],
        },
        input: () => ({
          action: 'callTool' as const,
          toolName: 'read_file',
          toolArgs: { path: '/tmp/workspace/readme.md' },
        }),
      })
      .build();
    ```

=== "HTTP transport"

    ```typescript
    import { mcpClientNode } from '@flowforgejs/nodes';

    workflow('mcp-remote')
      .trigger({ type: 'manual' })
      .node('list-resources', mcpClientNode, {
        config: {
          transport: 'streamable-http',
          url: 'https://mcp.example.com/rpc',
        },
        input: () => ({ action: 'listResources' as const }),
      })
      .build();
    ```

!!! tip "Connection pooling"
MCP connections are cached by transport configuration. Multiple nodes using the same server will reuse the same connection.

---

## defineAgentNode()

For building custom agent nodes with their own tool sets, use `defineAgentNode()` from `@flowforgejs/sdk`:

```typescript
import { z } from 'zod';
import { defineAgentNode } from '@flowforgejs/sdk';

const myAgent = defineAgentNode({
  name: 'custom/research-agent',
  version: '1.0.0',
  description: 'A research agent that searches and summarizes',
  model: 'gpt-4o',
  systemPrompt: 'You are a thorough research assistant.',
  maxIterations: 20,
  outputSchema: z.object({
    summary: z.string(),
    sources: z.array(z.string()),
    confidence: z.number(),
  }),
  tools: {
    search: {
      description: 'Search the web for information',
      inputSchema: z.object({ query: z.string() }),
      handler: async (ctx, input) => {
        // Your search implementation
        return { results: [] };
      },
    },
    readPage: {
      description: 'Read and extract content from a URL',
      inputSchema: z.object({ url: z.string().url() }),
      handler: async (ctx, input) => {
        // Your page reading implementation
        return { content: '' };
      },
    },
  },
});
```

The agent node runs a loop: call the LLM, execute any tool calls, repeat until the LLM stops calling tools or `maxIterations` is reached. On completion, it attempts to parse the final output into the provided `outputSchema`.

---

## Converting Nodes to Agent Tools

Any existing `NodeDefinition` can be converted into an agent tool using `nodeAsAgentTool()` or `nodesToAgentTools()` from `@flowforgejs/engine`:

```typescript
import { generateTextNode, embedNode } from '@flowforgejs/nodes';
import { nodesToAgentTools } from '@flowforgejs/engine';
import { defineAgentNode } from '@flowforgejs/sdk';

const tools = nodesToAgentTools({
  'generate-text': generateTextNode,
  embed: embedNode,
});

const agent = defineAgentNode({
  name: 'custom/composable-agent',
  version: '1.0.0',
  description: 'An agent that can use any FlowForge node as a tool',
  model: 'gpt-4o',
  systemPrompt: 'Use the available tools to complete the task.',
  tools,
  outputSchema: z.any(),
});
```

This is a key composability feature: the agent inherits the node's `description` (for LLM tool selection), `inputSchema` (for parameter generation), and `handler` (for execution).

---

## Model Registry

The engine includes a `ModelRegistry` for explicit model provider registration:

```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

// Register providers
engine.models.register({
  name: 'openai',
  models: ['gpt-4o', 'gpt-4o-mini'],
  createModel: (id) => openai(id),
});

engine.models.register({
  name: 'anthropic',
  models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414'],
  createModel: (id) => anthropic(id),
});

// Resolve a model string
const { provider, model } = engine.models.resolve('openai/gpt-4o');

// List all registered providers
const providers = engine.models.list();
// [{ provider: 'openai', models: ['gpt-4o', ...] }, ...]
```

!!! note "No auto-detection"
FlowForge does not auto-detect or dynamically import AI providers. You install the provider package and register it explicitly. This keeps the dependency graph clean and predictable.
