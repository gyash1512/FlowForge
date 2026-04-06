import type {
  WorkflowDefinition,
  WorkerConfig,
  RunRecord,
  Logger,
  RunFilter,
  DataAdaptor,
  IntegrationAdaptor,
} from '@flowforge/shared';
import { createServer as createHttpServer } from 'node:http';
import { Engine } from '@flowforge/engine';
import { createPinoLogger } from './pino-logger.js';
import { WorkflowRegistry } from './registry.js';
import { CronScheduler } from './cron-scheduler.js';
import { CheckpointManager, InMemoryCheckpointStore } from './checkpoint.js';
import { createServer, InMemoryRunStore } from './server.js';
import type { RunStore, ServerDeps } from './server.js';
import type { Hono } from 'hono';
import { HttpAdaptor } from './adaptors/http-adaptor.js';
import { PostgresAdaptor } from './adaptors/postgres-adaptor.js';
import type { PostgresAdaptorConfig } from './adaptors/postgres-adaptor.js';
import { RedisAdaptor } from './adaptors/redis-adaptor.js';
import type { RedisAdaptorConfig } from './adaptors/redis-adaptor.js';

// ────────────────────────────────────────────────────────────────
// Local-mode Config (no Redis/Postgres required)
// ────────────────────────────────────────────────────────────────

export interface LocalWorkerConfig {
  port?: number;
  logger?: Logger;
}

export type WorkerInit = WorkerConfig | LocalWorkerConfig;

function isFullConfig(config: WorkerInit): config is WorkerConfig {
  return 'redis' in config && 'postgres' in config;
}

// ────────────────────────────────────────────────────────────────
// Worker
// ────────────────────────────────────────────────────────────────

export class Worker {
  private registry: WorkflowRegistry;
  private engine: Engine;
  private cronScheduler: CronScheduler;
  readonly checkpointManager: CheckpointManager;
  private runStore: RunStore;
  private logger: Logger;
  private port: number;
  private app: Hono;
  private httpServer: { close: () => void } | undefined;
  private started = false;

  constructor(config: WorkerInit = {}) {
    const fullConfig = isFullConfig(config);

    if (fullConfig) {
      this.logger = createPinoLogger({ name: 'worker' });
      this.port = config.port ?? 4000;
    } else {
      this.logger = config.logger ?? createPinoLogger({ name: 'worker' });
      this.port = config.port ?? 4000;
    }

    this.registry = new WorkflowRegistry(this.logger);
    this.engine = new Engine({ logger: this.logger });

    // Register the built-in HTTP adaptor so ctx.pull('http', ...) / ctx.push('http', ...) work out of the box
    this.engine.registerAdaptor(new HttpAdaptor());

    this.cronScheduler = new CronScheduler(this.logger);
    this.checkpointManager = new CheckpointManager(new InMemoryCheckpointStore(), this.logger);
    this.runStore = new InMemoryRunStore();

    // Build the HTTP app
    const serverDeps: ServerDeps = {
      registry: this.registry,
      runStore: this.runStore,
      logger: this.logger,
      onEvent: (type, data) => this.handleEvent(type, data),
      onReplay: (rid) => this.replayRun(rid),
      onCancel: (rid) => this.cancelRun(rid),
    };
    this.app = createServer(serverDeps);

    if (!fullConfig) {
      this.logger.info('Worker initialised in local mode (no Redis/Postgres)');
    }
  }

  // ── Registration ──

  register(workflow: WorkflowDefinition): void {
    this.registry.register(workflow);
    this.engine.register(workflow);

    // Set up cron if needed
    if (workflow.trigger.type === 'cron' && workflow.trigger.cron) {
      this.cronScheduler.register(workflow.id, workflow.trigger.cron, async () => {
        await this.handleEvent('cron', { workflowId: workflow.id });
      });
    }
  }

  unregister(workflowId: string): void {
    this.registry.unregister(workflowId);
    this.engine.unregister(workflowId);
    this.cronScheduler.unregister(workflowId);
  }

  // ── Data & Integration Adaptors ──

  /** Register a custom data adaptor for ctx.pull(name)/ctx.push(name) */
  registerAdaptor(adaptor: DataAdaptor): void {
    this.engine.registerAdaptor(adaptor);
  }

  /** Register an integration adaptor for ctx.integrate(name, action, params) */
  registerIntegration(adaptor: IntegrationAdaptor): void {
    this.engine.registerIntegration(adaptor);
  }

