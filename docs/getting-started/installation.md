# Installation

## Core packages

Most projects need only the SDK and engine:

=== "pnpm"

    ```bash
    pnpm add @flowforgejs/sdk @flowforgejs/engine zod
    ```

=== "npm"

    ```bash
    npm install @flowforgejs/sdk @flowforgejs/engine zod
    ```

=== "yarn"

    ```bash
    yarn add @flowforgejs/sdk @flowforgejs/engine zod
    ```

!!! note "Zod is a peer dependency"
FlowForge uses Zod 3.x for schema validation. Install it alongside the SDK.

## Which packages to install

| Package                     | Install when you need...                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `@flowforgejs/sdk`          | Always. Provides `defineNode()`, `defineAgentNode()`, and `workflow()`.                                                                   |
| `@flowforgejs/engine`       | Always. Provides the `Engine` class that executes workflows.                                                                              |
| `@flowforgejs/nodes`        | You want the 80+ built-in nodes (AI, data, communication, tools, control flow, transforms).                                               |
| `@flowforgejs/shared`       | Rarely installed directly. Shared types are re-exported by the SDK and engine. Useful if you are writing a custom adaptor or integration. |
| `@flowforgejs/cli`          | You want the `flowforge` CLI for scaffolding, running, and managing workflows.                                                            |
| `@flowforgejs/worker`       | You need distributed execution via BullMQ with a Hono HTTP API.                                                                           |
| `@flowforgejs/dashboard`    | You want the monitoring dashboard API server.                                                                                             |
| `@flowforgejs/integrations` | You are deploying the integration service (Composio adaptor) as a standalone microservice.                                                |
| `@flowforgejs/test-utils`   | You are writing tests for custom nodes.                                                                                                   |

### Full install (all built-in nodes)

```bash
pnpm add @flowforgejs/sdk @flowforgejs/engine @flowforgejs/nodes zod
```

### AI workflows

If you plan to use AI nodes (`generate-text`, `generate-object`, `embed`, `agent`, `mcp-client`), also install the Vercel AI SDK and a model provider:

```bash
pnpm add ai @ai-sdk/openai
```

The engine accepts an `ai` option that you wire to the Vercel AI SDK. See [Building Agents](../guides/agents.md) for details.

## TypeScript configuration

FlowForge targets ES2022 with ESM modules. Your `tsconfig.json` should include at minimum:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}
```

!!! warning "Module resolution"
Use `"moduleResolution": "bundler"` or `"NodeNext"`. The `"node"` setting does not resolve ESM package exports correctly.

## Environment variables

Some built-in nodes require environment variables to function:

| Variable                                           | Required by                           | Description                                                             |
| -------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| `E2B_API_KEY`                                      | Code Interpreter tool node            | API key for the [E2B](https://e2b.dev) sandboxed code execution service |
| `OPENAI_API_KEY`                                   | AI nodes (when using OpenAI provider) | OpenAI API key for LLM operations                                       |
| `COMPOSIO_API_KEY`                                 | Communication nodes via Composio      | API key for the Composio integration platform                           |
| `RESEND_API_KEY`                                   | Email (Resend) node                   | API key for the Resend email service                                    |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Email (SMTP) node                     | SMTP server credentials                                                 |
| `SLACK_BOT_TOKEN`                                  | Slack node (direct mode)              | Slack Bot User OAuth Token                                              |
| `DISCORD_BOT_TOKEN`                                | Discord node (direct mode)            | Discord bot token                                                       |
| `TELEGRAM_BOT_TOKEN`                               | Telegram node                         | Telegram Bot API token                                                  |
| `REDIS_HOST`, `REDIS_PORT`                         | Worker package                        | Redis connection for BullMQ job queues                                  |
| `DATABASE_URL`                                     | Worker, Dashboard                     | PostgreSQL connection string                                            |

!!! tip "Use a `.env` file"
For local development, create a `.env` file in your project root. FlowForge does not load `.env` files automatically -- use a library like `dotenv` or run with a tool like `tsx` that supports env files.

## Monorepo development

If you are contributing to FlowForge itself or working within the monorepo:

```bash
git clone https://github.com/gyash1512/FlowForge.git
cd FlowForge
pnpm install
pnpm build
pnpm test
```

The monorepo uses [Turborepo](https://turbo.build) for task orchestration and [pnpm workspaces](https://pnpm.io/workspaces) for package management.
