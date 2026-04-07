<p align="center">
  <img src="../../docs/assets/banner.svg" alt="FlowForge" width="100%"/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@flowforgejs/test-utils"><img src="https://img.shields.io/npm/v/@flowforgejs/test-utils?color=7c3aed" alt="npm"/></a>
</p>

# @flowforgejs/test-utils

Testing utilities for FlowForge nodes and workflows. Provides mock contexts, loggers, and a test runner that integrates with Vitest.

**Key exports:** `createMockContext()`, `mockLogger`, `TestRunner`

## Install

```bash
npm install -D @flowforgejs/test-utils
```

## Quick Example

```typescript
import { describe, it, expect } from 'vitest';
import { createMockContext, mockLogger } from '@flowforgejs/test-utils';
import { myCustomNode } from '../src/nodes/my-custom-node';

describe('myCustomNode', () => {
  it('transforms input correctly', async () => {
    const ctx = createMockContext({
      input: { text: 'hello world' },
      logger: mockLogger,
    });

    const result = await myCustomNode.run(ctx);

    expect(result.output).toBe('HELLO WORLD');
    expect(mockLogger.info).toHaveBeenCalled();
  });
});
```

---

<p align="center">Part of <a href="../../README.md">FlowForge</a></p>
