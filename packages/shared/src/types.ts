import type { z } from 'zod';

// ────────────────────────────────────────────────────────────────
// Identifiers (branded)
// ────────────────────────────────────────────────────────────────
export type WorkflowId = string & { readonly __brand: 'WorkflowId' };
export type RunId = string & { readonly __brand: 'RunId' };
export type StepId = string & { readonly __brand: 'StepId' };
export type NodeId = string & { readonly __brand: 'NodeId' };
export type EventId = string & { readonly __brand: 'EventId' };
export type TenantId = string & { readonly __brand: 'TenantId' };

// ────────────────────────────────────────────────────────────────
// Enums
// ────────────────────────────────────────────────────────────────
export const RunStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PAUSED: 'paused',
  WAITING: 'waiting',
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

export const StepStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  RETRYING: 'retrying',
  WAITING: 'waiting',
} as const;
export type StepStatus = (typeof StepStatus)[keyof typeof StepStatus];

export const NodeCategory = {
  DATA: 'data',
  COMMUNICATION: 'communication',
  AI: 'ai',
  CONTROL: 'control',
  TRANSFORM: 'transform',
  CUSTOM: 'custom',
} as const;
export type NodeCategory = (typeof NodeCategory)[keyof typeof NodeCategory];

export const TriggerType = {
  EVENT: 'event',
  CRON: 'cron',
  WEBHOOK: 'webhook',
  MANUAL: 'manual',
  SUB_WORKFLOW: 'sub-workflow',
} as const;
export type TriggerType = (typeof TriggerType)[keyof typeof TriggerType];

// ────────────────────────────────────────────────────────────────
// Logger (Pino-compatible subset)
// ────────────────────────────────────────────────────────────────
export interface Logger {
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

// ────────────────────────────────────────────────────────────────
// Workflow Event
// ────────────────────────────────────────────────────────────────
export interface WorkflowEvent<T = unknown> {
  id: string;
  type: string;
  data: T;
  source?: string;
  timestamp: Date;
}

// ────────────────────────────────────────────────────────────────
// Workflow Metadata
// ────────────────────────────────────────────────────────────────
export interface WorkflowMetadata {
  runId: string;
  workflowId: string;
  workflowName: string;
  attempt: number;
  startedAt: Date;
  tenantId?: string;
}

// ────────────────────────────────────────────────────────────────
// AI Context (Vercel AI SDK wrappers)
// ────────────────────────────────────────────────────────────────
export interface AIContext {
  generateText(params: AIRequestParams): Promise<AITextResponse>;
  streamText(params: AIRequestParams): Promise<AIStreamResponse>;
  generateObject(params: AIObjectParams): Promise<AIObjectResponse>;
  embed(params: AIEmbedParams): Promise<AIEmbedResponse>;
}

export interface AIRequestParams {
  model?: string;
  prompt?: string;
  messages?: Array<{ role: string; content: string }>;
  system?: string;
  tools?: Record<string, AIToolDef>;
  maxTokens?: number;
  temperature?: number;
  [key: string]: unknown;
}

export interface AIObjectParams extends AIRequestParams {
  schema: z.ZodType;
}

export interface AIToolDef {
  description: string;
  parameters: z.ZodType;
  execute?: (...args: unknown[]) => Promise<unknown>;
}

export interface AITextResponse {
  text: string;
  usage?: { promptTokens: number; completionTokens: number };
  finishReason?: string;
  toolCalls?: Array<{ toolName: string; args: unknown }>;
  toolResults?: unknown[];
}

export interface AIStreamResponse {
  textStream: AsyncIterable<string>;
  text: Promise<string>;
  usage?: Promise<{ promptTokens: number; completionTokens: number }>;
}

export interface AIObjectResponse {
  object: unknown;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface AIEmbedParams {
  model?: string;
  value: string;
  [key: string]: unknown;
}

export interface AIEmbedResponse {
  embedding: number[];
  usage?: { tokens: number };
}

// ────────────────────────────────────────────────────────────────
// Node Context (PRD Section 5.1)
// ────────────────────────────────────────────────────────────────
export interface NodeContext<TInput = unknown, TConfig = unknown> {
  input: TInput;
  config: TConfig;
  event: WorkflowEvent;
  steps: Record<string, unknown>;
  logger: Logger;

