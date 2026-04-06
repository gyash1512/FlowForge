# Building Agents

FlowForge provides first-class support for LLM-powered agents that reason, plan, and act by calling tools in a loop. This guide covers the built-in agent node, custom agent creation, node-to-tool conversion, MCP integration, and the agent + human-approval pattern.

## What Are Agents in FlowForge?

An agent in FlowForge is a workflow node that runs an iterative LLM loop:

1. Send a prompt (plus context) to an LLM.
2. If the LLM requests tool calls, execute them.
3. Feed tool results back to the LLM.
4. Repeat until the LLM produces a final response or `maxIterations` is reached.

Agents are nodes, not a separate primitive. They compose with the rest of the workflow system -- you can chain agents with data nodes, control flow, and other agents.

## Using the Built-in Agent Node

The simplest way to add an agent to a workflow:

```typescript
import { agentNode } from '@flowforge/nodes';
import { workflow } from '@flowforge/sdk';

const wf = workflow('customer-support')
  .trigger({ type: 'event', event: 'ticket.created' })
  .node('triage', agentNode, {
    config: {
      model: 'gpt-4o',
      systemPrompt: `You are a support triage agent. Classify tickets by priority 
        and suggest an initial response. Use the available tools to look up 
        customer history and knowledge base articles.`,
      maxIterations: 10,
      temperature: 0.3,
    },
    input: (ctx) => ({
      prompt: `Triage this support ticket: ${JSON.stringify(ctx.event.data)}`,
      tools: [
        {
          name: 'search-kb',
          description: 'Search the knowledge base for relevant articles',
          parameters: { query: 'string' },
        },
        {
          name: 'get-customer',
          description: 'Look up customer information by email',
          parameters: { email: 'string' },
        },
      ],
    }),
  })
  .build();
```

## defineAgentNode() for Custom Agents

For agents with typed tools and structured output, use `defineAgentNode()`:

```typescript
import { z } from 'zod';
import { defineAgentNode } from '@flowforge/sdk';

const researchAgent = defineAgentNode({
  name: 'custom/research-agent',
  version: '1.0.0',
  description: 'Research a topic using web search and page reading',
  model: 'gpt-4o',
  systemPrompt: `You are a thorough research assistant. Search for information,
    read relevant pages, and produce a comprehensive summary with sources.`,
  maxIterations: 20,
  temperature: 0.2,

  outputSchema: z.object({
    summary: z.string(),
    keyFindings: z.array(z.string()),
    sources: z.array(
      z.object({
        url: z.string(),
        title: z.string(),
        relevance: z.number(),
      }),
    ),
  }),

  tools: {
    search: {
      description: 'Search the web for a query',
      inputSchema: z.object({ query: z.string() }),
      handler: async (ctx, input) => {
        // Use ctx.integrate or ctx.pull for actual search
        return { results: [] };
      },
    },
    readPage: {
      description: 'Extract text content from a URL',
      inputSchema: z.object({ url: z.string().url() }),
      handler: async (ctx, input) => {
        return { content: '', title: '' };
      },
    },
    saveNote: {
      description: 'Save a research note for later reference',
      inputSchema: z.object({ topic: z.string(), note: z.string() }),
      handler: async (ctx, input) => {
        ctx.logger.info({ topic: (input as { topic: string }).topic }, 'Note saved');
        return { saved: true };
      },
    },
  },
});
```

### How defineAgentNode() Works

Under the hood, `defineAgentNode()` creates a standard `NodeDefinition` with a handler that:

1. Converts the `tools` record into Vercel AI SDK tool definitions.
2. Enters a loop: calls `ctx.ai.generateText()` with the tools and prompt.
3. On each iteration, if the LLM makes tool calls, executes them via the tool handlers.
4. When the LLM stops calling tools, attempts to parse the final text into the `outputSchema` using `ctx.ai.generateObject()`.
5. If `maxIterations` is exceeded, produces a best-effort structured output.

## Converting Nodes to Tools

Any existing `NodeDefinition` can be exposed as an agent tool. This is the core composability feature of FlowForge.

### nodeAsAgentTool()

Converts a single node:

```typescript
import { nodeAsAgentTool } from '@flowforge/engine';
import { postgresNode } from '@flowforge/nodes';

const dbTool = nodeAsAgentTool(postgresNode);
// dbTool.description = "Execute queries and mutations against a PostgreSQL database"
// dbTool.inputSchema = postgresNode.inputSchema
// dbTool.handler calls postgresNode.handler with the agent's context
```

### nodesToAgentTools()

Converts multiple nodes at once:

```typescript
import { nodesToAgentTools } from '@flowforge/engine';
import { httpNode, postgresNode, redisNode } from '@flowforge/nodes';
import { defineAgentNode } from '@flowforge/sdk';

const tools = nodesToAgentTools({
  'http-request': httpNode,
  'query-database': postgresNode,
  'cache-lookup': redisNode,
});

const dataAgent = defineAgentNode({
  name: 'custom/data-agent',
  version: '1.0.0',
  description: 'An agent that can query databases, call APIs, and manage caches',
  model: 'gpt-4o',
  systemPrompt: 'You are a data operations agent.',
  tools,
  outputSchema: z.object({ result: z.unknown() }),
});
```

The converted tools preserve:

- **description** -- used by the LLM to decide when to call the tool.
- **inputSchema** -- used by the LLM to generate valid parameters.
- **handler** -- the actual node execution logic.

