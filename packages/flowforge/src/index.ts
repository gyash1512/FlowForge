// SDK — workflow DSL
export { defineNode } from '@flowforge/sdk';
export { defineAgentNode } from '@flowforge/sdk';
export { workflow } from '@flowforge/sdk';

// Shared types & errors
export type {
  NodeDefinition,
  NodeContext,
  NodeCategory,
  WorkflowDefinition,
  WorkflowStep,
  WorkflowEvent,
  WorkflowMetadata,
  TriggerDefinition,
  TriggerType,
  RunRecord,
  RunStatus,
  StepRecord,
  StepStatus,
  RetryConfig,
  AIContext,
  AIRequestParams,
  AIToolDef,
  AITextResponse,
  AIStreamResponse,
  AIObjectResponse,
  AIEmbedParams,
  AIEmbedResponse,
  AgentNodeOptions,
  AgentToolDef,
  IntegrationAdaptor,
  DataAdaptor,
  IntegrationConfig,
  WorkerConfig,
  Logger,
} from '@flowforge/shared';

export {
  FlowForgeError,
  NodeExecutionError,
  NodeTimeoutError,
  ValidationError,
  RetryExhaustedError,
  WorkflowNotFoundError,
  WorkflowTimeoutError,
  IntegrationError,
  CircuitBreakerOpenError,
  RateLimitError,
} from '@flowforge/shared';
