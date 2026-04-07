import type {
  WorkflowDefinition,
  WorkflowStep,
  ControlFlowStep,
  NodeContext,
  RunRecord,
  Logger,
  WorkflowEvent,
  WorkflowMetadata,
  AIContext,
} from '@flowforgejs/shared';
import {
  RunStatus,
  NodeExecutionError,
  NodeTimeoutError,
  WorkflowTimeoutError,
  runId,
  eventId,
} from '@flowforgejs/shared';
import { resolveExecutionOrder } from './scheduler.js';
import { withRetry } from './retry.js';
import { InMemoryStateStore } from './state.js';
import { NoopLogger } from './logger.js';

export interface RuntimeProviders {
  pull?: (source: string, params: unknown) => Promise<unknown>;
  push?: (target: string, params: unknown) => Promise<unknown>;
  integrate?: (name: string, action: string, params: unknown) => Promise<unknown>;
  ai?: AIContext;
}

export interface RunnerOptions {
  logger?: Logger;
  providers?: RuntimeProviders;
}

export class Runner {
  private logger: Logger;
  private providers: RuntimeProviders;

  constructor(options: RunnerOptions = {}) {
    this.logger = options.logger ?? new NoopLogger();
    this.providers = options.providers ?? {};
  }

  async execute(workflow: WorkflowDefinition, input: unknown): Promise<RunRecord> {
    const rid = runId();
    const runLogger = this.logger.child({ workflowId: workflow.id, runId: rid });
    const now = new Date();

    const event: WorkflowEvent = {
      id: eventId(),
      type: workflow.trigger.event ?? 'manual',
      data: input,
      timestamp: now,
    };

    const run: RunRecord = {
      id: rid,
      workflowId: workflow.id,
      status: RunStatus.PENDING,
      trigger: workflow.trigger,
      input,
      createdAt: now,
      updatedAt: now,
    };

    const stepOutputs = new Map<string, unknown>();
    const store = new InMemoryStateStore();
    const abortController = new AbortController();

    let workflowTimer: ReturnType<typeof setTimeout> | undefined;
    if (workflow.timeout) {
      workflowTimer = setTimeout(() => {
        abortController.abort(new WorkflowTimeoutError(workflow.id, workflow.timeout!));
      }, workflow.timeout);
    }

    try {
      run.status = RunStatus.RUNNING;
      run.startedAt = new Date();
      run.updatedAt = new Date();
      runLogger.info('Workflow run started');

      const metadata: WorkflowMetadata = {
        runId: rid,
        workflowId: workflow.id,
        workflowName: workflow.name,
        attempt: 1,
        startedAt: run.startedAt,
      };

      await this.executeSteps(workflow.steps, {
        event,
        metadata,
        store,
        signal: abortController.signal,
        logger: runLogger,
        stepOutputs,
        workflowRetry: workflow.retry,
      });

      // Last step output is the workflow output
      const lastStep = this.getLastStepName(workflow.steps);
      run.output = lastStep ? stepOutputs.get(lastStep) : undefined;
      run.status = RunStatus.COMPLETED;
      runLogger.info('Workflow run completed');
    } catch (err) {
      run.status = RunStatus.FAILED;
      run.error = err instanceof Error ? err.message : String(err);
      runLogger.error(`Workflow run failed: ${run.error}`);
    } finally {
      if (workflowTimer) clearTimeout(workflowTimer);
      run.completedAt = new Date();
      run.updatedAt = new Date();
    }

    return run;
  }

