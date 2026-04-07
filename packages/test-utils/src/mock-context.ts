import type {
  NodeContext,
  WorkflowEvent,
  WorkflowMetadata,
  AIContext,
  AITextResponse,
  AIStreamResponse,
  AIObjectResponse,
  AIEmbedResponse,
} from '@flowforgejs/shared';
import { MockLogger } from './mock-logger.js';

export interface MockCall {
  method: string;
  args: unknown[];
}

export interface MockContextOptions {
  input?: unknown;
  config?: unknown;
  event?: Partial<WorkflowEvent>;
  steps?: Record<string, unknown>;
  metadata?: Partial<WorkflowMetadata>;
}

export interface MockContextResult<TInput = unknown, TConfig = unknown> {
  ctx: NodeContext<TInput, TConfig>;
  calls: MockCall[];
  logger: MockLogger;
}

/**
 * Create a full mock NodeContext with stub implementations for all methods.
 * Every method call is tracked in the `calls` array for assertion.
 */
export function createMockContext<TInput = unknown, TConfig = unknown>(
  overrides: MockContextOptions = {},
): MockContextResult<TInput, TConfig> {
  const calls: MockCall[] = [];
  const logger = new MockLogger();

  function track(method: string, args: unknown[]): void {
    calls.push({ method, args });
  }

  const event: WorkflowEvent = {
    id: 'evt_mock',
    type: overrides.event?.type ?? 'test',
    data: overrides.event?.data ?? {},
    source: overrides.event?.source,
    timestamp: overrides.event?.timestamp ?? new Date(),
  };

  const metadata: WorkflowMetadata = {
    runId: overrides.metadata?.runId ?? 'run_mock',
    workflowId: overrides.metadata?.workflowId ?? 'wf_mock',
    workflowName: overrides.metadata?.workflowName ?? 'Mock Workflow',
    attempt: overrides.metadata?.attempt ?? 1,
    startedAt: overrides.metadata?.startedAt ?? new Date(),
    tenantId: overrides.metadata?.tenantId,
  };

  const noopAI: AIContext = {
    async generateText(): Promise<AITextResponse> {
      track('ai.generateText', [...arguments]);
      return { text: '', toolCalls: [], toolResults: [] };
    },
    async streamText(): Promise<AIStreamResponse> {
      track('ai.streamText', [...arguments]);
      return { textStream: (async function* () {})(), text: Promise.resolve('') };
    },
    async generateObject(): Promise<AIObjectResponse> {
      track('ai.generateObject', [...arguments]);
      return { object: {} };
    },
    async embed(): Promise<AIEmbedResponse> {
      track('ai.embed', [...arguments]);
      return { embedding: [] };
    },
  };

  const abortController = new AbortController();

  const ctx: NodeContext<TInput, TConfig> = {
    input: (overrides.input ?? {}) as TInput,
    config: (overrides.config ?? {}) as TConfig,
    event,
    steps: overrides.steps ?? {},
    logger,
    signal: abortController.signal,
    metadata,
    ai: noopAI,

    async pull(source: string, params: unknown): Promise<unknown> {
      track('pull', [source, params]);
      return {};
    },

    async push(target: string, params: unknown): Promise<unknown> {
      track('push', [target, params]);
      return {};
    },

    async integrate(name: string, action: string, params: unknown): Promise<unknown> {
      track('integrate', [name, action, params]);
      return {};
    },

    async emit(eventType: string, data: unknown): Promise<void> {
      track('emit', [eventType, data]);
    },

    async wait(eventType: string, match?: unknown, timeout?: number): Promise<unknown> {
      track('wait', [eventType, match, timeout]);
      return {};
    },

    async sleep(ms: number): Promise<void> {
      track('sleep', [ms]);
      // Do not actually sleep in tests
    },

    async checkpoint(): Promise<void> {
      track('checkpoint', []);
    },
  };

  return { ctx, calls, logger };
}
