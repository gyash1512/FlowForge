export class FlowForgeError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode = 500,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'FlowForgeError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class WorkflowNotFoundError extends FlowForgeError {
  constructor(workflowId: string) {
    super(`Workflow not found: ${workflowId}`, 'WORKFLOW_NOT_FOUND', 404);
  }
}

export class RunNotFoundError extends FlowForgeError {
  constructor(runId: string) {
    super(`Run not found: ${runId}`, 'RUN_NOT_FOUND', 404);
  }
}

export class NodeExecutionError extends FlowForgeError {
  constructor(nodeName: string, cause?: Error) {
    super(
      `Node execution failed: ${nodeName}${cause ? ` — ${cause.message}` : ''}`,
      'NODE_EXECUTION_FAILED',
      500,
      { nodeName, cause: cause?.message },
    );
    if (cause) this.cause = cause;
  }
}

export class NodeTimeoutError extends FlowForgeError {
  constructor(nodeName: string, timeoutMs: number) {
    super(
      `Node ${nodeName} timed out after ${timeoutMs}ms`,
      'NODE_TIMEOUT',
      408,
      { nodeName, timeoutMs },
    );
  }
}

export class ValidationError extends FlowForgeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class RetryExhaustedError extends FlowForgeError {
  constructor(nodeName: string, maxAttempts: number) {
    super(
      `Node ${nodeName} exhausted all ${maxAttempts} retry attempts`,
      'RETRY_EXHAUSTED',
      500,
      { nodeName, maxAttempts },
    );
  }
}

export class WorkflowTimeoutError extends FlowForgeError {
  constructor(workflowId: string, timeoutMs: number) {
    super(
      `Workflow ${workflowId} timed out after ${timeoutMs}ms`,
      'WORKFLOW_TIMEOUT',
      408,
      { workflowId, timeoutMs },
    );
  }
}

export class IntegrationError extends FlowForgeError {
  constructor(integration: string, message: string) {
    super(
      `Integration error (${integration}): ${message}`,
      'INTEGRATION_ERROR',
      502,
      { integration },
    );
  }
}

export class CircuitBreakerOpenError extends FlowForgeError {
  constructor(integration: string) {
    super(
      `Circuit breaker open for integration: ${integration}`,
      'CIRCUIT_BREAKER_OPEN',
      503,
      { integration },
    );
  }
}

export class RateLimitError extends FlowForgeError {
  constructor(integration: string, retryAfterMs?: number) {
    super(
      `Rate limit exceeded for integration: ${integration}`,
      'RATE_LIMIT_EXCEEDED',
      429,
      { integration, retryAfterMs },
    );
  }
}

export class CheckpointError extends FlowForgeError {
  constructor(runId: string, message: string) {
    super(
      `Checkpoint error for run ${runId}: ${message}`,
      'CHECKPOINT_ERROR',
      500,
      { runId },
    );
  }
}

export class CycleDetectedError extends ValidationError {
  constructor(nodes: string[]) {
    super(`Cycle detected in workflow: ${nodes.join(' → ')}`, { nodes });
  }
}
