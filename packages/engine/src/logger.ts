import type { Logger } from '@flowforge/shared';

export class ConsoleLogger implements Logger {
  private bindings: Record<string, unknown>;

  constructor(bindings: Record<string, unknown> = {}) {
    this.bindings = bindings;
  }

  private format(level: string, msg: string, args: unknown[]): string {
    const prefix = Object.keys(this.bindings).length
      ? `[${Object.entries(this.bindings)
          .map(([k, v]) => `${k}=${v}`)
          .join(' ')}] `
      : '';
    const suffix = args.length ? ` ${args.map((a) => JSON.stringify(a)).join(' ')}` : '';
    return `${new Date().toISOString()} ${level.toUpperCase()} ${prefix}${msg}${suffix}`;
  }

  info(msgOrObj: string | Record<string, unknown>, ...args: unknown[]): void {
    if (typeof msgOrObj === 'object') {
      const [msg, ...rest] = args;
      console.log(this.format('info', String(msg ?? ''), rest));
    } else {
      console.log(this.format('info', msgOrObj, args));
    }
  }

  warn(msgOrObj: string | Record<string, unknown>, ...args: unknown[]): void {
    if (typeof msgOrObj === 'object') {
      const [msg, ...rest] = args;
      console.warn(this.format('warn', String(msg ?? ''), rest));
    } else {
      console.warn(this.format('warn', msgOrObj, args));
    }
  }

  error(msgOrObj: string | Record<string, unknown>, ...args: unknown[]): void {
    if (typeof msgOrObj === 'object') {
      const [msg, ...rest] = args;
      console.error(this.format('error', String(msg ?? ''), rest));
    } else {
      console.error(this.format('error', msgOrObj, args));
    }
  }

  debug(msgOrObj: string | Record<string, unknown>, ...args: unknown[]): void {
    if (typeof msgOrObj === 'object') {
      const [msg, ...rest] = args;
      console.debug(this.format('debug', String(msg ?? ''), rest));
    } else {
      console.debug(this.format('debug', msgOrObj, args));
    }
  }

  child(bindings: Record<string, unknown>): Logger {
    return new ConsoleLogger({ ...this.bindings, ...bindings });
  }
}

export class NoopLogger implements Logger {
  info(): void {}
  warn(): void {}
  error(): void {}
  debug(): void {}
  child(): Logger {
    return this;
  }
}