  // Data operations
  pull: (source: string, params: unknown) => Promise<unknown>;
  push: (target: string, params: unknown) => Promise<unknown>;

  // Integration operations
  integrate: (name: string, action: string, params: unknown) => Promise<unknown>;

  // AI operations
  ai: AIContext;

  // Event operations
  emit: (event: string, data: unknown) => Promise<void>;
  wait: (event: string, match?: unknown, timeout?: number) => Promise<unknown>;
  sleep: (ms: number) => Promise<void>;
  checkpoint: () => Promise<void>;

  // Metadata
  metadata: WorkflowMetadata;

  // Abort signal
  signal: AbortSignal;
}

// ────────────────────────────────────────────────────────────────
// Node Definition (PRD Section 5.1)
// ────────────────────────────────────────────────────────────────
export interface NodeDefinition {
  // Identity
  name: string;
  version: string;
  description: string;
  category: NodeCategory;

  // Schemas (Zod-based, validated at runtime)
  inputSchema: z.ZodTypeAny;
  outputSchema: z.ZodTypeAny;
  configSchema: z.ZodTypeAny;

  // Execution
  handler: (ctx: NodeContext) => Promise<unknown>;

  // Lifecycle hooks
  onInit?: (config: unknown) => Promise<void>;
  onDestroy?: () => Promise<void>;
  onError?: (error: Error, ctx: NodeContext) => Promise<void>;

