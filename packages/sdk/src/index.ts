export { defineNode } from './define-node.js';
export type { DefineNodeInput } from './define-node.js';
export { defineAgentNode } from './define-agent-node.js';
export { workflow, WorkflowBuilder } from './workflow-builder.js';
export type {
  NodeStepOptions,
  ParallelOptions,
  IfOptions,
  ForEachOptions,
  SwitchOptions,
  WhileOptions,
} from './workflow-builder.js';

// Re-export core types from shared
export type {
  NodeDefinition,
  NodeContext,
  WorkflowDefinition,
  WorkflowStep,
  ControlFlowStep,
  TriggerDefinition,
  RetryConfig,
  WorkflowEvent,
  WorkflowMetadata,
  AIContext,
  AgentNodeOptions,
  AgentToolDef,
  StepContext,
  RunRecord,
  StepRecord,
  Checkpoint,
  EventRecord,
  Logger,
  StateStore,
  DataAdaptor,
  IntegrationAdaptor,
  WorkerConfig,
  IntegrationConfig,
  WorkflowId,
  RunId,
  StepId,
  NodeId,
  EventId,
  WorkflowSummary,
  RunFilter,
  MetricsSnapshot,
} from '@flowforge/shared';

export {
  RunStatus,
  StepStatus,
  NodeCategory,
  TriggerType,
} from '@flowforge/shared';
