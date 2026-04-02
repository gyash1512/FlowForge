import type { Logger } from '@flowforge/shared';

export interface LogCall {
  level: 'info' | 'warn' | 'error' | 'debug';
  args: unknown[];
}

/**
 * MockLogger implements the Logger interface and records all calls for assertion.
 */
export class MockLogger implements Logger {
  public calls: LogCall[] = [];
  private bindings: Record<string, unknown>;

  constructor(bindings: Record<string, unknown> = {}) {
    this.bindings = bindings;
  }

  info(...args: unknown[]): void {
    this.calls.push({ level: 'info', args });
  }

  warn(...args: unknown[]): void {
    this.calls.push({ level: 'warn', args });
  }

  error(...args: unknown[]): void {
    this.calls.push({ level: 'error', args });
  }

  debug(...args: unknown[]): void {
    this.calls.push({ level: 'debug', args });
  }

  child(bindings: Record<string, unknown>): MockLogger {
    return new MockLogger({ ...this.bindings, ...bindings });
  }

  /** Get all calls for a specific log level. */
  getCalls(level: LogCall['level']): LogCall[] {
    return this.calls.filter((c) => c.level === level);
  }

  /** Check if any call contains the given message substring. */
  hasMessage(substring: string): boolean {
    return this.calls.some((c) =>
      c.args.some((arg) => typeof arg === 'string' && arg.includes(substring)),
    );
  }

  /** Reset all recorded calls. */
  reset(): void {
    this.calls = [];
  }
}
