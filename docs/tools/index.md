# Tools Overview

Tools are specialized FlowForge nodes that provide **agentic capabilities** -- discrete, well-scoped actions that AI agents (and workflows) can invoke to interact with the outside world. Each tool wraps a real-world capability (file I/O, shell execution, web search, browser automation, etc.) behind a consistent `action`-based interface with strict safety controls.

## How Tools Work

Every tool node follows the same pattern:

1. Accept an `action` string that selects the operation (e.g. `readFile`, `search`, `execute`).
2. Accept action-specific parameters via the input schema.
3. Enforce security constraints defined in the tool's **config schema** before executing anything.
4. Return a structured output with a `success` boolean.

Tools are defined with `defineNode()` from `@flowforgejs/sdk` and live under the `tools/` namespace (e.g. `tools/filesystem`, `tools/shell`).

## Available Tools

| Tool                                    | Library                 | Key Actions                                                                                                                | Safety Controls                                                                               |
| --------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [Filesystem](filesystem.md)             | Node.js `fs/promises`   | readFile, writeFile, editFile, listDirectory, searchFiles, fileInfo, moveFile, copyFile, deleteFile, createDirectory, grep | Directory scoping, path traversal blocking, read-only mode                                    |
| [Shell](shell.md)                       | execa                   | execute, script                                                                                                            | Command allowlist, regex blocklist (7 defaults), cwd restrictions, timeout, output truncation |
| [Code Interpreter](code-interpreter.md) | E2B (cloud sandbox)     | execute, installPackages                                                                                                   | Full VM isolation, sandbox timeout, output truncation                                         |
| [Web Search](web-search.md)             | duck-duck-scrape        | search, searchNews, searchImages                                                                                           | Result limit cap, safe search levels                                                          |
| [Web Scrape](web-scrape.md)             | cheerio + fetch         | fetch, extract, extractLinks, extractMetadata                                                                              | Domain allow/block lists, protocol validation, response size limit                            |
| [Git](git.md)                           | simple-git              | clone, status, diff, log, commit, branch, checkout, add, push, pull, stash, tag                                            | Directory scoping, read-only mode, push requires explicit opt-in                              |
| [Browser](browser.md)                   | puppeteer-core          | navigate, screenshot, click, type, evaluate, extractText, pdf                                                              | Domain restrictions, no bundled browser (must provide endpoint)                               |
| [Document Parser](document-parser.md)   | pdf-parse + built-in    | parsePdf, parseJson, parseCsv, parseText                                                                                   | Directory scoping, file size limit                                                            |
| [Math](math.md)                         | mathjs                  | evaluate, simplify, derivative, convert                                                                                    | Precision control, function allowlist                                                         |
| [Human Approval](human-approval.md)     | Built-in (control node) | Pause and wait for human decision                                                                                          | Timeout, auto-approve for dev, auto-reject for CI                                             |

## Integration with AI Agents

The defining feature of FlowForge tools is that **any tool node can be automatically converted into an agent tool** using the `nodeAsAgentTool()` function from `@flowforgejs/engine`. This means an AI agent node can call any tool during its reasoning loop, just like a native function call.

```typescript
import { filesystemNode, shellNode } from '@flowforgejs/nodes';
import { nodesToAgentTools } from '@flowforgejs/engine';

// Convert existing nodes into agent-callable tools
const tools = nodesToAgentTools({
  filesystem: filesystemNode,
  shell: shellNode,
});

// Pass to an agent node definition
const agent = defineAgentNode({
  name: 'dev-agent',
  tools,
  // ...
});
```

The conversion preserves:

- **Description** -- used by the LLM to decide when to invoke the tool.
- **Input schema** -- used by the LLM for structured parameter generation.
- **Handler** -- the actual execution logic, run with an empty config by default.

## Safety Philosophy

Every tool in FlowForge is designed with defense-in-depth:

1. **Scoping** -- Filesystem, Git, and Document Parser tools restrict access to explicitly listed directories. Shell restricts working directories. Web Scrape and Browser restrict domains.
2. **Allowlists over blocklists** -- Where possible, tools default to denying access unless explicitly permitted (e.g. `allowedCommands`, `allowedDomains`, `allowedDirectories`).
3. **Blocklists as a safety net** -- Shell and Web Scrape also maintain blocklists to catch dangerous patterns even when allowlists are relaxed.
4. **Read-only modes** -- Filesystem and Git offer a `readOnly` flag that prevents all mutation operations.
5. **Resource limits** -- Timeouts, output truncation, and file size caps prevent runaway consumption.
6. **Explicit opt-in for dangerous operations** -- Git push requires `allowPush: true`. Shell defaults to blocking `rm -rf /`, `mkfs`, fork bombs, and `curl | sh`.

!!! warning "Agent tools run with empty config"
When a tool is used via `nodeAsAgentTool()`, it runs with an empty config object (`{}`). This means directory scoping, read-only guards, and other config-based restrictions are **not applied** unless you wrap the tool with explicit config injection. Always configure tools properly when exposing them to agents in production.
