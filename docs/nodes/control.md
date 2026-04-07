# Control Flow Nodes

Control flow nodes manage the execution order, branching, iteration, and orchestration of workflows. FlowForge uses a DAG-based execution model where steps can declare dependencies, and the runner resolves execution order via topological sort.

## Overview

| Node                     | Description                                               |
| ------------------------ | --------------------------------------------------------- |
| `control/delay`          | Pause execution for a configurable duration               |
| `control/if`             | Conditional branching (then/else)                         |
| `control/switch`         | Multi-way branching based on a value                      |
| `control/parallel`       | Fan-out items for concurrent processing                   |
| `control/forEach`        | Iterate over an array with concurrency control            |
| `control/while`          | Repeat while a condition holds (with max iteration guard) |
| `control/wait-for-event` | Pause and wait for an external event                      |
| `control/sub-workflow`   | Trigger another workflow via event emission               |
| `control/human-approval` | Pause for human approval before proceeding                |

---

## delay

Pause workflow execution for a configurable duration. Data passes through unchanged.

**Config:** `{ ms: number }` -- delay in milliseconds.

**Input:** `{ data?: unknown }` -- optional passthrough data.

**Output:** `{ data: unknown, delayMs: number, resumedAt: string }`

```typescript
import { delayNode } from '@flowforgejs/nodes';

workflow('rate-limited')
  .trigger({ type: 'event', event: 'batch.ready' })
  .node('process', processNode, {
    /* ... */
  })
  .node('wait', delayNode, {
    config: { ms: 2000 },
    input: (ctx) => ({ data: ctx.steps }),
  })
  .node('next-batch', processNode, {
    /* ... */
  })
  .build();
```

---

## if

Conditional branching. Evaluates a boolean condition and returns the matching branch value.

**Input:** `{ condition: boolean, thenValue?: unknown, elseValue?: unknown }`

**Output:** `{ branch: 'then' | 'else', value: unknown }`

```typescript
import { ifNode } from '@flowforgejs/nodes';

workflow('conditional')
  .trigger({ type: 'event', event: 'order.placed' })
  .node('check-amount', ifNode, {
    input: (ctx) => ({
      condition: (ctx.event.data as { amount: number }).amount > 1000,
      thenValue: 'high-value',
      elseValue: 'standard',
    }),
  })
  .build();
```

For structural branching (running different step pipelines per branch), use the workflow builder's `.if()` method instead:

```typescript
workflow('branching')
  .trigger({ type: 'manual' })
  .if('route', {
    condition: (ctx) => (ctx.event.data as { premium: boolean }).premium,
    then: [['premium-flow', premiumNode]],
    else: [['standard-flow', standardNode]],
  })
  .build();
```

---

## switch

Multi-way branching. Routes to one of N outputs based on a value.

**Input:** `{ value: unknown, cases: Record<string, unknown>, default?: unknown }`

**Output:** `{ matched: string | null, value: unknown }`

```typescript
import { switchNode } from '@flowforgejs/nodes';

workflow('route-by-type')
  .trigger({ type: 'event', event: 'ticket.created' })
  .node('route', switchNode, {
    input: (ctx) => ({
      value: (ctx.event.data as { priority: string }).priority,
      cases: {
        critical: { escalate: true, team: 'on-call' },
        high: { escalate: false, team: 'engineering' },
        low: { escalate: false, team: 'support' },
      },
      default: { escalate: false, team: 'triage' },
    }),
  })
  .build();
```

---

## parallel

Fan-out items for concurrent processing with configurable concurrency.

**Config:** `{ concurrency: number }` -- max concurrent executions (default: 10).

**Input:** `{ items: unknown[] }`

**Output:** `{ results: unknown[], totalItems: number }`

For the full fan-out pattern with sub-pipelines, use the workflow builder:

