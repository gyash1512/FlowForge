<p align="center">
  <img src="../../docs/assets/banner.svg" alt="FlowForge" width="100%"/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@flowforgejs/engine"><img src="https://img.shields.io/npm/v/@flowforgejs/engine?color=7c3aed" alt="npm"/></a>
</p>

# @flowforgejs/engine

The execution engine that powers FlowForge workflows. Handles node scheduling, dependency resolution, retries, and AI model orchestration.

**Key exports:** `Engine`, `nodeAsAgentTool()`, `ModelRegistry`, `createAIProvider()`

## Install

```bash
npm install @flowforgejs/engine
```

## Quick Example

```typescript
import { Engine } from '@flowforgejs/engine';
import { myWorkflow } from './workflows/onboarding';

const engine = new Engine();

engine.registerWorkflow(myWorkflow);

const result = await engine.trigger('onboarding', {
  userId: 'usr_abc123',
});

console.log(result.status); // "completed"
console.log(result.output); // { message: "Welcome, Alice!" }
```

---

<p align="center">Part of <a href="../../README.md">FlowForge</a></p>
