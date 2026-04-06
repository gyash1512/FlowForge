---
hide:
  - navigation
---

# FlowForge

**Code-first workflow engine for TypeScript.**

FlowForge lets you define, execute, and monitor workflows entirely in TypeScript. Every node has Zod-validated inputs and outputs, every workflow is a plain object you can test and version-control, and the engine handles retries, timeouts, DAG resolution, and control flow for you.

---

## Key Features

**Type-safe by default** -- Every node declares Zod schemas for input, output, and config. The engine validates data at every boundary.

**80+ built-in nodes** -- 46 communication integrations (Slack, GitHub, Jira, Salesforce, and more), 8 data connectors, 5 AI nodes, 9 control flow primitives, 4 transform utilities, and 9 agentic tool nodes.

**AI-native** -- First-class support for LLM text generation, structured output, embeddings, agents with tool-calling loops, and MCP client connectivity. Built on the Vercel AI SDK.

**Agentic tools with safety controls** -- Filesystem, shell, code interpreter, browser, git, web search, web scrape, document parser, and math nodes. All gated by configurable permission scopes.

**Human-in-the-loop** -- Pause any workflow to await human approval before proceeding with sensitive operations.

**46 Composio-backed integrations** -- Connect to third-party services through a unified `ctx.integrate()` interface backed by Composio adaptors.

**Control flow primitives** -- `if`, `switch`, `forEach`, `parallel`, `while`, `delay`, `sub-workflow`, and `wait-for-event` -- all composable inside the builder API.

---

## Quick Install

```bash
npm install @flowforge/sdk @flowforge/engine
```

## Hello World

```typescript
import { workflow } from '@flowforge/sdk';
import { Engine } from '@flowforge/engine';

const wf = workflow('hello')
  .trigger({ type: 'manual' })
  .node('greet', async () => ({ message: 'Hello, FlowForge!' }))
  .build();

const engine = new Engine();
engine.register(wf);
const run = await engine.trigger('hello');
console.log(run.output); // { message: "Hello, FlowForge!" }
```

---

## Packages

| Package                   | npm                       | Description                                               |
| ------------------------- | ------------------------- | --------------------------------------------------------- |
| `@flowforge/sdk`          | `@flowforge/sdk`          | Define nodes and build workflows                          |
| `@flowforge/engine`       | `@flowforge/engine`       | Execute workflows with retry, timeout, and DAG resolution |
| `@flowforge/nodes`        | `@flowforge/nodes`        | 80+ built-in node definitions                             |
| `@flowforge/shared`       | `@flowforge/shared`       | Shared types, schemas, and utilities                      |
| `@flowforge/cli`          | `@flowforge/cli`          | Developer CLI for scaffolding and running workflows       |
| `@flowforge/worker`       | `@flowforge/worker`       | BullMQ-based distributed worker with Hono HTTP API        |
| `@flowforge/dashboard`    | `@flowforge/dashboard`    | Monitoring dashboard API server                           |
| `@flowforge/integrations` | `@flowforge/integrations` | Third-party integration service (Composio adaptor)        |
| `@flowforge/test-utils`   | `@flowforge/test-utils`   | Testing utilities for node authors                        |

---

## Next Steps

- [Quick Start](getting-started/quickstart.md) -- Build your first workflow in five minutes
- [Core Concepts](getting-started/concepts.md) -- Understand nodes, workflows, and the engine
- [Architecture](getting-started/architecture.md) -- How the pieces fit together
