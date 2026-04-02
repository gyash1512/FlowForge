import type {
  WorkflowStep,
  NodeContext,
  Logger,
  RetryConfig,
} from '@flowforge/shared';
import {
  StepStatus,
  NodeExecutionError,
  NodeTimeoutError,
  RetryExhaustedError,
  ValidationError,
  stepId,
} from '@flowforge/shared';
import type { StepRecord } from '@flowforge/shared';

// ────────────────────────────────────────────────────────────────
// Retry helpers (inline, no external dependency)
// ────────────────────────────────────────────────────────────────

function computeDelay(config: RetryConfig, attempt: number): number {
  let delay: number;
  switch (config.backoff) {
    case 'fixed':
      delay = config.delayMs;
      break;
    case 'linear':
      delay = config.delayMs * attempt;
      break;
    case 'exponential':
      delay = config.delayMs * Math.pow(2, attempt - 1);
      break;
  }
  if (config.maxDelayMs !== undefined) {
    delay = Math.min(delay, config.maxDelayMs);
  }
  return delay;
}

function delaySleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason as Error);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason as Error);
      },
      { once: true },
    );
  });
}

// ────────────────────────────────────────────────────────────────
// StepExecutor
// ────────────────────────────────────────────────────────────────

export interface StepExecutorOptions {
  logger?: Logger;
}

export class StepExecutor {
  private logger: Logger | undefined;

  constructor(options: StepExecutorOptions = {}) {
    this.logger = options.logger;
  }

  /**
   * Execute a single WorkflowStep with the given NodeContext.
   * Handles retry logic, timeout, and input/output schema validation.
   * Returns a StepRecord summarising the outcome.
   */
  async execute(step: WorkflowStep, ctx: NodeContext): Promise<StepRecord> {
    const sid = stepId();
    const startedAt = new Date();

    const record: StepRecord = {
      id: sid,
      runId: ctx.metadata.runId as StepRecord['runId'],
      nodeName: step.node.name,
      stepName: step.name,
      status: StepStatus.PENDING,
      input: ctx.input,
      attempt: 1,
      startedAt,
      createdAt: startedAt,
    };

    // ── Validate input ──
    if (step.node.inputSchema) {
      const parsed = step.node.inputSchema.safeParse(ctx.input);
      if (!parsed.success) {
        record.status = StepStatus.FAILED;
        record.error = `Input validation failed: ${parsed.error.message}`;
        record.completedAt = new Date();
        record.durationMs = record.completedAt.getTime() - startedAt.getTime();
        throw new ValidationError(record.error, {
          stepName: step.name,
          issues: parsed.error.issues,
        });
      }
    }

    // ── Build retry config ──
    const retryConfig: RetryConfig | undefined = step.node.retries
      ? {
          maxAttempts: step.node.retries,
          backoff: 'exponential',
          delayMs: 1000,
        }
      : undefined;

    const maxAttempts = retryConfig?.maxAttempts ?? 1;

    // ── Execute with retries ──
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      record.attempt = attempt;
      record.status = attempt > 1 ? StepStatus.RETRYING : StepStatus.RUNNING;

      this.logger?.debug(`Executing step "${step.name}" (attempt ${attempt}/${maxAttempts})`);

      try {
        const output = await this.executeOnce(step, ctx);

        // ── Validate output ──
        if (step.node.outputSchema) {
          const parsed = step.node.outputSchema.safeParse(output);
          if (!parsed.success) {
            record.status = StepStatus.FAILED;
            record.error = `Output validation failed: ${parsed.error.message}`;
            record.completedAt = new Date();
            record.durationMs = record.completedAt.getTime() - startedAt.getTime();
            throw new ValidationError(record.error, {
              stepName: step.name,
              issues: parsed.error.issues,
            });
          }
          record.output = parsed.data;
        } else {
          record.output = output;
        }

        record.status = StepStatus.COMPLETED;
        record.completedAt = new Date();
        record.durationMs = record.completedAt.getTime() - startedAt.getTime();

        this.logger?.info(
          `Step "${step.name}" completed in ${record.durationMs}ms`,
        );

        return record;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // If it is a validation error, do not retry
        if (err instanceof ValidationError) {
          throw err;
        }

        // If it is a timeout error, do not retry
        if (err instanceof NodeTimeoutError) {
          record.status = StepStatus.FAILED;
          record.error = lastError.message;
          record.completedAt = new Date();
          record.durationMs = record.completedAt.getTime() - startedAt.getTime();
          throw err;
        }

        this.logger?.warn(
          `Step "${step.name}" attempt ${attempt} failed: ${lastError.message}`,
        );

        if (attempt < maxAttempts && retryConfig) {
          const delay = computeDelay(retryConfig, attempt);
          await delaySleep(delay, ctx.signal);
        }
      }
    }

    // All retries exhausted
    record.status = StepStatus.FAILED;
    record.error = lastError?.message ?? 'Unknown error';
    record.completedAt = new Date();
    record.durationMs = record.completedAt.getTime() - startedAt.getTime();

    if (maxAttempts > 1) {
      throw new RetryExhaustedError(step.node.name, maxAttempts);
    }

    throw new NodeExecutionError(step.node.name, lastError);
  }

  /**
   * Execute the step handler once, with optional timeout.
   */
  private async executeOnce(
    step: WorkflowStep,
    ctx: NodeContext,
  ): Promise<unknown> {
    const timeoutMs = step.node.timeout;

    if (timeoutMs) {
      return Promise.race([
        step.node.handler(ctx),
        new Promise<never>((_resolve, reject) => {
          const timer = setTimeout(
            () => reject(new NodeTimeoutError(step.node.name, timeoutMs)),
            timeoutMs,
          );
          ctx.signal.addEventListener(
            'abort',
            () => clearTimeout(timer),
            { once: true },
          );
        }),
      ]);
    }

    return step.node.handler(ctx);
  }
}
