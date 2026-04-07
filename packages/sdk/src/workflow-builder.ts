import type {
  WorkflowDefinition,
  WorkflowStep,
  ControlFlowStep,
  NodeDefinition,
  TriggerDefinition,
  RetryConfig,
  StepContext,
  ParallelStep,
  ConditionalStep,
  ForEachStep,
  SwitchStep,
  WhileStep,
} from '@flowforgejs/shared';

// ────────────────────────────────────────────────────────────────
// Step options when adding a node to a workflow
// ────────────────────────────────────────────────────────────────
export interface NodeStepOptions {
  config?: Record<string, unknown>;
  input?: ((ctx: StepContext) => unknown) | Record<string, unknown>;
  when?: (ctx: StepContext) => boolean | Promise<boolean>;
  dependsOn?: string[];
}

export interface ParallelOptions {
  items: (ctx: StepContext) => unknown[];
  concurrency?: number;
  pipeline: (item: unknown) => Array<[string, NodeDefinition, NodeStepOptions?]>;
}

export interface IfOptions {
  condition: (ctx: StepContext) => boolean | Promise<boolean>;
  then: Array<[string, NodeDefinition, NodeStepOptions?]>;
  else?: Array<[string, NodeDefinition, NodeStepOptions?]>;
}

export interface ForEachOptions {
  items: (ctx: StepContext) => unknown[];
  concurrency?: number;
  pipeline: (item: unknown, index: number) => Array<[string, NodeDefinition, NodeStepOptions?]>;
}

export interface SwitchOptions {
  value: (ctx: StepContext) => unknown;
  cases: Record<string, Array<[string, NodeDefinition, NodeStepOptions?]>>;
  default?: Array<[string, NodeDefinition, NodeStepOptions?]>;
}

export interface WhileOptions {
  condition: (ctx: StepContext) => boolean | Promise<boolean>;
  maxIterations: number;
  pipeline: Array<[string, NodeDefinition, NodeStepOptions?]>;
}

function toWorkflowSteps(steps: Array<[string, NodeDefinition, NodeStepOptions?]>): WorkflowStep[] {
  return steps.map(([name, node, opts]) => ({
    name,
    node,
    config: opts?.config,
    input: opts?.input,
    when: opts?.when,
    dependsOn: opts?.dependsOn,
  }));
}

type InlineHandler = (ctx: StepContext) => unknown | Promise<unknown>;

// ────────────────────────────────────────────────────────────────
// Workflow Builder
// ────────────────────────────────────────────────────────────────
export class WorkflowBuilder {
  private _id: string;
  private _name: string;
  private _version = '1.0.0';
  private _description?: string;
  private _trigger?: TriggerDefinition;
  private _steps: Array<WorkflowStep | ControlFlowStep> = [];
  private _metadata?: Record<string, unknown>;
  private _timeout?: number;
  private _retry?: RetryConfig;

  constructor(id: string) {
    this._id = id;
    this._name = id;
  }

  name(name: string): this {
    this._name = name;
    return this;
  }

  version(version: string): this {
    this._version = version;
    return this;
  }

  description(desc: string): this {
    this._description = desc;
    return this;
  }

  trigger(trigger: TriggerDefinition): this {
    this._trigger = trigger;
    return this;
  }

  timeout(ms: number): this {
    this._timeout = ms;
    return this;
  }

  retry(config: Partial<RetryConfig> & { maxAttempts: number }): this {
    this._retry = {
      backoff: 'exponential',
      delayMs: 1000,
      ...config,
    };
    return this;
  }

  metadata(meta: Record<string, unknown>): this {
    this._metadata = meta;
    return this;
  }

  /**
   * Add a node step.
   * - node("step-name", nodeDefinition, { config, input, when })
   * - node("step-name", inlineHandler) — wraps an inline function as a custom node
   */
  node(
    stepName: string,
    nodeOrHandler: NodeDefinition | InlineHandler,
    options?: NodeStepOptions,
  ): this {
    const nodeDef =
      typeof nodeOrHandler === 'function' ? inlineNode(stepName, nodeOrHandler) : nodeOrHandler;

    const step: WorkflowStep = {
      name: stepName,
      node: nodeDef,
      config: options?.config,
      input: options?.input,
      when: options?.when,
      dependsOn: options?.dependsOn,
    };

    this._steps.push(step);
    return this;
  }

  /** Fan-out parallel execution. */
  parallel(stepName: string, options: ParallelOptions): this {
    const step: ParallelStep = {
      type: 'parallel',
      name: stepName,
      items: options.items,
      concurrency: options.concurrency,
      pipeline: (item) => toWorkflowSteps(options.pipeline(item)),
    };
    this._steps.push(step);
    return this;
  }

  /** Conditional branching. */
  if(stepName: string, options: IfOptions): this {
    const step: ConditionalStep = {
      type: 'if',
      name: stepName,
      condition: options.condition,
      then: toWorkflowSteps(options.then),
      else: options.else ? toWorkflowSteps(options.else) : undefined,
    };
    this._steps.push(step);
    return this;
  }

  /** Iterate over items with concurrency control. */
  forEach(stepName: string, options: ForEachOptions): this {
    const step: ForEachStep = {
      type: 'forEach',
      name: stepName,
      items: options.items,
      concurrency: options.concurrency,
      pipeline: (item, index) => toWorkflowSteps(options.pipeline(item, index)),
    };
    this._steps.push(step);
    return this;
  }

  /** Multi-way branching. */
  switch(stepName: string, options: SwitchOptions): this {
    const cases: Record<string, WorkflowStep[]> = {};
    for (const [key, steps] of Object.entries(options.cases)) {
      cases[key] = toWorkflowSteps(steps);
    }
    const step: SwitchStep = {
      type: 'switch',
      name: stepName,
      value: options.value,
      cases,
      default: options.default ? toWorkflowSteps(options.default) : undefined,
    };
    this._steps.push(step);
    return this;
  }

  /** Repeat while condition is true. */
  while(stepName: string, options: WhileOptions): this {
    const step: WhileStep = {
      type: 'while',
      name: stepName,
      condition: options.condition,
      maxIterations: options.maxIterations,
      pipeline: toWorkflowSteps(options.pipeline),
    };
    this._steps.push(step);
    return this;
  }

  build(): WorkflowDefinition {
    if (!this._trigger) {
      throw new Error(`Workflow "${this._id}" requires a trigger`);
    }
    if (this._steps.length === 0) {
      throw new Error(`Workflow "${this._id}" requires at least one step`);
    }

    return {
      id: this._id,
      name: this._name,
      version: this._version,
      description: this._description,
      trigger: this._trigger,
      steps: this._steps,
      metadata: this._metadata,
      timeout: this._timeout,
      retry: this._retry,
    };
  }
}

/** Create a new workflow builder. */
export function workflow(id: string): WorkflowBuilder {
  return new WorkflowBuilder(id);
}

// ────────────────────────────────────────────────────────────────
// Inline node helper — wraps a plain function as a NodeDefinition
// ────────────────────────────────────────────────────────────────
import { z } from 'zod';

function inlineNode(name: string, handler: InlineHandler): NodeDefinition {
  return {
    name: `inline/${name}`,
    version: '1.0.0',
    description: `Inline node: ${name}`,
    category: 'custom',
    inputSchema: z.any(),
    outputSchema: z.any(),
    configSchema: z.any(),
    handler: async (ctx) => handler({ event: ctx.event, steps: ctx.steps }),
  };
}
