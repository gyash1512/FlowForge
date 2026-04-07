# Shell Tool

The Shell tool executes commands and multi-line scripts on the host system with layered safety controls: command allowlisting, dangerous pattern blocking, working directory restrictions, timeouts, and output truncation.

## Quick Reference

| Property      | Value                                          |
| ------------- | ---------------------------------------------- |
| **Node name** | `tools/shell`                                  |
| **Version**   | 0.1.0                                          |
| **Library**   | execa                                          |
| **Actions**   | execute, script                                |
| **Tags**      | shell, bash, terminal, command, tools, agentic |

## Actions

### execute

Run a single command with optional arguments.

| Parameter | Type                     | Required | Description                                      |
| --------- | ------------------------ | -------- | ------------------------------------------------ |
| `command` | string                   | Yes      | The command to execute                           |
| `args`    | string[]                 | No       | Arguments to pass to the command                 |
| `cwd`     | string                   | No       | Working directory                                |
| `env`     | Record\<string, string\> | No       | Additional environment variables                 |
| `timeout` | integer                  | No       | Timeout in milliseconds (capped by `maxTimeout`) |
| `stdin`   | string                   | No       | Data to pipe to stdin                            |

### script

Execute a multi-line script by writing it to a temporary file and running it through the specified shell.

| Parameter | Type                     | Required | Description                                                     |
| --------- | ------------------------ | -------- | --------------------------------------------------------------- |
| `script`  | string                   | Yes      | Multi-line script content                                       |
| `shell`   | string                   | No       | Shell interpreter (default: `bash`). Also supports `sh`, `zsh`. |
| `cwd`     | string                   | No       | Working directory                                               |
| `env`     | Record\<string, string\> | No       | Additional environment variables                                |
| `timeout` | integer                  | No       | Timeout in milliseconds (capped by `maxTimeout`)                |
| `stdin`   | string                   | No       | Data to pipe to stdin                                           |

!!! note
The temporary script file is created with mode `0o700` and is always cleaned up after execution, even on error.

## Output Schema

| Field      | Type    | Description                        |
| ---------- | ------- | ---------------------------------- |
| `stdout`   | string  | Standard output (may be truncated) |
| `stderr`   | string  | Standard error (may be truncated)  |
| `exitCode` | number  | Process exit code                  |
| `duration` | number  | Execution time in milliseconds     |
| `success`  | boolean | `true` if exit code is 0           |

## Configuration Reference

| Property          | Type     | Default         | Description                                         |
| ----------------- | -------- | --------------- | --------------------------------------------------- |
| `allowedCommands` | string[] | (none)          | If set, only these base command names are allowed.  |
| `blockedPatterns` | string[] | See below       | Regex patterns that are always blocked.             |
| `maxTimeout`      | integer  | `30000` (30s)   | Maximum execution time in milliseconds.             |
| `allowedCwd`      | string[] | (none)          | If set, only these working directories are allowed. |
| `maxOutputSize`   | integer  | `1000000` (1MB) | Truncate stdout/stderr beyond this byte count.      |

### Default Blocked Patterns

The following 7 regex patterns are blocked by default:

| Pattern        | What it blocks                 |
| -------------- | ------------------------------ |
| `rm\s+-rf\s+/` | Recursive deletion from root   |
| `mkfs`         | Filesystem formatting          |
| `:()\{`        | Fork bomb patterns             |
| `dd\s+if=`     | Raw disk writes with dd        |
| `> /dev/sd`    | Direct writes to block devices |
| `chmod\s+777`  | World-writable permissions     |
| `curl.*\|.*sh` | Pipe-to-shell execution        |

You can override or extend this list via the `blockedPatterns` config property.

## Safety

### Command allowlisting

When `allowedCommands` is configured, the tool extracts the base command name (stripping any path prefix) and checks it against the list. For example, if `allowedCommands` is `["node", "npm", "git"]`, then `/usr/bin/node` is allowed (base name `node` matches) but `python` is rejected.

### Regex blocklist

Every command string (including the full command + args for `execute`, and every line for `script`) is tested against all `blockedPatterns`. A match on any pattern rejects the command immediately.

### Working directory restrictions

When `allowedCwd` is set, the `cwd` parameter is resolved to an absolute path and must fall within one of the allowed directories. This prevents execution in sensitive directories.

### Timeout enforcement

The effective timeout is `Math.min(input.timeout, config.maxTimeout)`. If a process exceeds the timeout, it is terminated.

### Output truncation

Both `stdout` and `stderr` are truncated to `maxOutputSize` bytes. Truncated output receives a `"... [output truncated]"` suffix.

!!! warning
If `allowedCommands` is not set, **any command** is allowed (subject to the blocklist). Always configure `allowedCommands` in production environments.

## Usage Example

```typescript
import { shellNode } from '@flowforgejs/nodes';

const workflow = {
  nodes: [
    {
      id: 'run-build',
      node: shellNode,
      config: {
        allowedCommands: ['npm', 'node', 'tsc'],
        maxTimeout: 60_000,
        allowedCwd: ['/app/project'],
      },
      input: {
        action: 'execute',
        command: 'npm',
        args: ['run', 'build'],
        cwd: '/app/project',
      },
    },
  ],
};
```

!!! tip
Use the `script` action for multi-step operations that need to share shell state (variables, conditionals). The `execute` action is better for single commands where you want structured argument passing.
