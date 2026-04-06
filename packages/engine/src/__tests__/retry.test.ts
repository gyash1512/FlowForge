import { describe, it, expect, vi } from 'vitest';
import { computeDelay, withRetry } from '../retry.js';
import type { RetryConfig } from '@flowforge/shared';

describe('computeDelay', () => {
  it('returns fixed delay', () => {
    const config: RetryConfig = { maxAttempts: 3, backoff: 'fixed', delayMs: 1000 };
    expect(computeDelay(config, 1)).toBe(1000);
    expect(computeDelay(config, 2)).toBe(1000);
    expect(computeDelay(config, 3)).toBe(1000);
  });

  it('returns linear delay', () => {
    const config: RetryConfig = { maxAttempts: 3, backoff: 'linear', delayMs: 500 };
    expect(computeDelay(config, 1)).toBe(500);
    expect(computeDelay(config, 2)).toBe(1000);
    expect(computeDelay(config, 3)).toBe(1500);
  });

  it('returns exponential delay', () => {
    const config: RetryConfig = { maxAttempts: 3, backoff: 'exponential', delayMs: 100 };
    expect(computeDelay(config, 1)).toBe(100);
    expect(computeDelay(config, 2)).toBe(200);
    expect(computeDelay(config, 3)).toBe(400);
  });

  it('caps at maxDelayMs', () => {
    const config: RetryConfig = {
      maxAttempts: 5,
      backoff: 'exponential',
      delayMs: 100,
      maxDelayMs: 300,
    };
    expect(computeDelay(config, 3)).toBe(300);
    expect(computeDelay(config, 4)).toBe(300);
  });
});

describe('withRetry', () => {
  it('succeeds on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const config: RetryConfig = { maxAttempts: 3, backoff: 'fixed', delayMs: 0 };
    const result = await withRetry(fn, config, { nodeId: 'test' });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure then succeeds', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');
    const config: RetryConfig = { maxAttempts: 3, backoff: 'fixed', delayMs: 0 };
    const result = await withRetry(fn, config, { nodeId: 'test' });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws RetryExhaustedError when all attempts fail', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const config: RetryConfig = { maxAttempts: 2, backoff: 'fixed', delayMs: 0 };
    await expect(withRetry(fn, config, { nodeId: 'test' })).rejects.toThrow(
      'exhausted all 2 retry attempts',
    );
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('calls onRetry callback', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');
    const config: RetryConfig = { maxAttempts: 3, backoff: 'fixed', delayMs: 0 };
    await withRetry(fn, config, { nodeId: 'test', onRetry });
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), 0);
  });

  it('passes attempt number to fn', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');
    const config: RetryConfig = { maxAttempts: 3, backoff: 'fixed', delayMs: 0 };
    await withRetry(fn, config, { nodeId: 'test' });
    expect(fn).toHaveBeenCalledWith(1);
    expect(fn).toHaveBeenCalledWith(2);
  });
});
