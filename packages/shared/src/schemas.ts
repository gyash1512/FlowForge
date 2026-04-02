import { z } from 'zod';
import { RunStatus, StepStatus, NodeCategory, TriggerType } from './types.js';

export const retryConfigSchema = z.object({
  maxAttempts: z.number().int().min(1).max(100).default(3),
  backoff: z.enum(['fixed', 'exponential', 'linear']).default('exponential'),
  delayMs: z.number().int().min(0).default(1000),
  maxDelayMs: z.number().int().min(0).optional(),
});

export const triggerDefinitionSchema = z.object({
  type: z.nativeEnum(TriggerType),
  event: z.string().optional(),
  cron: z.string().optional(),
  webhook: z.object({ path: z.string(), method: z.string().optional() }).optional(),
});

export const workerConfigSchema = z.object({
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().int().default(6379),
    password: z.string().optional(),
    db: z.number().int().default(0),
    tls: z.boolean().optional(),
  }),
  postgres: z.object({
    connectionString: z.string(),
  }),
  concurrency: z.number().int().min(1).default(10),
  pollInterval: z.number().int().min(100).default(1000),
  maxRetries: z.number().int().min(0).default(3),
  shutdownTimeout: z.number().int().min(0).default(30000),
  port: z.number().int().default(4000),
});

export const integrationConfigSchema = z.object({
  nangoUrl: z.string().url().optional(),
  nangoSecretKey: z.string().optional(),
  port: z.number().int().default(4001),
  grpcPort: z.number().int().default(50051),
});

export const integrationRequestSchema = z.object({
  integrationName: z.string(),
  action: z.string(),
  paramsJson: z.string(),
  connectionId: z.string(),
  runId: z.string().optional(),
});

export const runFilterSchema = z.object({
  workflowId: z.string().optional(),
  status: z.nativeEnum(RunStatus).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  eventType: z.string().optional(),
  tenantId: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const eventPayloadSchema = z.object({
  type: z.string().min(1),
  data: z.unknown().default({}),
  source: z.string().optional(),
});

export const runStatusSchema = z.nativeEnum(RunStatus);
export const stepStatusSchema = z.nativeEnum(StepStatus);
export const nodeCategorySchema = z.nativeEnum(NodeCategory);
export const triggerTypeSchema = z.nativeEnum(TriggerType);
