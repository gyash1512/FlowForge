import type { DataAdaptor, IntegrationAdaptor, Logger } from '@flowforgejs/shared';
import { IntegrationError } from '@flowforgejs/shared';

/**
 * Manages data adaptors (postgres, redis, http, etc.) for ctx.pull()/ctx.push().
 * Register adaptors at engine start, then route pull/push calls to the right one.
 */
export class DataAdaptorManager {
  private adaptors = new Map<string, DataAdaptor>();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  register(adaptor: DataAdaptor): void {
    this.adaptors.set(adaptor.name, adaptor);
    this.logger.info(`Data adaptor registered: ${adaptor.name}`);
  }

  unregister(name: string): void {
    this.adaptors.delete(name);
  }

  get(name: string): DataAdaptor | undefined {
    return this.adaptors.get(name);
  }

  list(): string[] {
    return [...this.adaptors.keys()];
  }

  async pull(source: string, params: unknown): Promise<unknown> {
    const adaptor = this.adaptors.get(source);
    if (!adaptor) {
      throw new IntegrationError(
        source,
        `Data adaptor "${source}" not registered. Available: ${this.list().join(', ') || 'none'}`,
      );
    }
    return adaptor.pull(params);
  }

  async push(target: string, params: unknown): Promise<unknown> {
    const adaptor = this.adaptors.get(target);
    if (!adaptor) {
      throw new IntegrationError(
        target,
        `Data adaptor "${target}" not registered. Available: ${this.list().join(', ') || 'none'}`,
      );
    }
    return adaptor.push(params);
  }

  async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    for (const [name, adaptor] of this.adaptors) {
      try {
        results.set(name, await adaptor.healthCheck());
      } catch {
        results.set(name, false);
      }
    }
    return results;
  }

  async destroyAll(): Promise<void> {
    for (const [name, adaptor] of this.adaptors) {
      try {
        await adaptor.destroy?.();
      } catch (err) {
        this.logger.error(`Failed to destroy adaptor ${name}: ${err}`);
      }
    }
    this.adaptors.clear();
  }
}

/**
 * Manages integration adaptors (slack, github, etc.) for ctx.integrate().
 * In dev mode, runs in-process. In production, forwards to Integration Service.
 */
export class IntegrationManager {
  private adaptors = new Map<string, IntegrationAdaptor>();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  register(adaptor: IntegrationAdaptor): void {
    this.adaptors.set(adaptor.name, adaptor);
    this.logger.info(`Integration adaptor registered: ${adaptor.name}`);
  }

  unregister(name: string): void {
    this.adaptors.delete(name);
  }

  list(): string[] {
    return [...this.adaptors.keys()];
  }

  async execute(name: string, action: string, params: unknown): Promise<unknown> {
    const adaptor = this.adaptors.get(name);
    if (!adaptor) {
      throw new IntegrationError(
        name,
        `Integration "${name}" not registered. Available: ${this.list().join(', ') || 'none'}`,
      );
    }
    if (!adaptor.actions.includes(action)) {
      throw new IntegrationError(
        name,
        `Unknown action "${action}". Available: ${adaptor.actions.join(', ')}`,
      );
    }
    return adaptor.execute(action, params, '');
  }

  async destroyAll(): Promise<void> {
    for (const [name, adaptor] of this.adaptors) {
      try {
        await adaptor.destroy?.();
      } catch (err) {
        this.logger.error(`Failed to destroy integration ${name}: ${err}`);
      }
    }
    this.adaptors.clear();
  }
}
