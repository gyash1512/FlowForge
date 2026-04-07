# Shared Types Reference

All shared types are exported from `@flowforgejs/shared`. This page documents every public type, interface, and enum.

## Node Types

### NodeDefinition

The complete definition of a node.

```typescript
interface NodeDefinition {
  name: string;
  version: string;
  description: string;
  category: NodeCategory;

  inputSchema: z.ZodTypeAny;
  outputSchema: z.ZodTypeAny;
  configSchema: z.ZodTypeAny;

  handler: (ctx: NodeContext) => Promise<unknown>;

  onInit?: (config: unknown) => Promise<void>;
  onDestroy?: () => Promise<void>;
  onError?: (error: Error, ctx: NodeContext) => Promise<void>;

  retries?: number;
  timeout?: number;
  tags?: string[];
  author?: string;
  repository?: string;
}
```

### NodeContext

The runtime context passed to every node handler.

```typescript
interface NodeContext<TInput = unknown, TConfig = unknown> {
  input: TInput;
  config: TConfig;
  event: WorkflowEvent;
  steps: Record<string, unknown>;
  logger: Logger;
  signal: AbortSignal;
  metadata: WorkflowMetadata;
  ai: AIContext;

  pull: (source: string, params: unknown) => Promise<unknown>;
  push: (target: string, params: unknown) => Promise<unknown>;
  integrate: (name: string, action: string, params: unknown) => Promise<unknown>;
  emit: (event: string, data: unknown) => Promise<void>;
  wait: (event: string, match?: unknown, timeout?: number) => Promise<unknown>;
  sleep: (ms: number) => Promise<void>;
  checkpoint: () => Promise<void>;
}
```

### NodeCategory

```typescript
const NodeCategory = {
  DATA: 'data',
  COMMUNICATION: 'communication',
  AI: 'ai',
  CONTROL: 'control',
  TRANSFORM: 'transform',
  CUSTOM: 'custom',
} as const;

type NodeCategory = 'data' | 'communication' | 'ai' | 'control' | 'transform' | 'custom';
```

---

## Workflow Types

### WorkflowDefinition

```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  trigger: TriggerDefinition;
  steps: Array<WorkflowStep | ControlFlowStep>;
  metadata?: Record<string, unknown>;
  timeout?: number;
  retry?: RetryConfig;
}
```

### WorkflowStep

A single step in a workflow.

```typescript
interface WorkflowStep {
  name: string;
  node: NodeDefinition;
  config?: Record<string, unknown>;
  input?: ((ctx: StepContext) => unknown) | Record<string, unknown>;
  when?: (ctx: StepContext) => boolean | Promise<boolean>;
  dependsOn?: string[];
}
```

### StepContext

Context available to step input functions and conditions.

```typescript
interface StepContext {
  event: WorkflowEvent;
  steps: Record<string, unknown>;
}
```

### TriggerDefinition

```typescript
interface TriggerDefinition {
  type: TriggerType;
  event?: string;
  cron?: string;
  webhook?: { path: string; method?: string };
}
```

### TriggerType

```typescript
const TriggerType = {
  EVENT: 'event',
  CRON: 'cron',
  WEBHOOK: 'webhook',
  MANUAL: 'manual',
  SUB_WORKFLOW: 'sub-workflow',
} as const;

type TriggerType = 'event' | 'cron' | 'webhook' | 'manual' | 'sub-workflow';
```

### Control Flow Steps

```typescript
// Union type
type ControlFlowStep = ParallelStep | ConditionalStep | ForEachStep | SwitchStep | WhileStep;

interface ParallelStep {
  type: 'parallel';
  name: string;
  items: (ctx: StepContext) => unknown[];
  concurrency?: number;
  pipeline: (item: unknown) => WorkflowStep[];
}

interface ConditionalStep {
  type: 'if';
  name: string;
  condition: (ctx: StepContext) => boolean | Promise<boolean>;
  then: WorkflowStep[];
  else?: WorkflowStep[];
}

interface ForEachStep {
  type: 'forEach';
  name: string;
  items: (ctx: StepContext) => unknown[];
  concurrency?: number;
  pipeline: (item: unknown, index: number) => WorkflowStep[];
}

interface SwitchStep {
  type: 'switch';
  name: string;
  value: (ctx: StepContext) => unknown;
  cases: Record<string, WorkflowStep[]>;
  default?: WorkflowStep[];
}

interface WhileStep {
  type: 'while';
  name: string;
  condition: (ctx: StepContext) => boolean | Promise<boolean>;
  maxIterations: number;
  pipeline: WorkflowStep[];
}
```

---

## Run & Step Records

### RunRecord

```typescript
interface RunRecord {
  id: RunId;
  workflowId: string;
  status: RunStatus;
  trigger: TriggerDefinition;
  input: unknown;
  output?: unknown;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
  tenantId?: string;
}
```

### RunStatus

```typescript
const RunStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PAUSED: 'paused',
  WAITING: 'waiting',
} as const;

type RunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused'
  | 'waiting';
```

### StepRecord

```typescript
interface StepRecord {
  id: StepId;
  runId: RunId;
  nodeName: string;
  stepName: string;
  status: StepStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
  attempt: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  durationMs?: number;
}
```

### StepStatus

```typescript
const StepStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  RETRYING: 'retrying',
  WAITING: 'waiting',
} as const;

type StepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'retrying'
  | 'waiting';
```

---

## AI Types

### AIContext

```typescript
interface AIContext {
  generateText(params: AIRequestParams): Promise<AITextResponse>;
  streamText(params: AIRequestParams): Promise<AIStreamResponse>;
  generateObject(params: AIObjectParams): Promise<AIObjectResponse>;
  embed(params: AIEmbedParams): Promise<AIEmbedResponse>;
}
```

