import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { StepExecutor } from '../executor.js';
import type {
  WorkflowStep,
  NodeDefinition,
  NodeContext,
  WorkflowEvent,
  WorkflowMetadata,
  AIContext,
} from '@flowforge/shared';
import { StepStatus } from '@flowforge/shared';

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function makeNode(
  name: string,
  handler: (ctx: NodeContext) => Promise<unknown>,
  overrides?: Partial<NodeDefinition>,
): NodeDefinition {
  return {
    name,
    version: '1.0.0',
    description: name,
    category: 'custom' as const,
    inputSchema: z.any(),
    outputSchema: z.any(),
    configSchema: z.any(),
    handler,
    ...overrides,
  };
}

function makeStep(
  name: string,
  node: NodeDefinition,
  overrides?: Partial<WorkflowStep>,
): WorkflowStep {
  return { name, node, ...overrides };
}

function makeContext(input: unknown = {}): NodeContext {
  const noopAI: AIContext = {
    generateText: async () => ({ text: '', toolCalls: [], toolResults: [] }),
    streamText: async () => ({
      textStream: (async function* () {})(),
      text: Promise.resolve(''),
    }),
    generateObject: async () => ({ object: {} }),
    embed: async () => ({ embedding: [] }),
  };

  const event: WorkflowEvent = {
    id: 'evt_test',
    type: 'test',
    data: input,
    timestamp: new Date(),
  };

  const metadata: WorkflowMetadata = {
    runId: 'run_test123',
    workflowId: 'wf_test',
    workflowName: 'test-workflow',
    attempt: 1,
    startedAt: new Date(),
  };

  return {
    input,
    config: {},
    event,
    steps: {},
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      child: () => makeContext(input).logger,
    },
    signal: new AbortController().signal,
    metadata,
    ai: noopAI,
    pull: async () => {
      throw new Error('not available');
    },
    push: async () => {
      throw new Error('not available');
    },
    integrate: async () => {
      throw new Error('not available');
    },
    emit: async () => {},
    wait: async () => ({}),
    sleep: async (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    checkpoint: async () => {},
  };
}

// ────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────

describe('StepExecutor', () => {
  it('executes a simple step and returns a completed StepRecord', async () => {
    const executor = new StepExecutor();
    const node = makeNode('test/echo', async (ctx) => ctx.input);
    const step = makeStep('echo-step', node);
    const ctx = makeContext({ hello: 'world' });

    const record = await executor.execute(step, ctx);

    expect(record.status).toBe(StepStatus.COMPLETED);
    expect(record.output).toEqual({ hello: 'world' });
    expect(record.stepName).toBe('echo-step');
    expect(record.nodeName).toBe('test/echo');
    expect(record.id).toMatch(/^stp_/);
    expect(record.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('captures errors in failed step records', async () => {
    const executor = new StepExecutor();
    const node = makeNode('test/fail', async () => {
      throw new Error('intentional failure');
    });
    const step = makeStep('fail-step', node);
    const ctx = makeContext();

    await expect(executor.execute(step, ctx)).rejects.toThrow('intentional failure');
  });

  it('retries on failure according to node retries config', async () => {
    const executor = new StepExecutor();
    let attempts = 0;
    const node = makeNode(
      'test/flaky',
      async () => {
        attempts++;
        if (attempts < 3) throw new Error(`fail attempt ${attempts}`);
        return 'success';
      },
      { retries: 3 },
    );
    const step = makeStep('flaky-step', node);
    const ctx = makeContext();

    const record = await executor.execute(step, ctx);

    expect(record.status).toBe(StepStatus.COMPLETED);
    expect(record.output).toBe('success');
    expect(attempts).toBe(3);
  });

  it('throws RetryExhaustedError when all retries fail', async () => {
    const executor = new StepExecutor();
    const node = makeNode(
      'test/always-fail',
      async () => {
        throw new Error('always fails');
      },
      { retries: 2 },
    );
    const step = makeStep('retry-exhaust-step', node);
    const ctx = makeContext();

    await expect(executor.execute(step, ctx)).rejects.toThrow('exhausted all 2 retry attempts');
  });

  it('enforces node timeout', async () => {
    const executor = new StepExecutor();
    const node = makeNode(
      'test/slow',
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return 'never';
      },
      { timeout: 50 },
    );
    const step = makeStep('timeout-step', node);
    const ctx = makeContext();

    await expect(executor.execute(step, ctx)).rejects.toThrow('timed out');
  });

  it('validates input schema and rejects invalid input', async () => {
    const executor = new StepExecutor();
    const node = makeNode('test/strict-input', async (ctx) => ctx.input, {
      inputSchema: z.object({ name: z.string() }),
    });
    const step = makeStep('validate-input-step', node);
    const ctx = makeContext({ name: 123 }); // invalid

    await expect(executor.execute(step, ctx)).rejects.toThrow('Input validation failed');
  });

  it('validates output schema and rejects invalid output', async () => {
    const executor = new StepExecutor();
    const node = makeNode('test/bad-output', async () => 'not-an-object', {
      outputSchema: z.object({ result: z.number() }),
    });
    const step = makeStep('validate-output-step', node);
    const ctx = makeContext();

    await expect(executor.execute(step, ctx)).rejects.toThrow('Output validation failed');
  });

  it('passes valid data through schema validation', async () => {
    const executor = new StepExecutor();
    const node = makeNode(
      'test/validated',
      async (ctx) => ({ result: (ctx.input as { value: number }).value * 2 }),
      {
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ result: z.number() }),
      },
    );
    const step = makeStep('validated-step', node);
    const ctx = makeContext({ value: 21 });

    const record = await executor.execute(step, ctx);

    expect(record.status).toBe(StepStatus.COMPLETED);
    expect(record.output).toEqual({ result: 42 });
  });

  it('records the correct attempt number after retries', async () => {
    const executor = new StepExecutor();
    let callCount = 0;
    const node = makeNode(
      'test/retry-count',
      async () => {
        callCount++;
        if (callCount < 2) throw new Error('retry me');
        return 'ok';
      },
      { retries: 3 },
    );
    const step = makeStep('retry-count-step', node);
    const ctx = makeContext();

    const record = await executor.execute(step, ctx);

    expect(record.status).toBe(StepStatus.COMPLETED);
    expect(record.attempt).toBe(2);
  });

  it('does not retry on ValidationError', async () => {
    const executor = new StepExecutor();
    let callCount = 0;
    const node = makeNode(
      'test/validation-no-retry',
      async () => {
        callCount++;
        return { bad: 'shape' };
      },
      {
        retries: 3,
        outputSchema: z.object({ valid: z.boolean() }),
      },
    );
    const step = makeStep('no-retry-validation', node);
    const ctx = makeContext();

    await expect(executor.execute(step, ctx)).rejects.toThrow('Output validation failed');
    // Should only be called once since validation errors are not retried
    expect(callCount).toBe(1);
  });
});
