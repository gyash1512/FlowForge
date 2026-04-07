# Engine Reference

The `@flowforgejs/engine` package provides the runtime for registering workflows, executing them, managing data and integration adaptors, and AI provider configuration.

## Engine

The central orchestrator. Register workflows and trigger them.

```typescript
import { Engine } from '@flowforgejs/engine';

const engine = new Engine({ logger, ai });
```

### Constructor

```typescript
interface EngineOptions {
  logger?: Logger; // Pino-compatible logger (defaults to ConsoleLogger)
  ai?: AIContext; // AI provider (defaults to noop)
}
```

### Methods

#### register(workflow: WorkflowDefinition): void

Register a workflow definition. If the workflow has an event trigger, the engine automatically subscribes to that event.

```typescript
engine.register(myWorkflow);
```

#### unregister(workflowId: string): void

Remove a workflow registration.

#### getWorkflow(workflowId: string): WorkflowDefinition | undefined

Retrieve a registered workflow by ID.

#### listWorkflows(): WorkflowDefinition[]

List all registered workflows.

#### trigger(workflowId: string, input?: unknown): Promise\<RunRecord>

Execute a workflow with optional input data. Returns a `RunRecord` with the run status and output.

```typescript
const run = await engine.trigger('my-workflow', { key: 'value' });
console.log(run.status); // 'completed' | 'failed'
console.log(run.output); // Output from the last step
```

#### emit(event: string, payload?: unknown): Promise\<RunRecord[]>

Emit an event. All workflows with a matching event trigger will execute. Returns an array of `RunRecord` results.

```typescript
const runs = await engine.emit('order.placed', { orderId: '123' });
```

#### getRun(runId: string): RunRecord | undefined

Retrieve a run record by ID.

#### listRuns(workflowId?: string): RunRecord[]

List all runs, optionally filtered by workflow ID.

#### cancelRun(runId: string): void

Cancel a running workflow.

#### destroy(): Promise\<void>

Shut down the engine, destroying all data and integration adaptors and clearing the event bus.

### Properties

#### engine.data: DataAdaptorManager

Access the data adaptor manager for registering and querying data sources.

#### engine.integrations: IntegrationManager

Access the integration manager for registering and querying service integrations.

#### engine.bus: EventBus

Access the underlying event bus.

### Convenience Methods

#### registerAdaptor(adaptor: DataAdaptor): void

Shorthand for `engine.data.register(adaptor)`.

#### registerIntegration(adaptor: IntegrationAdaptor): void

Shorthand for `engine.integrations.register(adaptor)`.

---

## Runner

The `Runner` handles step-by-step execution of a workflow. It is used internally by the `Engine` but can be instantiated directly for testing or custom execution environments.

```typescript
import { Runner } from '@flowforgejs/engine';

const runner = new Runner({
  logger,
  providers: {
    pull: (source, params) => dataManager.pull(source, params),
    push: (target, params) => dataManager.push(target, params),
    integrate: (name, action, params) => integrationManager.execute(name, action, params),
    ai: aiContext,
  },
});
```

### RuntimeProviders

```typescript
interface RuntimeProviders {
  pull?: (source: string, params: unknown) => Promise<unknown>;
  push?: (target: string, params: unknown) => Promise<unknown>;
  integrate?: (name: string, action: string, params: unknown) => Promise<unknown>;
  ai?: AIContext;
}
```

### execute(workflow, input): Promise\<RunRecord>

Executes a workflow definition with the given input. Handles:

- **Topological sorting** of steps with dependencies.
- **Schema validation** of inputs, configs, and outputs.
- **Retry** with configurable backoff (fixed, linear, exponential).
- **Timeout** at both step and workflow level.
- **Control flow** execution (if, parallel, forEach, switch, while).
- **Abort propagation** via AbortController.

---

## AIProvider

### createAIProvider(sdk)

Creates an `AIContext` from explicit AI SDK function references. No dynamic imports.

```typescript
import { createAIProvider } from '@flowforgejs/engine';
import { generateText, streamText, generateObject, embed } from 'ai';

const ai = createAIProvider({ generateText, streamText, generateObject, embed });

const engine = new Engine({ ai });
```

### createNoopAIProvider()

Returns an `AIContext` where all methods return empty results. Used as the default when no AI provider is configured.

### AISDKFunctions Interface