### AIRequestParams

```typescript
interface AIRequestParams {
  model?: string;
  prompt?: string;
  messages?: Array<{ role: string; content: string }>;
  system?: string;
  tools?: Record<string, AIToolDef>;
  maxTokens?: number;
  temperature?: number;
  [key: string]: unknown; // Extensible for provider-specific params
}
```

### AIObjectParams

```typescript
interface AIObjectParams extends AIRequestParams {
  schema: z.ZodType;
}
```

### AIToolDef

```typescript
interface AIToolDef {
  description: string;
  parameters: z.ZodType;
  execute?: (...args: unknown[]) => Promise<unknown>;
}
```

### AITextResponse

```typescript
interface AITextResponse {
  text: string;
  usage?: { promptTokens: number; completionTokens: number };
  finishReason?: string;
  toolCalls?: Array<{ toolName: string; args: unknown }>;
  toolResults?: unknown[];
}
```

### AIStreamResponse

```typescript
interface AIStreamResponse {
  textStream: AsyncIterable<string>;
  text: Promise<string>;
  usage?: Promise<{ promptTokens: number; completionTokens: number }>;
}
```

### AIObjectResponse

```typescript
interface AIObjectResponse {
  object: unknown;
  usage?: { promptTokens: number; completionTokens: number };
}
```

### AIEmbedParams

```typescript
interface AIEmbedParams {
  model?: string;
  value: string;
  [key: string]: unknown;
}
```

### AIEmbedResponse

```typescript
interface AIEmbedResponse {
  embedding: number[];
  usage?: { tokens: number };
}
```

---

## Agent Types

### AgentNodeOptions

```typescript
interface AgentNodeOptions {
  name: string;
  version: string;
  description: string;
  model: string;
  systemPrompt: string;
  tools: Record<string, AgentToolDef>;
  outputSchema: z.ZodTypeAny;
  maxIterations?: number; // Default: 10
  temperature?: number;
  maxTokens?: number;
  tags?: string[];
  author?: string;
}
```

### AgentToolDef

```typescript
interface AgentToolDef {
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (ctx: NodeContext, input: unknown) => Promise<unknown>;
}
```

---

## Adaptor Types

### IntegrationAdaptor

```typescript
interface IntegrationAdaptor {
  name: string;
  actions: string[];
  execute(action: string, params: unknown, connectionId: string): Promise<unknown>;
  healthCheck(): Promise<boolean>;
  destroy?(): Promise<void>;
}
```

### DataAdaptor

```typescript
interface DataAdaptor {
  name: string;
  pull(params: unknown): Promise<unknown>;
  push(params: unknown): Promise<unknown>;
  healthCheck(): Promise<boolean>;
  destroy?(): Promise<void>;
}
```

---

## Configuration Types

### RetryConfig

```typescript
interface RetryConfig {
  maxAttempts: number; // 1-100
  backoff: 'fixed' | 'exponential' | 'linear'; // Default: 'exponential'
  delayMs: number; // Default: 1000
  maxDelayMs?: number;
}
```

### WorkerConfig

```typescript
interface WorkerConfig {
  redis: {
    host: string; // Default: 'localhost'
    port: number; // Default: 6379
    password?: string;
    db?: number; // Default: 0
    tls?: boolean;
  };
  postgres: {
    connectionString: string;
  };
  concurrency?: number; // Default: 10
  pollInterval?: number; // Default: 1000ms
  maxRetries?: number; // Default: 3
  shutdownTimeout?: number; // Default: 30000ms
  port?: number; // Default: 4000
}
```

### IntegrationConfig

```typescript
interface IntegrationConfig {
  composioBaseUrl?: string;
  nangoUrl?: string;
  nangoSecretKey?: string;
  port?: number; // Default: 4001
  grpcPort?: number; // Default: 50051
}
```

---

## Event & Metadata Types

### WorkflowEvent

```typescript
interface WorkflowEvent<T = unknown> {
  id: string;
  type: string;
  data: T;
  source?: string;
  timestamp: Date;
}
```

### WorkflowMetadata

```typescript
interface WorkflowMetadata {
  runId: string;
  workflowId: string;
  workflowName: string;
  attempt: number;
  startedAt: Date;
  tenantId?: string;
}
```

### Checkpoint

```typescript
interface Checkpoint {
  runId: RunId;
  stepName: string;
  state: Record<string, unknown>;
  createdAt: Date;
}
```

---

## Branded Identifiers

FlowForge uses branded types for type-safe identifiers:

```typescript
type WorkflowId = string & { readonly __brand: 'WorkflowId' };
type RunId = string & { readonly __brand: 'RunId' };
type StepId = string & { readonly __brand: 'StepId' };
type NodeId = string & { readonly __brand: 'NodeId' };
type EventId = string & { readonly __brand: 'EventId' };
type TenantId = string & { readonly __brand: 'TenantId' };
```

These prevent accidental assignment of one ID type to another while remaining compatible with `string` at runtime.

---

## Logger

Pino-compatible logger interface used throughout FlowForge:

```typescript
interface Logger {
  info(msg: string, ...args: unknown[]): void;
  info(obj: Record<string, unknown>, msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  warn(obj: Record<string, unknown>, msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  error(obj: Record<string, unknown>, msg: string, ...args: unknown[]): void;
  debug(msg: string, ...args: unknown[]): void;
  debug(obj: Record<string, unknown>, msg: string, ...args: unknown[]): void;
  child(bindings: Record<string, unknown>): Logger;
}
```
