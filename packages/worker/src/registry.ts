import type { WorkflowDefinition, Logger } from '@flowforgejs/shared';
import { WorkflowNotFoundError } from '@flowforgejs/shared';

export class WorkflowRegistry {
  private workflows = new Map<string, WorkflowDefinition>();
  private logger: Logger | undefined;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  register(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow);
    this.logger?.info(`Registry: registered workflow "${workflow.name}" (${workflow.id})`);
  }

  get(workflowId: string): WorkflowDefinition {
    const wf = this.workflows.get(workflowId);
    if (!wf) {
      throw new WorkflowNotFoundError(workflowId);
    }
    return wf;
  }

  find(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  has(workflowId: string): boolean {
    return this.workflows.has(workflowId);
  }

  list(): WorkflowDefinition[] {
    return [...this.workflows.values()];
  }

  unregister(workflowId: string): boolean {
    const existed = this.workflows.delete(workflowId);
    if (existed) {
      this.logger?.info(`Registry: unregistered workflow ${workflowId}`);
    }
    return existed;
  }

  clear(): void {
    this.workflows.clear();
    this.logger?.info('Registry: cleared all workflows');
  }

  get size(): number {
    return this.workflows.size;
  }

  /**
   * Find all workflows whose trigger matches a given event type.
   */
  findByEvent(eventType: string): WorkflowDefinition[] {
    return this.list().filter(
      (wf) => wf.trigger.type === 'event' && wf.trigger.event === eventType,
    );
  }

  /**
   * Find all workflows with cron triggers.
   */
  findCronWorkflows(): WorkflowDefinition[] {
    return this.list().filter((wf) => wf.trigger.type === 'cron');
  }
}
