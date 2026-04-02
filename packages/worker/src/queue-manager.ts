// ────────────────────────────────────────────────────────────────
// BullMQ Queue Manager
// ────────────────────────────────────────────────────────────────

import { Queue } from 'bullmq';

export interface QueueManagerOptions {
  redis: {
    host: string;
    port: number;
    password?: string;
  };
}

export class QueueManager {
  private queue: Queue;

  constructor(options: QueueManagerOptions) {
    this.queue = new Queue('flowforge-workflows', {
      connection: {
        host: options.redis.host,
        port: options.redis.port,
        password: options.redis.password,
      },
    });
  }

  /**
   * Enqueue a workflow execution.  Returns the job ID.
   */
  async enqueue(
    workflowId: string,
    input: unknown,
    options?: { priority?: number; delay?: number },
  ): Promise<string> {
    const job = await this.queue.add(
      workflowId,
      { workflowId, input },
      {
        priority: options?.priority,
        delay: options?.delay,
      },
    );
    return String(job.id);
  }

  /**
   * Retrieve a job by its ID.
   */
  async getJob(jobId: string): Promise<unknown> {
    const job = await this.queue.getJob(jobId);
    if (!job) return undefined;
    return {
      id: job.id,
      data: job.data,
      status: await job.getState(),
    };
  }

  /**
   * Gracefully close the queue connection.
   */
  async close(): Promise<void> {
    await this.queue.close();
  }
}
