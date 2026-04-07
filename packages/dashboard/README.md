<p align="center">
  <img src="../../docs/assets/banner.svg" alt="FlowForge" width="100%"/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@flowforgejs/dashboard"><img src="https://img.shields.io/npm/v/@flowforgejs/dashboard?color=7c3aed" alt="npm"/></a>
</p>

# @flowforgejs/dashboard

Monitoring and management API for FlowForge. Provides HTTP endpoints for inspecting workflows, runs, events, and metrics, with real-time updates via Server-Sent Events (SSE).

**Endpoints:** workflows, runs, events, metrics, SSE streaming

## Install

```bash
npm install @flowforgejs/dashboard
```

## Quick Example

```typescript
import { createDashboard } from '@flowforgejs/dashboard';

const dashboard = await createDashboard({
  database: process.env.DATABASE_URL,
  port: 4000,
});

await dashboard.start();
// Dashboard API available at http://localhost:4000
// SSE stream at http://localhost:4000/events/stream
```

---

<p align="center">Part of <a href="../../README.md">FlowForge</a></p>
