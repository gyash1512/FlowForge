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
npm install @flowforgejs/sdk @flowforgejs/engine
```

## Hello World

```typescript
import { workflow } from '@flowforgejs/sdk';
import { Engine } from '@flowforgejs/engine';

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

| Package                     | npm                         | Description                                               |
| --------------------------- | --------------------------- | --------------------------------------------------------- |
| `@flowforgejs/sdk`          | `@flowforgejs/sdk`          | Define nodes and build workflows                          |
| `@flowforgejs/engine`       | `@flowforgejs/engine`       | Execute workflows with retry, timeout, and DAG resolution |
| `@flowforgejs/nodes`        | `@flowforgejs/nodes`        | 80+ built-in node definitions                             |
| `@flowforgejs/shared`       | `@flowforgejs/shared`       | Shared types, schemas, and utilities                      |
| `@flowforgejs/cli`          | `@flowforgejs/cli`          | Developer CLI for scaffolding and running workflows       |
| `@flowforgejs/worker`       | `@flowforgejs/worker`       | BullMQ-based distributed worker with Hono HTTP API        |
| `@flowforgejs/dashboard`    | `@flowforgejs/dashboard`    | Monitoring dashboard API server                           |
| `@flowforgejs/integrations` | `@flowforgejs/integrations` | Third-party integration service (Composio adaptor)        |
| `@flowforgejs/test-utils`   | `@flowforgejs/test-utils`   | Testing utilities for node authors                        |

---

## Next Steps

- [Quick Start](getting-started/quickstart.md) -- Build your first workflow in five minutes
- [Core Concepts](getting-started/concepts.md) -- Understand nodes, workflows, and the engine
- [Architecture](getting-started/architecture.md) -- How the pieces fit together