## MCP Integration for External Tools

Use the `mcp-client` node to connect agents to external MCP servers, providing access to tools outside the FlowForge ecosystem:

```typescript
import { mcpClientNode, agentNode } from '@flowforge/nodes';

const wf = workflow('mcp-agent')
  .trigger({ type: 'manual' })
  // First, discover available tools
  .node('discover-tools', mcpClientNode, {
    config: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
    },
    input: () => ({ action: 'listTools' as const }),
  })
  // Then use the agent with those tools
  .node('agent', agentNode, {
    config: {
      model: 'gpt-4o',
      systemPrompt: 'You can read and write files in /workspace.',
      maxIterations: 15,
    },
    input: (ctx) => ({
      prompt: 'Organize the files in /workspace by type',
      tools: (
        ctx.steps as {
          'discover-tools': { tools: Array<{ name: string; description: string }> };
        }
      )['discover-tools'].tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: {},
      })),
    }),
  })
  .build();
```

## Agent + Human-Approval Pattern

For agents that perform high-stakes actions, combine them with the `human-approval` node:

```typescript
import { agentNode, humanApprovalNode, slackNode } from '@flowforge/nodes';

const wf = workflow('safe-deploy-agent')
  .trigger({ type: 'event', event: 'deploy.requested' })

  // Agent plans the deployment
  .node('plan', agentNode, {
    config: {
      model: 'gpt-4o',
      systemPrompt: 'Plan the deployment. List what will change and any risks.',
      maxIterations: 10,
    },
    input: (ctx) => ({
      prompt: `Plan deployment for: ${JSON.stringify(ctx.event.data)}`,
    }),
  })

  // Human reviews and approves
  .node('approve', humanApprovalNode, {
    config: {
      defaultTimeout: 1_800_000,
      autoApprove: process.env.NODE_ENV === 'development',
    },
    input: (ctx) => ({
      action: 'Execute deployment plan',
      details: (ctx.steps as { plan: unknown }).plan,
      urgency: 'high' as const,
    }),
  })

  // Only proceed if approved
  .if('check-approval', {
    condition: (ctx) => (ctx.steps as { approve: { approved: boolean } }).approve.approved,
    then: [
      [
        'execute',
        agentNode,
        {
          config: { model: 'gpt-4o', systemPrompt: 'Execute the deployment.', maxIterations: 20 },
          input: (ctx) => ({
            prompt: `Execute this plan: ${JSON.stringify((ctx.steps as { plan: unknown }).plan)}`,
          }),
        },
      ],
      [
        'notify-success',
        slackNode,
        {
          config: { connectionId: 'slack-bot' },
          input: () => ({
            action: 'sendMessage' as const,
            channel: '#deploys',
            text: 'Deployment completed successfully.',
          }),
        },
      ],
    ],
    else: [
      [
        'notify-rejected',
        slackNode,
        {
          config: { connectionId: 'slack-bot' },
          input: () => ({
            action: 'sendMessage' as const,
            channel: '#deploys',
            text: 'Deployment was rejected by reviewer.',
          }),
        },
      ],
    ],
  })
  .build();
```

!!! tip "Auto-approve in dev, auto-reject in CI"
Set `autoApprove: true` during development so agents run uninterrupted. Set `autoReject: true` in CI to ensure agents never block automated pipelines.

## Example: Research Agent with Web Search + Filesystem

A complete example combining multiple tool types:

```typescript
import { z } from 'zod';
import { defineAgentNode } from '@flowforge/sdk';
import { nodesToAgentTools } from '@flowforge/engine';
import { httpNode } from '@flowforge/nodes';

const researchAgent = defineAgentNode({
  name: 'custom/full-research-agent',
  version: '1.0.0',
  description: 'Research agent with web search and file output',
  model: 'gpt-4o',
  systemPrompt: `You are a research assistant. Use web-search to find information,
    then use save-report to write your findings to a file. Be thorough and cite sources.`,
  maxIterations: 25,
  temperature: 0.1,

  outputSchema: z.object({
    topic: z.string(),
    summary: z.string(),
    sources: z.array(z.string()),
    reportPath: z.string(),
  }),

  tools: {
    'web-search': {
      description: 'Search the web and return results',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
        maxResults: z.number().default(5),
      }),
      handler: async (ctx, input) => {
        const { query } = input as { query: string };
        const result = await ctx.pull('http', {
          method: 'GET',
          url: `https://api.search.example/search?q=${encodeURIComponent(query)}`,
        });
        return result;
      },
    },
    'read-url': {
      description: 'Fetch and extract text from a URL',
      inputSchema: z.object({ url: z.string().url() }),
      handler: async (ctx, input) => {
        const { url } = input as { url: string };
        const result = await ctx.pull('http', { method: 'GET', url });
        return result;
      },
    },
    'save-report': {
      description: 'Save the research report to a file',
      inputSchema: z.object({
        filename: z.string(),
        content: z.string(),
      }),
      handler: async (ctx, input) => {
        const { filename, content } = input as { filename: string; content: string };
        ctx.logger.info({ filename }, 'Saving research report');
        await ctx.push('filesystem', { path: `/reports/${filename}`, content });
        return { saved: true, path: `/reports/${filename}` };
      },
    },
  },
});
```

!!! warning "Agent timeouts"
Agent nodes default to a 120-second timeout. For research-heavy agents that make many tool calls, increase this in the node config or at the workflow level.
