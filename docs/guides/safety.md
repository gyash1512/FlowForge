# Safety & Permissions

FlowForge is designed with a defense-in-depth approach to safety. Every tool node that interacts with the filesystem, network, or shell has built-in restrictions that are configured declaratively and enforced at runtime.

## Philosophy

**Every tool has restrictions.** No tool operates with unbounded access by default. Filesystem tools are scoped to directories. Shell tools restrict which commands can run. Network tools limit which domains can be contacted. This principle applies consistently across all tool nodes.

## Directory Scoping

Several tool nodes enforce directory scoping to prevent access outside designated paths.

### Filesystem

The `tools/filesystem` node requires an `allowedDirectories` config:

```typescript
import { filesystemNode } from '@flowforgejs/nodes';

workflow('file-processing')
  .trigger({ type: 'manual' })
  .node('read-file', filesystemNode, {
    config: {
      allowedDirectories: ['/workspace/data', '/tmp/output'],
      readOnly: false,
    },
    input: () => ({
      action: 'readFile',
      path: '/workspace/data/input.csv',
    }),
  })
  .build();
```

Any attempt to access a path outside the allowed directories will throw an error.

### Git

The `tools/git` node similarly requires `allowedDirectories`:

```typescript
{
  config: {
    allowedDirectories: ['/workspace/repos'],
    readOnly: false,
    allowPush: false,  // Push must be explicitly enabled
  }
}
```

### Document Parser

The `tools/document-parser` node restricts which directories it can read files from, preventing it from parsing arbitrary files on the system.

---

## Command Restrictions

### Shell Node

The `tools/shell` node provides multiple layers of protection:

**Blocked patterns** -- dangerous shell operations are blocked by default:

```
rm -rf /
mkfs
:(){ (fork bomb)
dd if=
> /dev/sd
chmod 777
curl ... | sh
```

**Allowed commands** -- you can restrict to a whitelist:

```typescript
{
  config: {
    allowedCommands: ['ls', 'cat', 'grep', 'wc', 'sort', 'uniq'],
    blockedPatterns: ['rm\\s+-rf', 'curl.*\\|.*sh'],
    defaultTimeout: 30_000,
  }
}
```

!!! warning "Default blocked patterns"
Even without explicit configuration, the shell node blocks common destructive patterns. The `blockedPatterns` config extends this default list.

---

## Domain Restrictions

### Web Scrape

The `tools/web-scrape` node supports domain allow/block lists:

```typescript
{
  config: {
    allowedDomains: ['docs.example.com', 'api.example.com'],
    blockedDomains: ['evil.com', 'phishing.example'],
    maxResponseSize: 5_000_000,  // 5MB limit
  }
}
```

If `allowedDomains` is set, only those domains can be fetched. `blockedDomains` is always enforced regardless. Domain matching supports subdomains (e.g., blocking `example.com` also blocks `sub.example.com`).

### Browser

The `tools/browser` node enforces the same pattern:

```typescript
{
  config: {
    allowedDomains: ['app.example.com'],
    headless: true,
    timeout: 30_000,
  }
}
```

---

## Read-Only Modes

### Filesystem

Set `readOnly: true` to restrict the filesystem node to read operations only (`readFile`, `listDirectory`, `searchFiles`, `fileInfo`, `grep`). Write operations (`writeFile`, `editFile`, `deleteFile`, etc.) will be rejected.

```typescript
{
  config: {
    allowedDirectories: ['/workspace'],
    readOnly: true,
  }
}
```

### Git

Set `readOnly: true` to restrict the git node to read-only operations (`status`, `diff`, `log`, `branch` list). Write operations (`commit`, `add`, `checkout`, etc.) will be rejected.

---

## Push Protection

The git node requires explicit opt-in for push operations:

```typescript
{
  config: {
    allowedDirectories: ['/workspace/repo'],
    readOnly: false,
    allowPush: false,  // Default: push is disabled
  }
}
```

Setting `allowPush: true` enables the `push` action. This separation ensures that even writable git configurations do not accidentally push to remote repositories.

---

## Sandbox Isolation

### Code Interpreter

The `tools/code-interpreter` node runs user-provided code in sandboxed environments:

- Supports Python, JavaScript, TypeScript, R, Java, Go, Ruby, PHP, and Bash.
- Each execution runs in an isolated E2B sandbox VM.
- No access to the host filesystem, network, or processes.
- Configurable timeout per execution.
- Package installation is supported within the sandbox.

```typescript
{
  config: {
    sandbox: 'e2b',
    defaultTimeout: 30_000,
    maxOutputSize: 1_000_000,
  }
}
```

---

## Human-in-the-Loop

The `control/human-approval` node provides a checkpoint where a human must approve before the workflow continues. See the [Control Flow Nodes](../nodes/control.md#human-approval) documentation for full details.

Key safety features:

- **Timeout** -- if no human responds within the timeout, the action is rejected by default.
- **autoApprove** -- set `true` in development to unblock agent loops during testing.
- **autoReject** -- set `true` in CI/headless environments to ensure workflows never block indefinitely.
- **Urgency levels** -- `low`, `normal`, `high`, `critical` to help reviewers prioritize.

```typescript
{
  config: {
    defaultTimeout: 3_600_000,  // 1 hour
    autoApprove: false,
    autoReject: false,
  }
}
```

---

## Best Practices Checklist

!!! note "Safety checklist"
Review this checklist when configuring tool nodes for production:

    - [ ] **Filesystem**: `allowedDirectories` is set and minimal. `readOnly` is `true` unless writes are necessary.
    - [ ] **Git**: `allowedDirectories` is set. `allowPush` is `false` unless explicitly needed. `readOnly` is `true` for read-only workflows.
    - [ ] **Shell**: `allowedCommands` whitelist is configured. Default `blockedPatterns` are not overridden. Timeout is set.
    - [ ] **Web scrape / Browser**: `allowedDomains` is set if the node should only access specific sites. `blockedDomains` includes known-bad domains.
    - [ ] **Code interpreter**: Sandbox mode is enabled. Timeout is configured.
    - [ ] **Human approval**: Used before destructive or high-stakes agent actions. `autoApprove` is `false` in production. `autoReject` is `true` in CI.
    - [ ] **Agent nodes**: `maxIterations` is set to a reasonable limit. Timeout is configured.
    - [ ] **Secrets**: Connection IDs and API keys are stored in environment variables or a secrets manager, never hardcoded in workflow definitions.
    - [ ] **Retry limits**: `retries` and `maxAttempts` are bounded to prevent runaway loops.

---

## Defense in Depth

FlowForge applies multiple layers of protection:

| Layer                 | Mechanism                                    | Example                                        |
| --------------------- | -------------------------------------------- | ---------------------------------------------- |
| **Schema validation** | Zod schemas validate all inputs and outputs  | Prevents malformed data from reaching handlers |
| **Directory scoping** | Path allowlists on filesystem/git nodes      | Prevents directory traversal                   |
| **Command filtering** | Blocked patterns + command allowlists        | Prevents destructive shell commands            |
| **Domain filtering**  | Allow/block lists on network nodes           | Prevents data exfiltration                     |
| **Sandbox isolation** | E2B VMs for code execution                   | Prevents host system compromise                |
| **Human approval**    | Explicit approval gates                      | Prevents unintended automated actions          |
| **Timeouts**          | Per-node and per-workflow timeouts           | Prevents runaway execution                     |
| **Retry limits**      | Bounded retry with exponential backoff       | Prevents infinite retry loops                  |
| **Abort signals**     | Cancellation propagation via AbortController | Enables graceful shutdown                      |
