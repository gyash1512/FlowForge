<p align="center">
  <img src="docs/assets/banner.svg" alt="FlowForge — Code-First Workflow Engine for TypeScript" width="100%"/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/org/flowforgejs"><img src="https://img.shields.io/npm/v/@flowforgejs/sdk?label=npm&color=7c3aed" alt="npm version"/></a>
  <a href="https://github.com/gyash1512/FlowForge/actions"><img src="https://github.com/gyash1512/FlowForge/actions/workflows/ci.yml/badge.svg" alt="CI"/></a>
  <a href="https://gyash1512.github.io/FlowForge/"><img src="https://img.shields.io/badge/docs-live-blue" alt="Docs"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License"/></a>
</p>

---

## What is FlowForge?

FlowForge is a **TypeScript-native workflow engine** for building, executing, and monitoring workflows entirely in code. Define type-safe nodes with Zod schemas, compose them into DAG-based workflows, and run them with built-in retry, timeout, checkpointing, and observability.

---

## Key Features

**Type-Safe by Design** -- Every node defines its input, output, and config schemas with Zod. Validated at runtime, inferred at compile time.

**80+ Built-in Nodes** -- Data, AI, communication, control flow, transforms, and agentic tools.

**38+ Integrations** -- Backed by Composio (MIT, self-hostable).

**9 Agentic Tools** -- Filesystem, shell, code interpreter, web search, web scrape, git, browser, document parser, math -- all with built-in safety controls.

**AI-Native Agent System** -- Agent loop with tool calling, MCP client, any node becomes a tool via `nodeAsAgentTool()`.

**Human-in-the-Loop** -- Approval gates with checkpoint recovery, auto-approve for dev, auto-reject for CI.

**Production-Ready** -- BullMQ worker, Hono HTTP API, Drizzle/Postgres, OpenTelemetry, cron, circuit breakers.

---

## Packages

| Package                     | Description                                                               |
| --------------------------- | ------------------------------------------------------------------------- |
| `@flowforgejs/sdk`          | Workflow DSL -- `defineNode()`, `defineAgentNode()`, `workflow()` builder |
| `@flowforgejs/engine`       | Execution engine with DAG scheduling, retry, event bus, AI provider       |
| `@flowforgejs/nodes`        | 80+ built-in nodes                                                        |
| `@flowforgejs/shared`       | Shared types, errors, schemas                                             |
| `@flowforgejs/cli`          | Developer CLI                                                             |
| `@flowforgejs/worker`       | BullMQ worker with Hono HTTP API                                          |
| `@flowforgejs/dashboard`    | Monitoring API                                                            |
| `@flowforgejs/integrations` | Composio-backed integration service                                       |
| `@flowforgejs/test-utils`   | Testing utilities                                                         |

---

## License

[MIT](LICENSE)
