import { describe, it, expect } from 'vitest';
import {
  FlowForgeError,
  WorkflowNotFoundError,
  RunNotFoundError,
  NodeExecutionError,
  NodeTimeoutError,
  ValidationError,
  RetryExhaustedError,
  IntegrationError,
  CircuitBreakerOpenError,
  RateLimitError,
  CheckpointError,
  CycleDetectedError,
} from '../errors.js';

describe('FlowForgeError', () => {
  it('creates error with code and status', () => {
    const err = new FlowForgeError('test', 'TEST', 400);
    expect(err.message).toBe('test');
    expect(err.code).toBe('TEST');
    expect(err.statusCode).toBe(400);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('WorkflowNotFoundError', () => {
  it('has 404 status', () => {
    const err = new WorkflowNotFoundError('wf_123');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('WORKFLOW_NOT_FOUND');
  });
});

describe('RunNotFoundError', () => {
  it('has 404 status', () => {
    const err = new RunNotFoundError('run_123');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('RUN_NOT_FOUND');
  });
});

describe('NodeExecutionError', () => {
  it('wraps cause', () => {
    const cause = new Error('boom');
    const err = new NodeExecutionError('my-node', cause);
    expect(err.message).toContain('boom');
    expect(err.cause).toBe(cause);
  });
});

describe('NodeTimeoutError', () => {
  it('has 408 status', () => {
    const err = new NodeTimeoutError('my-node', 5000);
    expect(err.statusCode).toBe(408);
    expect(err.details).toEqual({ nodeName: 'my-node', timeoutMs: 5000 });
  });
});

describe('ValidationError', () => {
  it('has 400 status', () => {
    const err = new ValidationError('bad input');
    expect(err.statusCode).toBe(400);
  });
});

describe('RetryExhaustedError', () => {
  it('includes attempts in details', () => {
    const err = new RetryExhaustedError('my-node', 3);
    expect(err.details).toEqual({ nodeName: 'my-node', maxAttempts: 3 });
  });
});

describe('IntegrationError', () => {
  it('has 502 status', () => {
    const err = new IntegrationError('slack', 'connection failed');
    expect(err.statusCode).toBe(502);
    expect(err.details).toEqual({ integration: 'slack' });
  });
});

describe('CircuitBreakerOpenError', () => {
  it('has 503 status', () => {
    const err = new CircuitBreakerOpenError('slack');
    expect(err.statusCode).toBe(503);
  });
});

describe('RateLimitError', () => {
  it('has 429 status', () => {
    const err = new RateLimitError('github', 5000);
    expect(err.statusCode).toBe(429);
    expect(err.details).toEqual({ integration: 'github', retryAfterMs: 5000 });
  });
});

describe('CheckpointError', () => {
  it('includes runId', () => {
    const err = new CheckpointError('run_123', 'save failed');
    expect(err.code).toBe('CHECKPOINT_ERROR');
    expect(err.details).toEqual({ runId: 'run_123' });
  });
});

describe('CycleDetectedError', () => {
  it('is a ValidationError', () => {
    const err = new CycleDetectedError(['a', 'b', 'a']);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.statusCode).toBe(400);
  });
});
