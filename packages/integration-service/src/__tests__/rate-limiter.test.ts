import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RateLimiter } from '../rate-limiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests within the configured limit', () => {
    limiter.configure('slack', 3, 60_000);
    expect(limiter.acquire('slack')).toBe(true);
    expect(limiter.acquire('slack')).toBe(true);
    expect(limiter.acquire('slack')).toBe(true);
  });

  it('rejects requests when limit is exhausted', () => {
    limiter.configure('slack', 2, 60_000);
    expect(limiter.acquire('slack')).toBe(true);
    expect(limiter.acquire('slack')).toBe(true);
    expect(limiter.acquire('slack')).toBe(false);
  });

  it('refills tokens after the window elapses', () => {
    limiter.configure('slack', 1, 1_000);
    expect(limiter.acquire('slack')).toBe(true);
    expect(limiter.acquire('slack')).toBe(false);

    vi.advanceTimersByTime(1_000);
    expect(limiter.acquire('slack')).toBe(true);
  });

  it('uses default limits for unconfigured integrations', () => {
    // Default is 100 per 60s — should be allowed
    expect(limiter.acquire('unknown')).toBe(true);
  });

  it('tracks separate buckets per integration', () => {
    limiter.configure('slack', 1, 60_000);
    limiter.configure('email', 1, 60_000);

    expect(limiter.acquire('slack')).toBe(true);
    expect(limiter.acquire('slack')).toBe(false);

    // Email bucket is independent
    expect(limiter.acquire('email')).toBe(true);
  });

  it('accumulates multiple windows of refills', () => {
    limiter.configure('slack', 2, 1_000);
    expect(limiter.acquire('slack')).toBe(true);
    expect(limiter.acquire('slack')).toBe(true);
    expect(limiter.acquire('slack')).toBe(false);

    // Advance 3 windows — should refill up to max (2), not 6
    vi.advanceTimersByTime(3_000);
    expect(limiter.acquire('slack')).toBe(true);
    expect(limiter.acquire('slack')).toBe(true);
    expect(limiter.acquire('slack')).toBe(false);
  });

  it('does not refill if window has not elapsed', () => {
    limiter.configure('slack', 1, 10_000);
    expect(limiter.acquire('slack')).toBe(true);
    expect(limiter.acquire('slack')).toBe(false);

    vi.advanceTimersByTime(5_000);
    expect(limiter.acquire('slack')).toBe(false);
  });
});
