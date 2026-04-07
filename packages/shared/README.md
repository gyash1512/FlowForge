<p align="center">
  <img src="../../docs/assets/banner.svg" alt="FlowForge" width="100%"/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@flowforgejs/shared"><img src="https://img.shields.io/npm/v/@flowforgejs/shared?color=7c3aed" alt="npm"/></a>
</p>

# @flowforgejs/shared

Shared types, error classes, and constants used across the FlowForge monorepo. This package provides the foundational type system that all other packages depend on.

**Key exports:** `NodeDefinition`, `NodeContext`, `RunRecord`, `WorkflowDefinition`, `FlowForgeError`, `NodeExecutionError`, `ValidationError`

## Install

```bash
npm install @flowforgejs/shared
```

## Quick Example

```typescript
import type { NodeDefinition, NodeContext, WorkflowDefinition } from '@flowforgejs/shared';
import { NodeExecutionError } from '@flowforgejs/shared';

// Use shared types when building a custom node
const myNode: NodeDefinition = {
  name: 'custom-node',
  category: 'tools',
  async run(ctx: NodeContext) {
    if (!ctx.input.data) {
      throw new NodeExecutionError('custom-node', 'Missing required data');
    }
    return { result: ctx.input.data };
  },
};
```

---

<p align="center">Part of <a href="../../README.md">FlowForge</a></p>
