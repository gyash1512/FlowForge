<p align="center">
  <img src="../../docs/assets/banner.svg" alt="FlowForge" width="100%"/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@flowforgejs/sdk"><img src="https://img.shields.io/npm/v/@flowforgejs/sdk?color=7c3aed" alt="npm"/></a>
</p>

# @flowforgejs/sdk

The core workflow DSL for FlowForge. Define nodes with typed inputs and outputs using Zod schemas, then compose them into declarative workflows with the fluent builder API.

**Key exports:** `defineNode()`, `defineAgentNode()`, `workflow()`

## Install

```bash
npm install @flowforgejs/sdk
```

## Quick Example

```typescript
import { defineNode, workflow } from '@flowforgejs/sdk';
import { z } from 'zod';

const fetchUser = defineNode({
  name: 'fetch-user',
  input: z.object({ userId: z.string() }),
  output: z.object({ name: z.string(), email: z.string() }),
  async run(ctx) {
    // node implementation
  },
});

const greetUser = defineNode({
  name: 'greet-user',
  input: z.object({ name: z.string() }),
  output: z.object({ message: z.string() }),
  async run(ctx) {
    // node implementation
  },
});

const myWorkflow = workflow('onboarding')
  .addNode(fetchUser)
  .addNode(greetUser)
  .connect('fetch-user', 'greet-user')
  .build();
```

---

<p align="center">Part of <a href="../../README.md">FlowForge</a></p>