  private async executeSteps(
    steps: Array<WorkflowStep | ControlFlowStep>,
    ctx: ExecutionContext,
  ): Promise<void> {
    // Separate workflow steps (can be topologically sorted) from control flow steps
    const workflowSteps: WorkflowStep[] = [];
    const controlFlowSteps: ControlFlowStep[] = [];
    const orderedSteps: Array<{ type: 'workflow' | 'control'; index: number }> = [];

    for (const step of steps) {
      if ('type' in step && ['parallel', 'if', 'forEach', 'switch', 'while'].includes(step.type)) {
        controlFlowSteps.push(step as ControlFlowStep);
        orderedSteps.push({ type: 'control', index: controlFlowSteps.length - 1 });
      } else {
        workflowSteps.push(step as WorkflowStep);
        orderedSteps.push({ type: 'workflow', index: workflowSteps.length - 1 });
      }
    }

    // For steps with dependencies, use topological sort
    const stepsWithDeps = workflowSteps.filter((s) => s.dependsOn?.length);
    const stepsWithoutDeps = workflowSteps.filter((s) => !s.dependsOn?.length);

    if (stepsWithDeps.length > 0) {
      const layers = resolveExecutionOrder([...stepsWithoutDeps, ...stepsWithDeps]);
      for (const layer of layers) {
        if (ctx.signal.aborted) break;
        await Promise.all(layer.map((step) => this.executeWorkflowStep(step, ctx)));
      }
      // Then execute control flow steps in order
      for (const cfStep of controlFlowSteps) {
        if (ctx.signal.aborted) break;
        await this.executeControlFlowStep(cfStep, ctx);
      }
    } else {
      // Execute in declaration order
      for (const ordered of orderedSteps) {
        if (ctx.signal.aborted) break;
        if (ordered.type === 'workflow') {
          await this.executeWorkflowStep(workflowSteps[ordered.index]!, ctx);
        } else {
          await this.executeControlFlowStep(controlFlowSteps[ordered.index]!, ctx);
        }
      }
    }
  }

