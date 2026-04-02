import { Cron } from 'croner';
import type { Logger } from '@flowforge/shared';

export type CronCallback = () => void | Promise<void>;

interface CronEntry {
  workflowId: string;
  expression: string;
  job: Cron;
  callback: CronCallback;
}

export class CronScheduler {
  private jobs = new Map<string, CronEntry>();
  private running = false;
  private logger: Logger | undefined;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * Register a cron-triggered workflow.
   */
  register(
    workflowId: string,
    cronExpression: string,
    callback: CronCallback,
  ): void {
    // Remove existing job for this workflow if present
    this.unregister(workflowId);

    const job = new Cron(cronExpression, {
      paused: !this.running,
      catch: (err: unknown) => {
        this.logger?.error(
          `Cron job error for workflow ${workflowId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      },
    }, async () => {
      this.logger?.debug(`Cron triggered for workflow ${workflowId}`);
      try {
        await callback();
      } catch (err) {
        this.logger?.error(
          `Cron callback error for workflow ${workflowId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });

    this.jobs.set(workflowId, {
      workflowId,
      expression: cronExpression,
      job,
      callback,
    });

    this.logger?.info(
      `Cron registered for workflow ${workflowId}: ${cronExpression}`,
    );
  }

  /**
   * Unregister a workflow's cron job.
   */
  unregister(workflowId: string): boolean {
    const entry = this.jobs.get(workflowId);
    if (!entry) return false;

    entry.job.stop();
    this.jobs.delete(workflowId);
    this.logger?.info(`Cron unregistered for workflow ${workflowId}`);
    return true;
  }

  /**
   * Start all registered cron jobs.
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    for (const entry of this.jobs.values()) {
      entry.job.resume();
    }

    this.logger?.info(`CronScheduler started with ${this.jobs.size} job(s)`);
  }

  /**
   * Stop all cron jobs.
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    for (const entry of this.jobs.values()) {
      entry.job.stop();
    }

    this.logger?.info('CronScheduler stopped');
  }

  /**
   * List all registered workflow IDs with their cron expressions.
   */
  list(): Array<{ workflowId: string; expression: string }> {
    return [...this.jobs.values()].map((e) => ({
      workflowId: e.workflowId,
      expression: e.expression,
    }));
  }

  /**
   * Check if a specific workflow has a cron job registered.
   */
  has(workflowId: string): boolean {
    return this.jobs.has(workflowId);
  }

  get isRunning(): boolean {
    return this.running;
  }

  get size(): number {
    return this.jobs.size;
  }
}
