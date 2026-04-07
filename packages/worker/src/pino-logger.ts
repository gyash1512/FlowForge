// ────────────────────────────────────────────────────────────────
// Pino-based Logger
// ────────────────────────────────────────────────────────────────

import type { Logger } from '@flowforgejs/shared';
import pino from 'pino';

export interface PinoLoggerOptions {
  level?: string;
  name?: string;
}

/**
 * A Logger implementation backed by pino.
 *
 * Because pino may not be installed, construction goes through
 * `createPinoLogger()` which handles the fallback.  This class is
 * exported mainly for type-checking and testing purposes.
 *
 * Pino's LogFn type uses complex template-literal overloads that are
 * difficult to satisfy generically. We bridge the gap by using pino's
 * object-first calling convention for both cases: when the Logger
 * receives a string message we wrap it in pino's (msg) form; when it
 * receives an object + message we use pino's (obj, msg) form.
 */
export class PinoLogger implements Logger {
  private readonly pinoInstance: pino.Logger;

  constructor(pinoInstance: pino.Logger) {
    this.pinoInstance = pinoInstance;
  }

  info(msg: string, ...args: unknown[]): void;
  info(obj: Record<string, unknown>, msg: string, ...args: unknown[]): void;
  info(msgOrObj: string | Record<string, unknown>, ...args: unknown[]): void {
    if (typeof msgOrObj === 'object') {
      const [msg] = args;
      this.pinoInstance.info(msgOrObj, typeof msg === 'string' ? msg : undefined);
    } else {
      this.pinoInstance.info(msgOrObj);
    }
  }

  warn(msg: string, ...args: unknown[]): void;
  warn(obj: Record<string, unknown>, msg: string, ...args: unknown[]): void;
  warn(msgOrObj: string | Record<string, unknown>, ...args: unknown[]): void {
    if (typeof msgOrObj === 'object') {
      const [msg] = args;
      this.pinoInstance.warn(msgOrObj, typeof msg === 'string' ? msg : undefined);
    } else {
      this.pinoInstance.warn(msgOrObj);
    }
  }

  error(msg: string, ...args: unknown[]): void;
  error(obj: Record<string, unknown>, msg: string, ...args: unknown[]): void;
  error(msgOrObj: string | Record<string, unknown>, ...args: unknown[]): void {
    if (typeof msgOrObj === 'object') {
      const [msg] = args;
      this.pinoInstance.error(msgOrObj, typeof msg === 'string' ? msg : undefined);
    } else {
      this.pinoInstance.error(msgOrObj);
    }
  }

  debug(msg: string, ...args: unknown[]): void;
  debug(obj: Record<string, unknown>, msg: string, ...args: unknown[]): void;
  debug(msgOrObj: string | Record<string, unknown>, ...args: unknown[]): void {
    if (typeof msgOrObj === 'object') {
      const [msg] = args;
      this.pinoInstance.debug(msgOrObj, typeof msg === 'string' ? msg : undefined);
    } else {
      this.pinoInstance.debug(msgOrObj);
    }
  }

  child(bindings: Record<string, unknown>): Logger {
    return new PinoLogger(this.pinoInstance.child(bindings));
  }
}

/**
 * Create a Logger backed by pino.
 */
export function createPinoLogger(options?: PinoLoggerOptions): Logger {
  const instance = pino({
    level: options?.level ?? 'info',
    name: options?.name ?? 'flowforge-worker',
  });
  return new PinoLogger(instance);
}