```typescript
workflow('parallel-processing')
  .trigger({ type: 'manual' })
  .parallel('process-all', {
    items: (ctx) => (ctx.event.data as { urls: string[] }).urls,
    concurrency: 5,
    pipeline: (item) => [
      ['fetch', httpNode, { input: () => ({ action: 'get', url: item as string }) }],
      [
        'summarize',
        generateTextNode,
        {
          config: { model: 'gpt-4o' },
          input: (ctx) => ({
            prompt: `Summarize: ${JSON.stringify(ctx.steps)}`,
          }),
        },
      ],
    ],
  })
  .build();
```

---

## forEach

Iterate over an array, running a sub-pipeline for each item with concurrency control.

**Config:** `{ concurrency: number }` -- max concurrent iterations (default: 1).

**Input:** `{ items: unknown[] }`

**Output:** `{ results: unknown[], processedCount: number }`

```typescript
workflow('process-each')
  .trigger({ type: 'event', event: 'batch.ready' })
  .forEach('process-items', {
    items: (ctx) => (ctx.event.data as { records: unknown[] }).records,
    concurrency: 3,
    pipeline: (item, index) => [
      ['transform', transformNode, { input: () => ({ data: item, index }) }],
      [
        'save',
        postgresNode,
        {
          config: { connectionId: 'db' },
          input: (ctx) => ({
            action: 'insert' as const,
            table: 'results',
            data: ctx.steps as Record<string, unknown>,
          }),
        },
      ],
    ],
  })
  .build();
```

---

## while

Repeat a sub-pipeline while a condition is true. Includes a `maxIterations` guard to prevent infinite loops.

**Config:** `{ maxIterations: number }` -- upper bound (default: 100).

**Input:** `{ condition: boolean, data?: unknown }`

```typescript
workflow('polling')
  .trigger({ type: 'manual' })
  .while('poll-until-done', {
    condition: (ctx) => !(ctx.steps as { done?: boolean }).done,
    maxIterations: 20,
    pipeline: [
      [
        'check-status',
        httpNode,
        {
          input: () => ({ action: 'get', url: 'https://api.example.com/status' }),
        },
      ],
    ],
  })
  .build();
```

---

## wait-for-event

Pause workflow execution and wait for a specific event to arrive. Supports matching criteria and timeout.

**Input:**

| Field     | Type                      | Required | Description                             |
| --------- | ------------------------- | -------- | --------------------------------------- |
| `event`   | `string`                  | Yes      | Event type to wait for                  |
| `match`   | `Record<string, unknown>` | No       | Matching criteria for the event payload |
| `timeout` | `number`                  | No       | Timeout in milliseconds                 |

**Config:** `{ defaultTimeout: number }` -- default 300,000ms (5 minutes).

**Output:** `{ event: string, data: unknown, receivedAt: string, timedOut: boolean }`

```typescript
import { waitForEventNode } from '@flowforgejs/nodes';

workflow('approval-flow')
  .trigger({ type: 'event', event: 'deployment.requested' })
  .node('deploy', deployNode, {
    /* ... */
  })
  .node('wait-for-verification', waitForEventNode, {
    config: { defaultTimeout: 600_000 },
    input: () => ({
      event: 'deployment.verified',
      match: { environment: 'production' },
    }),
  })
  .build();
```

---

## sub-workflow

Trigger another workflow as a sub-workflow via event emission. Optionally wait for its completion.

**Input:**

| Field               | Type      | Required | Description                                          |
| ------------------- | --------- | -------- | ---------------------------------------------------- |
| `workflowId`        | `string`  | Yes      | Target workflow identifier                           |
| `data`              | `unknown` | No       | Data to pass to the sub-workflow                     |
| `waitForCompletion` | `boolean` | No       | Wait for the sub-workflow to finish (default: false) |

**Config:** `{ eventPrefix: string, timeout: number }`

