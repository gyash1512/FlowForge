<p align="center">
  <img src="../../docs/assets/banner.svg" alt="FlowForge" width="100%"/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@flowforgejs/cli"><img src="https://img.shields.io/npm/v/@flowforgejs/cli?color=7c3aed" alt="npm"/></a>
</p>

# @flowforgejs/cli

Developer CLI for scaffolding, running, and managing FlowForge workflows from the terminal.

**Key commands:**

| Command                   | Description                          |
| ------------------------- | ------------------------------------ |
| `flowforge init`          | Scaffold a new FlowForge project     |
| `flowforge dev`           | Start the dev server with hot reload |
| `flowforge emit <event>`  | Emit an event to trigger a workflow  |
| `flowforge runs`          | List recent workflow runs            |
| `flowforge node validate` | Validate a custom node definition    |
| `flowforge node test`     | Run tests for a custom node          |

## Install

```bash
npm install -g @flowforgejs/cli
```

## Quick Example

```bash
# Scaffold a new project
flowforge init my-project && cd my-project

# Start the dev server
flowforge dev

# Trigger a workflow by emitting an event
flowforge emit user.signup --data '{"userId": "usr_abc123"}'

# Inspect recent runs
flowforge runs --limit 5

# Validate a custom node
flowforge node validate ./src/nodes/my-node.ts
```

---

<p align="center">Part of <a href="../../README.md">FlowForge</a></p>
