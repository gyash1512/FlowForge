# Git Tool

The Git tool provides version control operations via the simple-git library, with directory-scoped permissions, a read-only mode, and explicit opt-in for push operations.

## Quick Reference

| Property            | Value                                                                           |
| ------------------- | ------------------------------------------------------------------------------- |
| **Node name**       | `tools/git`                                                                     |
| **Version**         | 0.1.0                                                                           |
| **Library**         | simple-git                                                                      |
| **Actions**         | clone, status, diff, log, commit, branch, checkout, add, push, pull, stash, tag |
| **Required config** | `allowedDirectories`                                                            |
| **Tags**            | git, version-control, scm, tools, agentic                                       |

## Actions

### Read Operations

These actions are always permitted, even in read-only mode.

#### status

Get the current repository status.

| Parameter  | Type   | Required | Description            |
| ---------- | ------ | -------- | ---------------------- |
| `repoPath` | string | Yes      | Path to the repository |

Returns `{ current, tracking, files: [{ path, status }] }`.

#### diff

Show changes in the working tree or staging area.

| Parameter  | Type    | Required | Description                       |
| ---------- | ------- | -------- | --------------------------------- |
| `repoPath` | string  | Yes      | Path to the repository            |
| `staged`   | boolean | No       | If true, show only staged changes |

Returns `{ diff }` -- the diff output as a string.

#### log

View commit history.

| Parameter  | Type    | Required | Description                                       |
| ---------- | ------- | -------- | ------------------------------------------------- |
| `repoPath` | string  | Yes      | Path to the repository                            |
| `maxCount` | integer | No       | Maximum number of commits to return (default: 20) |

Returns `{ commits: [{ hash, message, date, author }] }`.

#### branch

List all branches and identify the current branch.

| Parameter  | Type   | Required | Description            |
| ---------- | ------ | -------- | ---------------------- |
| `repoPath` | string | Yes      | Path to the repository |

Returns `{ current, all }`.

### Write Operations

These actions are blocked when `readOnly` is `true`.

#### clone

Clone a remote repository.

| Parameter  | Type   | Required | Description              |
| ---------- | ------ | -------- | ------------------------ |
| `repoPath` | string | Yes      | Local path for the clone |
| `url`      | string | Yes      | Remote repository URL    |

#### add

Stage files for commit.

| Parameter  | Type     | Required | Description                                      |
| ---------- | -------- | -------- | ------------------------------------------------ |
| `repoPath` | string   | Yes      | Path to the repository                           |
| `files`    | string[] | No       | Files to stage (default: `["."]` -- all changes) |

#### commit

Create a commit with the staged changes.

| Parameter  | Type   | Required | Description            |
| ---------- | ------ | -------- | ---------------------- |
| `repoPath` | string | Yes      | Path to the repository |
| `message`  | string | Yes      | Commit message         |

Returns `{ hash, summary: { changes } }`.

#### checkout

Switch to a different branch.

| Parameter  | Type   | Required | Description              |
| ---------- | ------ | -------- | ------------------------ |
| `repoPath` | string | Yes      | Path to the repository   |
| `branch`   | string | Yes      | Branch name to check out |

#### push

Push commits to a remote. **Requires `allowPush: true` in config.**

| Parameter  | Type   | Required | Description                              |
| ---------- | ------ | -------- | ---------------------------------------- |
| `repoPath` | string | Yes      | Path to the repository                   |
| `remote`   | string | No       | Remote name (default: `origin`)          |
| `branch`   | string | No       | Branch to push (default: current branch) |

#### pull

Pull changes from a remote.

| Parameter  | Type   | Required | Description                     |
| ---------- | ------ | -------- | ------------------------------- |
| `repoPath` | string | Yes      | Path to the repository          |
| `remote`   | string | No       | Remote name (default: `origin`) |
| `branch`   | string | No       | Branch to pull                  |

Returns `{ summary: { changes, insertions, deletions } }`.

#### stash

Manage the stash.

| Parameter     | Type   | Required | Description                                |
| ------------- | ------ | -------- | ------------------------------------------ |
| `repoPath`    | string | Yes      | Path to the repository                     |
| `stashAction` | enum   | No       | `save`, `pop`, or `list` (default: `save`) |
| `message`     | string | No       | Stash message (for `save`)                 |

#### tag

Create a tag on the current commit.

| Parameter  | Type   | Required | Description                           |
| ---------- | ------ | -------- | ------------------------------------- |
| `repoPath` | string | Yes      | Path to the repository                |
| `tagName`  | string | Yes      | Tag name                              |
| `message`  | string | No       | If provided, creates an annotated tag |

## Configuration Reference

| Property             | Type     | Default       | Description                                                            |
| -------------------- | -------- | ------------- | ---------------------------------------------------------------------- |
| `allowedDirectories` | string[] | -- (required) | Repositories must reside within these directories.                     |
| `readOnly`           | boolean  | `false`       | If true, only read operations (status, diff, log, branch) are allowed. |
| `allowPush`          | boolean  | `false`       | Push must be explicitly enabled. Rejected by default.                  |

## Safety

### Directory scoping

The `repoPath` is checked against `allowedDirectories` before any operation. A repository path must start with one of the allowed directory prefixes.

### Read-only mode

When `readOnly` is `true`, only `status`, `diff`, `log`, and `branch` are permitted. All other actions throw an error.

### Push protection

Push is disabled by default (`allowPush: false`). This prevents accidental or malicious pushes to remote repositories. You must set `allowPush: true` explicitly in the node config.

!!! warning
The `push` action is the only operation gated by its own dedicated config flag, reflecting the irreversible nature of pushing to a shared remote.

## Usage Example

```typescript
import { gitNode } from '@flowforgejs/nodes';

// Automated release workflow
const workflow = {
  nodes: [
    {
      id: 'check-status',
      node: gitNode,
      config: {
        allowedDirectories: ['/workspace/repos'],
        readOnly: false,
        allowPush: true,
      },
      input: {
        action: 'status',
        repoPath: '/workspace/repos/my-project',
      },
    },
    {
      id: 'stage-changes',
      node: gitNode,
      config: {
        allowedDirectories: ['/workspace/repos'],
        readOnly: false,
        allowPush: true,
      },
      input: {
        action: 'add',
        repoPath: '/workspace/repos/my-project',
        files: ['CHANGELOG.md', 'package.json'],
      },
    },
    {
      id: 'create-release-commit',
      node: gitNode,
      config: {
        allowedDirectories: ['/workspace/repos'],
        readOnly: false,
        allowPush: true,
      },
      input: {
        action: 'commit',
        repoPath: '/workspace/repos/my-project',
        message: 'chore: release v2.1.0',
      },
    },
    {
      id: 'tag-release',
      node: gitNode,
      config: {
        allowedDirectories: ['/workspace/repos'],
        readOnly: false,
        allowPush: true,
      },
      input: {
        action: 'tag',
        repoPath: '/workspace/repos/my-project',
        tagName: 'v2.1.0',
        message: 'Release version 2.1.0',
      },
    },
    {
      id: 'push-release',
      node: gitNode,
      config: {
        allowedDirectories: ['/workspace/repos'],
        readOnly: false,
        allowPush: true,
      },
      input: {
        action: 'push',
        repoPath: '/workspace/repos/my-project',
        remote: 'origin',
        branch: 'main',
      },
    },
  ],
};
```

!!! tip
For monitoring and analysis workflows, set `readOnly: true` and leave `allowPush` at its default `false`. This gives the agent full read access to repository history without any risk of mutation.