  private async executeWorkflowStep(step: WorkflowStep, ctx: ExecutionContext): Promise<void> {
    const nodeLogger = ctx.logger.child({ stepName: step.name, nodeName: step.node.name });

    // Check condition
    if (step.when) {
      const shouldRun = await step.when({
        event: ctx.event,
        steps: Object.fromEntries(ctx.stepOutputs),
      });
      if (!shouldRun) {
        nodeLogger.info('Step skipped (condition false)');
        return;
      }
    }

    // Determine input
    let nodeInput: unknown;
    if (step.input) {
      if (typeof step.input === 'function') {
        nodeInput = step.input({
          event: ctx.event,
          steps: Object.fromEntries(ctx.stepOutputs),
        });
      } else {
        nodeInput = step.input;
      }
    } else {
      nodeInput = ctx.event.data;
    }

    // Validate input schema
    if (step.node.inputSchema) {
      const parsed = step.node.inputSchema.safeParse(nodeInput);
      if (parsed.success) {
        nodeInput = parsed.data;
      }
    }

    // Determine config
    const nodeConfig = step.config ?? {};
    if (step.node.configSchema) {
      const parsed = step.node.configSchema.safeParse(nodeConfig);
      if (parsed.success) {
        // use parsed config
      }
    }

    const fallbackAI: AIContext = {
      generateText: async () => ({ text: '', toolCalls: [], toolResults: [] }),
      streamText: async () => ({
        textStream: (async function* () {})(),
        text: Promise.resolve(''),
      }),
      generateObject: async () => ({ object: {} }),
      embed: async () => ({ embedding: [] }),
    };

    const providers = this.providers;

    const nodeCtx: NodeContext = {
      input: nodeInput,
      config: nodeConfig,
      event: ctx.event,
      steps: Object.fromEntries(ctx.stepOutputs),
      logger: nodeLogger,
      signal: ctx.signal,
      metadata: ctx.metadata,
      ai: providers.ai ?? fallbackAI,
      pull:
        providers.pull ??
        (async (source) => {
          throw new Error(
            `No data adaptor registered for "${source}". Register one via engine.registerAdaptor().`,
          );
        }),
      push:
        providers.push ??
        (async (target) => {
          throw new Error(
            `No data adaptor registered for "${target}". Register one via engine.registerAdaptor().`,
          );
        }),
      integrate:
        providers.integrate ??
        (async (name) => {
          throw new Error(
            `No integration adaptor registered for "${name}". Register one via engine.registerIntegration().`,
          );
        }),
      emit: async (eventName, _data) => {
        ctx.logger.info(`Event emitted: ${eventName}`);
      },
      wait: async (_eventName, _match, timeout) => {
        if (timeout) await new Promise((resolve) => setTimeout(resolve, Math.min(timeout, 5000)));
        return {};
      },
      sleep: async (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      checkpoint: async () => {
        ctx.logger.debug('Checkpoint saved');
      },
    };

    const retryConfig = step.node.retries
      ? { maxAttempts: step.node.retries, backoff: 'exponential' as const, delayMs: 1000 }
      : ctx.workflowRetry;

    const executeFn = async (_attempt: number): Promise<unknown> => {
      nodeCtx.metadata = { ...ctx.metadata, attempt: _attempt };

      if (step.node.timeout) {
        return Promise.race([
          step.node.handler(nodeCtx),
          new Promise<never>((_, reject) => {
            const timer = setTimeout(
              () => reject(new NodeTimeoutError(step.node.name, step.node.timeout!)),
              step.node.timeout!,
            );
            ctx.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
          }),
        ]);
      }
      return step.node.handler(nodeCtx);
    };

    try {
      let output: unknown;
      if (retryConfig) {
        output = await withRetry(executeFn, retryConfig, {
          nodeId: step.node.name,
          signal: ctx.signal,
        });
      } else {
        output = await executeFn(1);
      }

      // Validate output schema
      if (step.node.outputSchema) {
        const parsed = step.node.outputSchema.safeParse(output);
        if (parsed.success) {
          output = parsed.data;
        }
      }

      ctx.stepOutputs.set(step.name, output);
      nodeLogger.info(`Step completed`);
    } catch (err) {
      if (err instanceof NodeExecutionError || err instanceof NodeTimeoutError) throw err;
      throw new NodeExecutionError(step.node.name, err instanceof Error ? err : undefined);
    }
  }

  private async executeControlFlowStep(
    step: ControlFlowStep,
    ctx: ExecutionContext,
  ): Promise<void> {
    const stepCtx = { event: ctx.event, steps: Object.fromEntries(ctx.stepOutputs) };

    switch (step.type) {
      case 'if': {
        const condition = await step.condition(stepCtx);
        const branch = condition ? step.then : (step.else ?? []);
        if (branch.length > 0) {
          await this.executeSteps(branch, ctx);
        }
        break;
      }
      case 'parallel': {
        const items = step.items(stepCtx);
        const concurrency = step.concurrency ?? items.length;
        const results: unknown[] = [];

        for (let i = 0; i < items.length; i += concurrency) {
          const batch = items.slice(i, i + concurrency);
          const batchResults = await Promise.all(
            batch.map(async (item) => {
              const pipeline = step.pipeline(item);
              const subCtx = { ...ctx, stepOutputs: new Map(ctx.stepOutputs) };
              await this.executeSteps(pipeline, subCtx);
              const lastStep = pipeline[pipeline.length - 1];
              return lastStep ? subCtx.stepOutputs.get(lastStep.name) : undefined;
            }),
          );
          results.push(...batchResults);
        }
        ctx.stepOutputs.set(step.name, results);
        break;
      }
      case 'forEach': {
        const items = step.items(stepCtx);
        const concurrency = step.concurrency ?? items.length;
        const results: unknown[] = [];

        for (let i = 0; i < items.length; i += concurrency) {
          const batch = items.slice(i, i + concurrency);
          const batchResults = await Promise.all(
            batch.map(async (item, batchIdx) => {
              const pipeline = step.pipeline(item, i + batchIdx);
              const subCtx = { ...ctx, stepOutputs: new Map(ctx.stepOutputs) };
              await this.executeSteps(pipeline, subCtx);
              const lastStep = pipeline[pipeline.length - 1];
              return lastStep ? subCtx.stepOutputs.get(lastStep.name) : undefined;
            }),
          );
          results.push(...batchResults);
        }
        ctx.stepOutputs.set(step.name, results);
        break;
      }
      case 'switch': {
        const value = String(step.value(stepCtx));
        const branch = step.cases[value] ?? step.default ?? [];
        if (branch.length > 0) {
          await this.executeSteps(branch, ctx);
        }
        break;
      }
      case 'while': {
        let iteration = 0;
        while (iteration < step.maxIterations) {
          const cont = await step.condition({
            event: ctx.event,
            steps: Object.fromEntries(ctx.stepOutputs),
          });
          if (!cont) break;
          await this.executeSteps(step.pipeline, ctx);
          iteration++;
        }
        break;
      }
    }
  }

  private getLastStepName(steps: Array<WorkflowStep | ControlFlowStep>): string | undefined {
    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i]!;
      if ('node' in step) return step.name;
      if ('name' in step) return step.name;
    }
    return undefined;
  }
}

interface ExecutionContext {
  event: WorkflowEvent;
  metadata: WorkflowMetadata;
  store: InMemoryStateStore;
  signal: AbortSignal;
  logger: Logger;
  stepOutputs: Map<string, unknown>;
  workflowRetry?: WorkflowDefinition['retry'];
}
