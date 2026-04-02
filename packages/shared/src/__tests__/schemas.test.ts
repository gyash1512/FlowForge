import { describe, it, expect } from 'vitest';
import {
  retryConfigSchema,
  triggerDefinitionSchema,
  workerConfigSchema,
  integrationRequestSchema,
  runFilterSchema,
  eventPayloadSchema,
} from '../schemas.js';

describe('retryConfigSchema', () => {
  it('applies defaults', () => {
    const result = retryConfigSchema.parse({});
    expect(result).toEqual({
      maxAttempts: 3,
      backoff: 'exponential',
      delayMs: 1000,
    });
  });

  it('rejects invalid maxAttempts', () => {
    expect(() => retryConfigSchema.parse({ maxAttempts: 0 })).toThrow();
    expect(() => retryConfigSchema.parse({ maxAttempts: 101 })).toThrow();
  });
});

describe('triggerDefinitionSchema', () => {
  it('validates event trigger', () => {
    const result = triggerDefinitionSchema.parse({ type: 'event', event: 'user.created' });
    expect(result.type).toBe('event');
    expect(result.event).toBe('user.created');
  });

  it('validates cron trigger', () => {
    const result = triggerDefinitionSchema.parse({ type: 'cron', cron: '0 * * * *' });
    expect(result.type).toBe('cron');
  });

  it('validates webhook trigger', () => {
    const result = triggerDefinitionSchema.parse({
      type: 'webhook',
      webhook: { path: '/hooks/stripe' },
    });
    expect(result.webhook?.path).toBe('/hooks/stripe');
  });

  it('validates sub-workflow trigger', () => {
    const result = triggerDefinitionSchema.parse({ type: 'sub-workflow' });
    expect(result.type).toBe('sub-workflow');
  });
});

describe('workerConfigSchema', () => {
  it('applies defaults', () => {
    const result = workerConfigSchema.parse({
      redis: {},
      postgres: { connectionString: 'postgresql://localhost:5432/flowforge' },
    });
    expect(result.redis.host).toBe('localhost');
    expect(result.redis.port).toBe(6379);
    expect(result.concurrency).toBe(10);
    expect(result.port).toBe(4000);
  });
});

describe('integrationRequestSchema', () => {
  it('validates a full request', () => {
    const result = integrationRequestSchema.parse({
      integrationName: 'slack',
      action: 'sendMessage',
      paramsJson: '{"channel":"#general"}',
      connectionId: 'conn_123',
      runId: 'run_123',
    });
    expect(result.integrationName).toBe('slack');
  });
});

describe('runFilterSchema', () => {
  it('applies defaults', () => {
    const result = runFilterSchema.parse({});
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it('validates status filter', () => {
    const result = runFilterSchema.parse({ status: 'completed' });
    expect(result.status).toBe('completed');
  });
});

describe('eventPayloadSchema', () => {
  it('validates event type', () => {
    const result = eventPayloadSchema.parse({ type: 'user.created', data: { id: 1 } });
    expect(result.type).toBe('user.created');
  });

  it('rejects empty type', () => {
    expect(() => eventPayloadSchema.parse({ type: '' })).toThrow();
  });
});
