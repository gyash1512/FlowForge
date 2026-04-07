import type {
  WorkflowDefinition,
  RunRecord,
  Logger,
  DataAdaptor,
  IntegrationAdaptor,
  AIContext,
} from '@flowforgejs/shared';
import { WorkflowNotFoundError, RunStatus } from '@flowforgejs/shared';
import { Runner } from './runner.js';
import type { RuntimeProviders } from './runner.js';
import { EventBus } from './event-bus.js';
import { ConsoleLogger } from './logger.js';
import { DataAdaptorManager, IntegrationManager } from './adaptor-manager.js';
import { createNoopAIProvider } from './ai-provider.js';

export interface EngineOptions {
  logger?: Logger;
  /** Provide an AI context built from createAIProvider({ generateText, ... }) */
  ai?: AIContext;
}

export class Engine {
  private workflows = new Map<string, WorkflowDefinition>();
  private runs = new Map<string, RunRecord>();
  private eventBus = new EventBus();
  private runner: Runner;
  private logger: Logger;

  /** Register data adaptors (postgres, redis, etc.) to enable ctx.pull()/ctx.push() */
  readonly data: DataAdaptorManager;
  /** Register integration adaptors (slack, github, etc.) to enable ctx.integrate() */
  readonly integrations: IntegrationManager;

  constructor(options: EngineOptions = {}) {
    this.logger = options.logger ?? new ConsoleLogger();
    this.data = new DataAdaptorManager(this.logger);
    this.integrations = new IntegrationManager(this.logger);

    // Build AI context — user must pass the AI SDK functions explicitly, no magic
    const aiCtx: AIContext =
      options.ai && typeof options.ai === 'object' ? options.ai : createNoopAIProvider();

    const providers: RuntimeProviders = {
      pull: (source, params) => this.data.pull(source, params),
      push: (target, params) => this.data.push(target, params),
      integrate: (name, action, params) => this.integrations.execute(name, action, params),
      ai: aiCtx,
    };

    this.runner = new Runner({ logger: this.logger, providers });
  }

  /** Register a data adaptor to enable ctx.pull('name')/ctx.push('name') in node handlers */
  registerAdaptor(adaptor: DataAdaptor): void {
    this.data.register(adaptor);
  }

  /** Register an integration adaptor to enable ctx.integrate('name', action, params) */
  registerIntegration(adaptor: IntegrationAdaptor): void {
    this.integrations.register(adaptor);
  }

  register(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow);
    this.logger.info(`Registered workflow: ${workflow.id}`);

    if (workflow.trigger.type === 'event' && workflow.trigger.event) {
      this.eventBus.on(workflow.trigger.event, async (payload) => {
        await this.trigger(workflow.id, payload);
      });
    }
  }

  unregister(workflowId: string): void {
    this.workflows.delete(workflowId);
    this.logger.info(`Unregistered workflow: ${workflowId}`);
  }

  getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  listWorkflows(): WorkflowDefinition[] {
    return [...this.workflows.values()];
  }

  async trigger(workflowId: string, input?: unknown): Promise<RunRecord> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new WorkflowNotFoundError(workflowId);
    }

    const run = await this.runner.execute(workflow, input);
    this.runs.set(run.id, run);
    return run;
  }

  async emit(event: string, payload?: unknown): Promise<RunRecord[]> {
    const matchingWorkflows = [...this.workflows.values()].filter(
      (wf) => wf.trigger.type === 'event' && wf.trigger.event === event,
    );

    const runs: RunRecord[] = [];
    for (const wf of matchingWorkflows) {
      const run = await this.trigger(wf.id, payload);
      runs.push(run);
    }
    return runs;
  }

  getRun(runId: string): RunRecord | undefined {
    return this.runs.get(runId);
  }

  listRuns(workflowId?: string): RunRecord[] {
    const all = [...this.runs.values()];
    if (workflowId) {
      return all.filter((r) => r.workflowId === workflowId);
    }
    return all;
  }

  cancelRun(runId: string): void {
    const run = this.runs.get(runId);
    if (run && run.status === RunStatus.RUNNING) {
      run.status = RunStatus.CANCELLED;
      run.updatedAt = new Date();
    }
  }

  async destroy(): Promise<void> {
    await this.data.destroyAll();
    await this.integrations.destroyAll();
    this.eventBus.removeAll();
  }

  get bus(): EventBus {
    return this.eventBus;
  }
}
