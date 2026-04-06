# Human Approval (HITL)

The Human Approval node is a **control flow** node (not a tool) that pauses workflow execution and waits for a human to approve or reject an action before the workflow continues. It implements the Human-in-the-Loop (HITL) pattern, which is essential for gating dangerous or irreversible operations behind manual review.

## Quick Reference

| Property      | Value                                                     |
| ------------- | --------------------------------------------------------- |
| **Node name** | `control/human-approval`                                  |
| **Version**   | 0.1.0                                                     |
| **Category**  | control                                                   |
| **Library**   | Built-in (uses FlowForge engine events and checkpointing) |
| **Tags**      | control-flow, hitl, human-in-the-loop, approval, safety   |

## How It Works

The Human Approval node follows a three-phase lifecycle:

1. **Emit**: The node emits a `human-approval.requested` event containing the action description, details payload, urgency level, and timeout. External systems (Slack bots, dashboards, email integrations) listen for this event and present the approval request to a human reviewer.

2. **Checkpoint**: The node calls `ctx.checkpoint()` to persist the workflow state. This makes the workflow crash-safe -- if the process restarts while waiting for approval, execution resumes from the checkpoint.

3. **Wait**: The node calls `ctx.wait('human-approval.response', ...)` and blocks until a matching response event arrives or the timeout expires.

```
Workflow --> [human-approval] --emit--> External System
                  |                          |
              checkpoint                  Human reviews
                  |                          |
                wait  <--- response event ---+
                  |
            approved? --> continue / abort
```

## Input Schema

| Parameter | Type    | Required | Description                                             |
| --------- | ------- | -------- | ------------------------------------------------------- |
| `action`  | string  | Yes      | Description of the action that needs approval           |
| `details` | unknown | No       | Detailed payload for the reviewer to inspect            |
| `urgency` | enum    | No       | `low`, `normal`, `high`, `critical` (default: `normal`) |
| `timeout` | integer | No       | Override timeout in milliseconds                        |

## Output Schema

| Field            | Type    | Description                                                                 |
| ---------------- | ------- | --------------------------------------------------------------------------- |
| `approved`       | boolean | Whether the action was approved                                             |
| `approvedBy`     | string  | Identifier of who approved/rejected (e.g. user ID, `"system:auto-approve"`) |
| `reason`         | string  | Optional reason provided by the reviewer                                    |
| `respondedAt`    | string  | ISO 8601 timestamp of the response                                          |
| `timedOut`       | boolean | `true` if the approval timed out (treated as rejection)                     |
| `originalAction` | string  | The original action description                                             |
| `details`        | unknown | The original details payload                                                |

## Configuration Reference

| Property         | Type    | Default            | Description                                                                                    |
| ---------------- | ------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| `defaultTimeout` | integer | `3600000` (1 hour) | Default approval timeout in milliseconds.                                                      |
| `autoApprove`    | boolean | `false`            | If true, skip the approval flow and auto-approve immediately. For development and testing.     |
| `autoReject`     | boolean | `false`            | If true, skip the approval flow and auto-reject immediately. For CI and headless environments. |

## Urgency Levels

| Level      | Intended Use                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `low`      | Informational approval requests that can wait indefinitely                                          |
| `normal`   | Standard operations requiring human sign-off                                                        |
| `high`     | Time-sensitive operations that should be reviewed promptly                                          |
| `critical` | Operations that require immediate attention -- external systems should escalate (e.g. page on-call) |

The urgency level is included in the emitted event and can be used by external systems to determine notification priority (e.g. Slack DM vs. channel post vs. PagerDuty alert).

## Emitted Event

The `human-approval.requested` event contains:

| Field         | Type    | Description                 |
| ------------- | ------- | --------------------------- |
| `runId`       | string  | The current workflow run ID |
| `workflowId`  | string  | The workflow definition ID  |
| `action`      | string  | Action description          |
| `details`     | unknown | Action details              |
| `urgency`     | string  | Urgency level               |
| `requestedAt` | string  | ISO 8601 timestamp          |
| `timeoutMs`   | number  | Timeout in milliseconds     |

## Expected Response Event

The node waits for a `human-approval.response` event matching `{ runId }`:

| Field        | Type    | Required | Description                     |
| ------------ | ------- | -------- | ------------------------------- |
| `approved`   | boolean | Yes      | Whether the request is approved |
| `approvedBy` | string  | No       | Who approved or rejected        |
| `reason`     | string  | No       | Explanation                     |

## Integration with External Systems

### Slack Bot

Listen for `human-approval.requested` events and post an interactive message with Approve/Reject buttons. When a user clicks a button, emit a `human-approval.response` event back to the engine.

### Dashboard

The FlowForge dashboard can display pending approval requests with the action description, details, and urgency. Reviewers can approve or reject directly from the UI.

### Email

Send an email with the action description and one-click approve/reject links. The links hit an API endpoint that emits the response event.

### Timeout behavior

If no response is received within the timeout period, the node treats the request as **rejected** with `timedOut: true`. The workflow can then branch on this outcome.

## Safety

- **Timeout as rejection**: Unanswered requests are always treated as rejection, never approval. This is a safe default.
- **Checkpoint persistence**: The workflow state is checkpointed before waiting, so a process crash does not lose the approval request.
- **Auto-modes for non-interactive environments**: `autoApprove` and `autoReject` prevent the node from blocking indefinitely in environments where no human is available.

!!! warning
Never use `autoApprove: true` in production. It exists solely for development and testing. In production, always require genuine human review.

## Usage Example: Gating a Dangerous Operation

```typescript
import { humanApprovalNode } from '@flowforge/nodes';
import { gitNode } from '@flowforge/nodes';

const workflow = {
  nodes: [
    {
      id: 'request-approval',
      node: humanApprovalNode,
      config: {
        defaultTimeout: 1_800_000, // 30 minutes
      },
      input: {
        action: 'Push release v3.0.0 to production',
        details: {
          commits: 47,
          filesChanged: 132,
          targetBranch: 'main',
          targetRemote: 'origin',
        },
        urgency: 'high',
      },
    },
    {
      id: 'push-if-approved',
      node: gitNode,
      // Only runs if approval.approved === true
      config: {
        allowedDirectories: ['/workspace'],
        allowPush: true,
      },
      input: {
        action: 'push',
        repoPath: '/workspace/my-app',
        remote: 'origin',
        branch: 'main',
      },
    },
  ],
};
```

## Usage Example: CI Mode (Auto-Reject)

```typescript
const workflow = {
  nodes: [
    {
      id: 'safety-gate',
      node: humanApprovalNode,
      config: {
        autoReject: true, // In CI, always reject operations requiring approval
      },
      input: {
        action: 'Delete all staging data',
        urgency: 'critical',
      },
    },
  ],
};
// Output: { approved: false, approvedBy: "system:auto-reject", timedOut: false }
```

!!! tip
Combine Human Approval with the [Shell](shell.md) or [Git](git.md) tools to create workflows where dangerous operations (deployments, data migrations, destructive commands) always require human sign-off before execution.
