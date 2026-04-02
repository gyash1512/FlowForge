import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  uuid,
} from 'drizzle-orm/pg-core';

// ── Workflows ──
export const workflows = pgTable('workflows', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  description: text('description'),
  triggerConfig: jsonb('trigger_config').$type<Record<string, unknown>>().notNull(),
  nodeGraph: jsonb('node_graph').$type<Record<string, unknown>[]>().notNull(),
  tenantId: text('tenant_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
});

// ── Workflow Runs ──
export const workflowRuns = pgTable('workflow_runs', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id').notNull().references(() => workflows.id),
  status: text('status').notNull().default('pending'),
  triggerType: text('trigger_type').notNull(),
  triggerConfig: jsonb('trigger_config').$type<Record<string, unknown>>(),
  input: jsonb('input'),
  output: jsonb('output'),
  error: text('error'),
  tenantId: text('tenant_id'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
});

// ── Step Results ──
export const stepResults = pgTable('step_results', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => workflowRuns.id),
  stepName: text('step_name').notNull(),
  nodeName: text('node_name').notNull(),
  status: text('status').notNull().default('pending'),
  input: jsonb('input'),
  output: jsonb('output'),
  error: text('error'),
  attempt: integer('attempt').notNull().default(1),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  durationMs: integer('duration_ms'),
});

// ── Events ──
export const events = pgTable('events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  payload: jsonb('payload'),
  source: text('source'),
  tenantId: text('tenant_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── Checkpoints ──
export const checkpoints = pgTable('checkpoints', {
  runId: text('run_id').notNull().references(() => workflowRuns.id),
  stepName: text('step_name').notNull(),
  state: jsonb('state').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── Tenants ──
export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  apiKey: text('api_key').notNull(),
  maxConcurrency: integer('max_concurrency').notNull().default(10),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── Audit Logs ──
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id').notNull(),
  details: jsonb('details').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── API Keys ──
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  key: text('key').notNull(),
  name: text('name').notNull(),
  scopes: jsonb('scopes').$type<string[]>().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
