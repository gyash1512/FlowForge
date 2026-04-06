# Transform Nodes

Transform nodes operate on arrays and strings, providing functional primitives for data manipulation within workflows. Each transform node accepts a user-defined expression string that is evaluated at runtime.

## Overview

| Node                 | Description                             | Expression signature                           |
| -------------------- | --------------------------------------- | ---------------------------------------------- |
| `transform/map`      | Transform each element in an array      | `(item, index) => transformedItem`             |
| `transform/filter`   | Filter elements using a predicate       | `(item, index) => boolean`                     |
| `transform/reduce`   | Reduce an array to a single value       | `(accumulator, item, index) => newAccumulator` |
| `transform/template` | Render a string template with variables | N/A (uses `{{variable}}` syntax)               |

---

## map

Transform each element in an array using a user-defined JavaScript expression.

**Input:** `{ data: unknown[] }`

**Config:** `{ expression: string }` -- JavaScript function body receiving `(item, index)`.

**Output:** `{ data: unknown[], count: number }`

```typescript
import { mapNode } from '@flowforge/nodes';

workflow('transform-records')
  .trigger({ type: 'event', event: 'data.loaded' })
  .node('normalize', mapNode, {
    config: {
      expression: 'return { ...item, name: item.name.trim().toLowerCase() }',
    },
    input: (ctx) => ({
      data: (ctx.event.data as { records: unknown[] }).records,
    }),
  })
  .build();
```

---

## filter

Filter an array using a user-defined predicate function.

**Input:** `{ data: unknown[] }`

**Config:** `{ expression: string }` -- JavaScript function body receiving `(item, index)`, must return a boolean.

**Output:** `{ data: unknown[], count: number, removedCount: number }`

```typescript
import { filterNode } from '@flowforge/nodes';

workflow('filter-active')
  .trigger({ type: 'manual' })
  .node('active-only', filterNode, {
    config: {
      expression: 'return item.status === "active" && item.score > 50',
    },
    input: (ctx) => ({
      data: (ctx.event.data as { users: unknown[] }).users,
    }),
  })
  .build();
```

---

## reduce

Reduce an array to a single value using a user-defined reducer function.

**Input:** `{ data: unknown[], initialValue?: unknown }`

**Config:** `{ expression: string }` -- JavaScript function body receiving `(accumulator, item, index)`.

**Output:** `{ result: unknown }`

```typescript
import { reduceNode } from '@flowforge/nodes';

workflow('sum-values')
  .trigger({ type: 'manual' })
  .node('total', reduceNode, {
    config: {
      expression: 'return accumulator + item.amount',
    },
    input: (ctx) => ({
      data: (ctx.event.data as { orders: unknown[] }).orders,
      initialValue: 0,
    }),
  })
  .build();
```

---

## template

Render a string template using `{{variable}}` placeholder syntax. Supports nested access via dot notation (e.g., `{{user.name}}`).

**Input:** `{ variables: Record<string, unknown> }`

**Config:** `{ template: string }` -- template with `{{variable}}` placeholders.

**Output:** `{ result: string }`

```typescript
import { templateNode } from '@flowforge/nodes';

workflow('send-notification')
  .trigger({ type: 'event', event: 'order.shipped' })
  .node('format-message', templateNode, {
    config: {
      template: 'Hello {{customer.name}}, your order #{{orderId}} has shipped via {{carrier}}.',
    },
    input: (ctx) => ({
      variables: ctx.event.data as Record<string, unknown>,
    }),
  })
  .build();
```

!!! note "Expression security"
Transform expressions use the `Function` constructor to create callable functions at runtime. They execute within the workflow's Node.js process. For untrusted input, use the `code-interpreter` tool node instead, which runs code in sandboxed E2B VMs.
