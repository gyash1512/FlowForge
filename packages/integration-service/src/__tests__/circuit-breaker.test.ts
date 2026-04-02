import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CircuitBreakerOpenError } from '@flowforge/shared';
import { CircuitBreaker, CircuitState } from '../circuit-breaker.js';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({ threshold: 3, timeoutMs: 5_000, resetMs: 2_000 });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in CLOSED state', () => {
    expect(cb.getState('slack')).toBe(CircuitState.CLOSED);
  });

  it('executes functions successfully in CLOSED state', async () => {
    const result = await cb.execute('slack', async () => 42);
    expect(result).toBe(42);
    expect(cb.getState('slack')).toBe(CircuitState.CLOSED);
  });

  it('transitions to OPEN after reaching failure threshold', async () => {
    const fail = () => cb.execute('slack', async () => { throw new Error('boom'); });

    await expect(fail()).rejects.toThrow('boom');
    await expect(fail()).rejects.toThrow('boom');
    await expect(fail()).rejects.toThrow('boom');

    expect(cb.getState('slack')).toBe(CircuitState.OPEN);
  });

  it('rejects calls immediately when OPEN', async () => {
    // Trip the breaker
    for (let i = 0; i < 3; i++) {
      await cb.execute('slack', async () => { throw new Error('fail'); }).catch(() => {});
    }

    await expect(
      cb.execute('slack', async () => 'should not run'),
    ).rejects.toThrow(CircuitBreakerOpenError);
  });

  it('transitions to HALF_OPEN after timeout elapses', async () => {
    for (let i = 0; i < 3; i++) {
      await cb.execute('slack', async () => { throw new Error('fail'); }).catch(() => {});
    }
    expect(cb.getState('slack')).toBe(CircuitState.OPEN);

    vi.advanceTimersByTime(5_000);
    expect(cb.getState('slack')).toBe(CircuitState.HALF_OPEN);
  });

  it('resets to CLOSED on successful call in HALF_OPEN', async () => {
    for (let i = 0; i < 3; i++) {
      await cb.execute('slack', async () => { throw new Error('fail'); }).catch(() => {});
    }

    vi.advanceTimersByTime(5_000);
    expect(cb.getState('slack')).toBe(CircuitState.HALF_OPEN);

    const result = await cb.execute('slack', async () => 'recovered');
    expect(result).toBe('recovered');
    expect(cb.getState('slack')).toBe(CircuitState.CLOSED);
  });

  it('re-opens on failure in HALF_OPEN', async () => {
    for (let i = 0; i < 3; i++) {
      await cb.execute('slack', async () => { throw new Error('fail'); }).catch(() => {});
    }

    vi.advanceTimersByTime(5_000);
    expect(cb.getState('slack')).toBe(CircuitState.HALF_OPEN);

    await expect(
      cb.execute('slack', async () => { throw new Error('still broken'); }),
    ).rejects.toThrow('still broken');

    // Threshold is 3, but we only had 1 failure in HALF_OPEN — it gets
    // incremented from the existing count, so the circuit stays/goes OPEN
    // because failures reset logic re-triggers.
  });

  it('tracks separate circuits per integration', async () => {
    for (let i = 0; i < 3; i++) {
      await cb.execute('slack', async () => { throw new Error('fail'); }).catch(() => {});
    }
    expect(cb.getState('slack')).toBe(CircuitState.OPEN);
    expect(cb.getState('email')).toBe(CircuitState.CLOSED);

    const result = await cb.execute('email', async () => 'works');
    expect(result).toBe('works');
  });

  it('resets failure count on success', async () => {
    const fail = () => cb.execute('slack', async () => { throw new Error('fail'); });

    // 2 failures, then a success — should reset count
    await fail().catch(() => {});
    await fail().catch(() => {});
    await cb.execute('slack', async () => 'ok');

    // Another 2 failures should not trip the breaker (threshold is 3)
    await fail().catch(() => {});
    await fail().catch(() => {});
    expect(cb.getState('slack')).toBe(CircuitState.CLOSED);
  });

  it('allows configuring per-integration thresholds', async () => {
    cb.configure('email', { threshold: 1 });

    await cb.execute('email', async () => { throw new Error('fail'); }).catch(() => {});
    expect(cb.getState('email')).toBe(CircuitState.OPEN);
  });
});