```typescript
interface AISDKFunctions {
  generateText: (params: AIRequestParams) => Promise<AITextResponse>;
  streamText: (params: AIRequestParams) => Promise<AIStreamResponse>;
  generateObject: (params: AIObjectParams) => Promise<AIObjectResponse>;
  embed: (params: AIEmbedParams) => Promise<AIEmbedResponse>;
}
```

---

## ModelRegistry

Manages AI model provider registrations. Accessible via engine (or instantiate directly).

```typescript
import { ModelRegistry } from '@flowforgejs/engine';

const registry = new ModelRegistry();
```

### register(provider: ModelProvider): void

Register a model provider.

```typescript
interface ModelProvider {
  name: string; // e.g. "openai", "anthropic"
  models: string[]; // Known model IDs
  createModel(modelId: string): unknown; // Factory function
}
```

```typescript
import { openai } from '@ai-sdk/openai';

registry.register({
  name: 'openai',
  models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
  createModel: (id) => openai(id),
});
```

### resolve(modelString: string): { provider: ModelProvider; model: unknown }

Resolve a `"provider/model"` string to a provider and model object.

```typescript
const { provider, model } = registry.resolve('openai/gpt-4o');
// provider.name === 'openai'
// model is the result of openai('gpt-4o')
```

Throws if the provider is not registered or the string format is invalid.

### list(): Array\<{ provider: string; models: string[] }>

List all registered providers and their models.

### get(providerName: string): ModelProvider | undefined

Get a provider by name.

### unregister(providerName: string): boolean

Remove a provider registration.

---

## nodeAsAgentTool

Convert a `NodeDefinition` into an `AgentToolDef` for use in agent nodes.

```typescript
import { nodeAsAgentTool } from '@flowforgejs/engine';

const tool = nodeAsAgentTool(myNode);
// tool.description === myNode.description
// tool.inputSchema === myNode.inputSchema
// tool.handler wraps myNode.handler
```

## nodesToAgentTools

Convert multiple nodes at once.

```typescript
import { nodesToAgentTools } from '@flowforgejs/engine';

const tools = nodesToAgentTools({
  search: searchNode,
  database: postgresNode,
});
```

Returns `Record<string, AgentToolDef>` suitable for `defineAgentNode({ tools })`.

---

## AdaptorManager

### DataAdaptorManager

Manages data adaptors for `ctx.pull()` / `ctx.push()`.

| Method                           | Description                               |
| -------------------------------- | ----------------------------------------- |
| `register(adaptor: DataAdaptor)` | Register a data adaptor                   |
| `unregister(name: string)`       | Remove a data adaptor                     |
| `get(name: string)`              | Get adaptor by name                       |
| `list()`                         | List registered adaptor names             |
| `pull(source, params)`           | Route a pull request to the named adaptor |
| `push(target, params)`           | Route a push request to the named adaptor |
| `healthCheckAll()`               | Check health of all adaptors              |
| `destroyAll()`                   | Destroy all adaptors (cleanup)            |

### IntegrationManager

Manages integration adaptors for `ctx.integrate()`.

| Method                                  | Description                       |
| --------------------------------------- | --------------------------------- |
| `register(adaptor: IntegrationAdaptor)` | Register an integration adaptor   |
| `unregister(name: string)`              | Remove an integration adaptor     |
| `list()`                                | List registered integration names |
| `execute(name, action, params)`         | Execute an integration action     |
| `destroyAll()`                          | Destroy all adaptors (cleanup)    |

The `execute` method validates that the named adaptor exists and that the requested action is in the adaptor's `actions` list before delegating.

---

## Retry

### withRetry(fn, config, ctx)

Execute a function with retry logic.

```typescript
import { withRetry } from '@flowforgejs/engine';

const result = await withRetry(
  (attempt) => fetchData(attempt),
  {
    maxAttempts: 3,
    backoff: 'exponential',
    delayMs: 1000,
    maxDelayMs: 10_000,
  },
  {
    nodeId: 'my-node',
    signal: abortController.signal,
    onRetry: (attempt, error, delayMs) => {
      console.log(`Retry ${attempt}, waiting ${delayMs}ms: ${error.message}`);
    },
  },
);
```

### computeDelay(config, attempt)

Calculate the delay for a given attempt number:

- **fixed**: `delayMs` every time.
- **linear**: `delayMs * attempt`.
- **exponential**: `delayMs * 2^(attempt-1)`.

Capped by `maxDelayMs` if set.
