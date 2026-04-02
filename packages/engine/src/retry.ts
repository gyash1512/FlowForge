import type { RetryConfig } from '@flowforge/shared';
import { RetryExhaustedError } from '@flowforge/shared';

export function computeDelay(config: RetryConfig, attempt: number): number {
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

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
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

export interface RetryContext {
  nodeId: string;
  signal?: AbortSignal;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  config: RetryConfig,
  ctx: RetryContext,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt >= config.maxAttempts) {
        break;
      }

      const delay = computeDelay(config, attempt);
      ctx.onRetry?.(attempt, lastError, delay);
      await sleep(delay, ctx.signal);
    }
  }

  throw new RetryExhaustedError(ctx.nodeId, config.maxAttempts);
}