  // Metadata
  retries?: number;
  timeout?: number;
  tags?: string[];
  author?: string;
  repository?: string;
}

// ────────────────────────────────────────────────────────────────
// Agent Node Definition (PRD Section 4.2)
// ────────────────────────────────────────────────────────────────
export interface AgentToolDef {
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (ctx: NodeContext, input: unknown) => Promise<unknown>;
}

export interface AgentNodeOptions {
  name: string;
  version: string;
  description: string;
  model: string;
  systemPrompt: string;
  tools: Record<string, AgentToolDef>;
  outputSchema: z.ZodTypeAny;
  maxIterations?: number;
  temperature?: number;
  maxTokens?: number;
  tags?: string[];
  author?: string;
}

// ────────────────────────────────────────────────────────────────
// Retry Configuration
// ────────────────────────────────────────────────────────────────
export interface RetryConfig {
  maxAttempts: number;
  backoff: 'fixed' | 'exponential' | 'linear';
  delayMs: number;
  maxDelayMs?: number;
}

// ────────────────────────────────────────────────────────────────
// Trigger Definition
// ────────────────────────────────────────────────────────────────
export interface TriggerDefinition {
  type: TriggerType;
  event?: string;
  cron?: string;
  webhook?: { path: string; method?: string };
}

// ────────────────────────────────────────────────────────────────
// Workflow Step (in workflow definition)
// ────────────────────────────────────────────────────────────────
export interface WorkflowStep {
  name: string;
  node: NodeDefinition;
  config?: Record<string, unknown>;
  input?: ((ctx: StepContext) => unknown) | Record<string, unknown>;
  when?: (ctx: StepContext) => boolean | Promise<boolean>;
  dependsOn?: string[];
}

export interface StepContext {
  event: WorkflowEvent;
  steps: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────────
// Control Flow Step Types
// ────────────────────────────────────────────────────────────────
export interface ParallelStep {
  type: 'parallel';
  name: string;
  items: (ctx: StepContext) => unknown[];
  concurrency?: number;
  pipeline: (item: unknown) => WorkflowStep[];
}

export interface ConditionalStep {
  type: 'if';
  name: string;
  condition: (ctx: StepContext) => boolean | Promise<boolean>;
  then: WorkflowStep[];
  else?: WorkflowStep[];
}

export interface ForEachStep {
  type: 'forEach';
  name: string;
  items: (ctx: StepContext) => unknown[];
  concurrency?: number;
  pipeline: (item: unknown, index: number) => WorkflowStep[];
}

export interface SwitchStep {
  type: 'switch';
  name: string;
  value: (ctx: StepContext) => unknown;
  cases: Record<string, WorkflowStep[]>;
  default?: WorkflowStep[];
}

export interface WhileStep {
  type: 'while';
  name: string;
  condition: (ctx: StepContext) => boolean | Promise<boolean>;
  maxIterations: number;
  pipeline: WorkflowStep[];
}

export type ControlFlowStep = ParallelStep | ConditionalStep | ForEachStep | SwitchStep | WhileStep;

// ────────────────────────────────────────────────────────────────
// Workflow Definition
// ────────────────────────────────────────────────────────────────
export interface WorkflowDefinition {
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

// ────────────────────────────────────────────────────────────────
// Run Record
// ────────────────────────────────────────────────────────────────
export interface RunRecord {
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

// ────────────────────────────────────────────────────────────────
// Step Record
// ────────────────────────────────────────────────────────────────
export interface StepRecord {
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

// ────────────────────────────────────────────────────────────────
// Checkpoint
// ────────────────────────────────────────────────────────────────
export interface Checkpoint {
  runId: RunId;
  stepName: string;
  state: Record<string, unknown>;
  createdAt: Date;
}

// ────────────────────────────────────────────────────────────────
// Event Record
// ────────────────────────────────────────────────────────────────
export interface EventRecord {
  id: EventId;
  type: string;
  payload: unknown;
  source?: string;
  tenantId?: string;
  createdAt: Date;
}

// ────────────────────────────────────────────────────────────────
// Worker Config
// ────────────────────────────────────────────────────────────────
export interface WorkerConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    tls?: boolean;
  };
  postgres: {
    connectionString: string;
  };
  concurrency?: number;
  pollInterval?: number;
  maxRetries?: number;
  shutdownTimeout?: number;
  port?: number;
}

// ────────────────────────────────────────────────────────────────
// Integration Config
// ────────────────────────────────────────────────────────────────
export interface IntegrationConfig {
  nangoUrl?: string;
  nangoSecretKey?: string;
  port?: number;
  grpcPort?: number;
}

// ────────────────────────────────────────────────────────────────
// Integration Protocol (mirrors gRPC)
// ────────────────────────────────────────────────────────────────
export interface IntegrationRequest {
  integrationName: string;
  action: string;
  paramsJson: string;
  connectionId: string;
  runId?: string;
}

export interface IntegrationResponse {
  success: boolean;
  resultJson?: string;
  errorMessage?: string;
  statusCode?: number;
}

// ────────────────────────────────────────────────────────────────
// Data Adaptor Interface
// ────────────────────────────────────────────────────────────────
export interface DataAdaptor {
  name: string;
  pull(params: unknown): Promise<unknown>;
  push(params: unknown): Promise<unknown>;
  healthCheck(): Promise<boolean>;
  destroy?(): Promise<void>;
}

// ────────────────────────────────────────────────────────────────
// Integration Adaptor Interface
// ────────────────────────────────────────────────────────────────
export interface IntegrationAdaptor {
  name: string;
  actions: string[];
  execute(action: string, params: unknown, connectionId: string): Promise<unknown>;
  healthCheck(): Promise<boolean>;
  destroy?(): Promise<void>;
}

// ────────────────────────────────────────────────────────────────
// State Store
// ────────────────────────────────────────────────────────────────
export interface StateStore {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
}

// ────────────────────────────────────────────────────────────────
// Dashboard / API Types
// ────────────────────────────────────────────────────────────────
export interface WorkflowSummary {
  id: string;
  name: string;
  version: string;
  triggerType: TriggerType;
  nodeCount: number;
  successRate7d?: number;
  successRate30d?: number;
}

export interface RunFilter {
  workflowId?: string;
  status?: RunStatus;
  from?: Date;
  to?: Date;
  eventType?: string;
  tenantId?: string;
  limit?: number;
  offset?: number;
}

export interface MetricsSnapshot {
  totalRuns: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
  p95DurationMs: number;
  throughputPerHour: number;
  period: string;
}
