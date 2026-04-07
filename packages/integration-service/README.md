<p align="center">
  <img src="../../docs/assets/banner.svg" alt="FlowForge" width="100%"/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@flowforgejs/integrations"><img src="https://img.shields.io/npm/v/@flowforgejs/integrations?color=7c3aed" alt="npm"/></a>
</p>

# @flowforgejs/integrations

38+ third-party integrations for FlowForge, backed by Composio. Provides a unified interface for connecting to external services with built-in circuit breakers and rate limiting for production resilience.

**Features:** Composio-backed adaptors, circuit breakers, rate limiting, unified auth

## Install

```bash
npm install @flowforgejs/integrations
```

## Quick Example

```typescript
import { IntegrationService } from '@flowforgejs/integrations';
import { composioAdaptors } from '@flowforgejs/integrations/composio';

const service = new IntegrationService({
  rateLimiting: { maxConcurrent: 10 },
  circuitBreaker: { threshold: 5, resetTimeout: 30_000 },
});

service.register(
  composioAdaptors({
    apiKey: process.env.COMPOSIO_API_KEY,
    services: ['github', 'slack', 'notion', 'jira'],
  }),
);

await service.start();
```

---

<p align="center">Part of <a href="../../README.md">FlowForge</a></p>