  /** Connect a PostgreSQL database and register it as the "postgres" data adaptor */
  connectPostgres(config: PostgresAdaptorConfig): PostgresAdaptor {
    const adaptor = new PostgresAdaptor(config);
    this.engine.registerAdaptor(adaptor);
    return adaptor;
  }

  /** Connect a Redis instance and register it as the "redis" data adaptor */
  connectRedis(config: RedisAdaptorConfig): RedisAdaptor {
    const adaptor = new RedisAdaptor(config);
    this.engine.registerAdaptor(adaptor);
    return adaptor;
  }

  // ── Lifecycle ──

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    // Start cron scheduler
    this.cronScheduler.start();

    // Start HTTP server using Node built-in http module.
    // This avoids a hard dependency on @hono/node-server.
    const server = createHttpServer(async (req, res) => {
      // Convert Node request to a fetch Request
      const url = `http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`;
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) {
          if (Array.isArray(value)) {
            for (const v of value) headers.append(key, v);
          } else {
            headers.set(key, value);
          }
        }
      }

      const bodyMethods = new Set(['POST', 'PUT', 'PATCH']);
      const hasBody = bodyMethods.has(req.method ?? 'GET');

      const fetchReq = new Request(url, {
        method: req.method,
        headers,
        body: hasBody ? await readBody(req) : undefined,
        ...(hasBody ? { duplex: 'half' as const } : {}),
      });

      const fetchRes = await this.app.fetch(fetchReq);

      res.writeHead(fetchRes.status, Object.fromEntries(fetchRes.headers.entries()));
      const body = await fetchRes.arrayBuffer();
      res.end(Buffer.from(body));
    });

    server.listen(this.port);
    this.httpServer = server;

    // Graceful shutdown on process signals
    process.on('SIGTERM', () => this.stop());
    process.on('SIGINT', () => this.stop());

    this.logger.info(`Worker started on port ${this.port}`);
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;

    // Stop cron scheduler
    this.cronScheduler.stop();

    // Close HTTP server
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = undefined;
    }

    this.logger.info('Worker stopped');
  }

  // ── Event handling ──

  async handleEvent(type: string, data: unknown): Promise<RunRecord[]> {
    this.logger.info(`Processing event: ${type}`);

    // Find matching workflows by event type
    const matchingWorkflows = this.registry.findByEvent(type);

    // For cron events, also try to trigger the specific workflow
    if (type === 'cron' && data && typeof data === 'object' && 'workflowId' in data) {
      const wfId = (data as { workflowId: string }).workflowId;
      const wf = this.registry.find(wfId);
      if (wf && !matchingWorkflows.some((mw) => mw.id === wfId)) {
        matchingWorkflows.push(wf);
      }
    }

    // For manual triggers, also try to trigger the specific workflow
    if (type === 'manual' && data && typeof data === 'object' && 'workflowId' in data) {
      const wfId = (data as { workflowId: string }).workflowId;
      const wf = this.registry.find(wfId);
      if (wf && !matchingWorkflows.some((mw) => mw.id === wfId)) {
        matchingWorkflows.push(wf);
      }
    }

    const runs: RunRecord[] = [];
    for (const wf of matchingWorkflows) {
      try {
        const run = await this.engine.trigger(wf.id, data);
        this.runStore.set(run);
        runs.push(run);
      } catch (err) {
        this.logger.error(
          `Failed to trigger workflow ${wf.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return runs;
  }

  // ── Replay ──

  private async replayRun(runId: string): Promise<RunRecord> {
    const original = this.runStore.get(runId);
    if (!original) {
      throw new Error(`Run not found: ${runId}`);
    }

    const run = await this.engine.trigger(original.workflowId, original.input);
    this.runStore.set(run);
    return run;
  }

  // ── Cancel ──

  private async cancelRun(runId: string): Promise<void> {
    this.engine.cancelRun(runId);
  }

  // ── Accessors ──

  get honoApp(): Hono {
    return this.app;
  }

  getRun(runId: string): RunRecord | undefined {
    return this.runStore.get(runId);
  }

  listRuns(filter?: RunFilter): RunRecord[] {
    return this.runStore.list(filter);
  }

  listWorkflows(): WorkflowDefinition[] {
    return this.registry.list();
  }

  get isRunning(): boolean {
    return this.started;
  }
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}
