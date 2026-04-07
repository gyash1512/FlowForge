import {
  CircuitBreakerOpenError,
  CIRCUIT_BREAKER_THRESHOLD,
  CIRCUIT_BREAKER_TIMEOUT_MS,
  CIRCUIT_BREAKER_RESET_MS,
} from '@flowforgejs/shared';

export const CircuitState = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
} as const;
export type CircuitState = (typeof CircuitState)[keyof typeof CircuitState];

interface CircuitConfig {
  threshold: number;
  timeoutMs: number;
  resetMs: number;
}

interface CircuitEntry {
  state: CircuitState;
  failures: number;
  lastFailure: number;
  config: CircuitConfig;
}

export class CircuitBreaker {
  private readonly circuits = new Map<string, CircuitEntry>();
  private readonly defaultConfig: CircuitConfig;

  constructor(config?: Partial<CircuitConfig>) {
    this.defaultConfig = {
      threshold: config?.threshold ?? CIRCUIT_BREAKER_THRESHOLD,
      timeoutMs: config?.timeoutMs ?? CIRCUIT_BREAKER_TIMEOUT_MS,
      resetMs: config?.resetMs ?? CIRCUIT_BREAKER_RESET_MS,
    };
  }

  configure(name: string, config: Partial<CircuitConfig>): void {
    const entry = this.getOrCreate(name);
    entry.config = { ...entry.config, ...config };
  }

  getState(name: string): CircuitState {
    const entry = this.circuits.get(name);
    if (!entry) return CircuitState.CLOSED;
    this.maybeTransition(entry);
    return entry.state;
  }

  async execute<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const entry = this.getOrCreate(name);
    this.maybeTransition(entry);

    if (entry.state === CircuitState.OPEN) {
      throw new CircuitBreakerOpenError(name);
    }

    try {
      const result = await fn();
      this.onSuccess(entry);
      return result;
    } catch (error) {
      this.onFailure(entry);
      throw error;
    }
  }

  private getOrCreate(name: string): CircuitEntry {
    let entry = this.circuits.get(name);
    if (!entry) {
      entry = {
        state: CircuitState.CLOSED,
        failures: 0,
        lastFailure: 0,
        config: { ...this.defaultConfig },
      };
      this.circuits.set(name, entry);
    }
    return entry;
  }

  private maybeTransition(entry: CircuitEntry): void {
    if (entry.state !== CircuitState.OPEN) return;

    const elapsed = Date.now() - entry.lastFailure;
    if (elapsed >= entry.config.timeoutMs) {
      entry.state = CircuitState.HALF_OPEN;
    }
  }

  private onSuccess(entry: CircuitEntry): void {
    entry.failures = 0;
    entry.state = CircuitState.CLOSED;
  }

  private onFailure(entry: CircuitEntry): void {
    entry.failures += 1;
    entry.lastFailure = Date.now();

    if (entry.failures >= entry.config.threshold) {
      entry.state = CircuitState.OPEN;
    }
  }
}