```typescript
import { subWorkflowNode } from '@flowforgejs/nodes';

workflow('orchestrator')
  .trigger({ type: 'manual' })
  .node('run-etl', subWorkflowNode, {
    config: { eventPrefix: 'workflow:trigger', timeout: 300_000 },
    input: () => ({
      workflowId: 'etl-pipeline',
      data: { source: 'orders', date: '2025-01-01' },
      waitForCompletion: true,
    }),
  })
  .node('run-report', subWorkflowNode, {
    input: (ctx) => ({
      workflowId: 'generate-report',
      data: ctx.steps,
      waitForCompletion: true,
    }),
  })
  .build();
```

---

## human-approval

Pause workflow execution and wait for a human to approve or reject an action. This is the primary human-in-the-loop mechanism in FlowForge.

**Input:**

| Field     | Type                                        | Required | Description                              |
| --------- | ------------------------------------------- | -------- | ---------------------------------------- |
| `action`  | `string`                                    | Yes      | Description of what needs approval       |
| `details` | `unknown`                                   | No       | Detailed payload for reviewer inspection |
| `urgency` | `'low' \| 'normal' \| 'high' \| 'critical'` | No       | Urgency level (default: `normal`)        |
| `timeout` | `number`                                    | No       | Override timeout in milliseconds         |

**Config:**

| Field            | Type      | Default              | Description                                   |
| ---------------- | --------- | -------------------- | --------------------------------------------- |
| `defaultTimeout` | `number`  | `3,600,000` (1 hour) | Default approval timeout                      |
| `autoApprove`    | `boolean` | `false`              | Skip approval, auto-approve (for dev/testing) |
| `autoReject`     | `boolean` | `false`              | Skip approval, auto-reject (for CI/headless)  |

**Output:** `{ approved: boolean, approvedBy?: string, reason?: string, respondedAt: string, timedOut: boolean, originalAction: string, details?: unknown }`

```typescript
import { humanApprovalNode } from '@flowforgejs/nodes';

workflow('deploy-production')
  .trigger({ type: 'event', event: 'deploy.requested' })
  .node('approval', humanApprovalNode, {
    config: {
      defaultTimeout: 1_800_000, // 30 minutes
      autoApprove: process.env.NODE_ENV === 'development',
      autoReject: process.env.CI === 'true',
    },
    input: (ctx) => ({
      action: 'Deploy to production',
      details: ctx.event.data,
      urgency: 'high' as const,
    }),
  })
  .if('check-approval', {
    condition: (ctx) => (ctx.steps as { approval: { approved: boolean } }).approval.approved,
    then: [['deploy', deployNode]],
    else: [
      [
        'notify-rejected',
        slackNode,
        {
          config: { connectionId: 'slack' },
          input: () => ({
            action: 'sendMessage' as const,
            channel: '#deploys',
            text: 'Production deploy was rejected.',
          }),
        },
      ],
    ],
  })
  .build();
```

!!! warning "Timeout behavior"
If a human-approval times out, the node returns `approved: false` and `timedOut: true`. Your workflow should handle this case explicitly.

!!! tip "Events"
The node emits a `human-approval.requested` event that external systems (dashboards, Slack bots, email) can subscribe to. It then waits for a `human-approval.response` event containing `{ approved, approvedBy?, reason? }`.

---

## DAG Execution Model

When workflow steps declare `dependsOn` arrays, the runner builds a DAG and resolves execution order via topological sort. Steps in the same layer run in parallel:

```typescript
workflow('dag-example')
  .trigger({ type: 'manual' })
  .node('fetch-a', fetchNode, {
    /* ... */
  })
  .node('fetch-b', fetchNode, {
    /* ... */
  })
  .node('combine', combineNode, {
    dependsOn: ['fetch-a', 'fetch-b'],
    input: (ctx) => ({
      a: (ctx.steps as Record<string, unknown>)['fetch-a'],
      b: (ctx.steps as Record<string, unknown>)['fetch-b'],
    }),
  })
  .build();
```

In this example, `fetch-a` and `fetch-b` run in parallel (no dependencies), and `combine` runs only after both complete.
