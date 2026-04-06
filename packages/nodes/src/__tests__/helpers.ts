import type {
  NodeContext,
  WorkflowEvent,
  WorkflowMetadata,
  AIContext,
  Logger,
} from '@flowforge/shared';
import { vi } from 'vitest';

/**
 * Creates a mock NodeContext with stub implementations for all ctx methods.
 * Override individual fields by passing a partial context object.
 */
export function createMockContext<TInput = unknown, TConfig = unknown>(
  overrides: Partial<{
    input: TInput;
    config: TConfig;
    event: Partial<WorkflowEvent>;
    steps: Record<string, unknown>;
    pull: NodeContext['pull'];
    push: NodeContext['push'];
    integrate: NodeContext['integrate'];
    ai: Partial<AIContext>;
    emit: NodeContext['emit'];
    wait: NodeContext['wait'];
    sleep: NodeContext['sleep'];
    checkpoint: NodeContext['checkpoint'];
    metadata: Partial<WorkflowMetadata>;
    signal: AbortSignal;
  }> = {},
): NodeContext<TInput, TConfig> {
  const logger: Logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => logger),
  };

  const defaultEvent: WorkflowEvent = {
    id: 'evt-test-1',
    type: 'test',
    data: {},
    source: 'test',
    timestamp: new Date('2025-01-01T00:00:00Z'),
    ...overrides.event,
  };

  const defaultMetadata: WorkflowMetadata = {
    runId: 'run-test-1',
    workflowId: 'wf-test-1',
    workflowName: 'test-workflow',
    attempt: 1,
    startedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides.metadata,
  };

  const defaultAi: AIContext = {
    generateText: vi.fn().mockResolvedValue({
      text: 'mock text',
      usage: { promptTokens: 10, completionTokens: 20 },
      finishReason: 'stop',
    }),
    streamText: vi.fn().mockResolvedValue({
      textStream: (async function* () {
        yield 'mock';
      })(),
      text: Promise.resolve('mock'),
    }),
    generateObject: vi
      .fn()
      .mockResolvedValue({ object: {}, usage: { promptTokens: 10, completionTokens: 20 } }),
    embed: vi.fn().mockResolvedValue({ embedding: [0.1, 0.2, 0.3], usage: { tokens: 5 } }),
    ...overrides.ai,
  };

  return {
    input: (overrides.input ?? {}) as TInput,
    config: (overrides.config ?? {}) as TConfig,
    event: defaultEvent,
    steps: overrides.steps ?? {},
    logger,
    pull: overrides.pull ?? vi.fn().mockResolvedValue({}),
    push: overrides.push ?? vi.fn().mockResolvedValue({}),
    integrate: overrides.integrate ?? vi.fn().mockResolvedValue({}),
    ai: defaultAi,
    emit: overrides.emit ?? vi.fn().mockResolvedValue(undefined),
    wait: overrides.wait ?? vi.fn().mockResolvedValue({}),
    sleep: overrides.sleep ?? vi.fn().mockResolvedValue(undefined),
    checkpoint: overrides.checkpoint ?? vi.fn().mockResolvedValue(undefined),
    metadata: defaultMetadata,
    signal: overrides.signal ?? AbortSignal.timeout(30_000),
  };
}
