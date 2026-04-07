<p align="center">
  <img src="../../docs/assets/banner.svg" alt="FlowForge" width="100%"/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@flowforgejs/worker"><img src="https://img.shields.io/npm/v/@flowforgejs/worker?color=7c3aed" alt="npm"/></a>
</p>

# @flowforgejs/worker

Production-grade worker process for executing FlowForge workflows. Built on BullMQ for job queuing, Hono for the HTTP API, Drizzle/Postgres for persistence, and OpenTelemetry for observability. Supports cron-based scheduling out of the box.

**Features:** job queuing (BullMQ), HTTP API (Hono), persistence (Drizzle/Postgres), tracing (OpenTelemetry), cron scheduling

## Install

```bash
npm install @flowforgejs/worker
```

## Quick Example

```typescript
import { createWorker } from '@flowforgejs/worker';

const worker = await createWorker({
  redis: { host: 'localhost', port: 6379 },
  database: process.env.DATABASE_URL,
  workflows: './src/workflows',
  telemetry: { enabled: true },
  cron: [{ pattern: '0 9 * * *', workflow: 'daily-report' }],
});

await worker.start();
// Worker listening on http://localhost:3000
```

---

<p align="center">Part of <a href="../../README.md">FlowForge</a></p>
