# Code Interpreter Tool

The Code Interpreter tool executes arbitrary code in a **sandboxed cloud VM** powered by [E2B](https://e2b.dev). Code runs in full isolation from the host system, making this the safest option for untrusted or AI-generated code execution.

## Quick Reference

| Property            | Value                                                   |
| ------------------- | ------------------------------------------------------- |
| **Node name**       | `tools/code-interpreter`                                |
| **Version**         | 0.1.0                                                   |
| **Library**         | `@e2b/code-interpreter`                                 |
| **Actions**         | execute, installPackages                                |
| **Required config** | `apiKey` (or `E2B_API_KEY` env var)                     |
| **Tags**            | code, sandbox, e2b, interpreter, python, tools, agentic |

## Supported Languages

| Language   | Identifier   | Package Manager       |
| ---------- | ------------ | --------------------- |
| Python     | `python`     | pip                   |
| JavaScript | `javascript` | npm                   |
| TypeScript | `typescript` | npm                   |
| R          | `r`          | install.packages()    |
| Java       | `java`       | Maven/Gradle (manual) |
| Go         | `go`         | go get                |
| Ruby       | `ruby`       | gem                   |
| PHP        | `php`        | composer              |
| Bash       | `bash`       | apt-get               |

## Actions

### execute

Execute code in the specified language.

| Parameter  | Type    | Required | Description                                  |
| ---------- | ------- | -------- | -------------------------------------------- |
| `code`     | string  | Yes      | Source code to execute                       |
| `language` | enum    | No       | Language identifier (default: `python`)      |
| `timeout`  | integer | No       | Execution timeout in ms (default: 60000)     |
| `files`    | array   | No       | Files to upload before execution (see below) |

### installPackages

Install packages in the sandbox environment using the language's native package manager.

| Parameter  | Type     | Required | Description                                                 |
| ---------- | -------- | -------- | ----------------------------------------------------------- |
| `packages` | string[] | Yes      | Package names to install                                    |
| `language` | enum     | No       | Determines which package manager to use (default: `python`) |

!!! note
Java packages cannot be installed dynamically. The tool prints a notice directing users to Maven or Gradle.

## File Upload

You can upload files into the sandbox before code execution:

```typescript
{
  action: 'execute',
  code: 'import pandas as pd; df = pd.read_csv("data.csv"); print(df.describe())',
  language: 'python',
  files: [
    { name: 'data.csv', content: 'name,value\nalice,10\nbob,20' }
  ]
}
```

Each file object has:

| Field     | Type   | Description                                         |
| --------- | ------ | --------------------------------------------------- |
| `name`    | string | Filename (written to the sandbox working directory) |
| `content` | string | File content as a string                            |

## Output Schema

| Field      | Type    | Description                                                              |
| ---------- | ------- | ------------------------------------------------------------------------ |
| `stdout`   | string  | Standard output (may be truncated)                                       |
| `stderr`   | string  | Standard error (may be truncated)                                        |
| `results`  | array   | Structured execution results (e.g. rich output from Jupyter-style cells) |
| `error`    | string  | Error message if execution failed                                        |
| `language` | string  | Language that was used                                                   |
| `success`  | boolean | `true` if no error occurred                                              |

## Configuration Reference

| Property         | Type    | Default          | Description                                                    |
| ---------------- | ------- | ---------------- | -------------------------------------------------------------- |
| `apiKey`         | string  | (none)           | E2B API key. Falls back to `E2B_API_KEY` environment variable. |
| `sandboxTimeout` | integer | `300000` (5 min) | Sandbox lifetime in milliseconds.                              |
| `maxOutputLines` | integer | `500`            | Maximum number of output lines before truncation.              |

## Safety

### Full VM isolation

Code executes inside an E2B cloud sandbox -- a dedicated virtual machine that is completely isolated from the FlowForge host. There is no filesystem, network, or process sharing between the sandbox and the host.

### Sandbox timeout

The sandbox is automatically destroyed after `sandboxTimeout` milliseconds, even if execution is still running. This prevents runaway processes from consuming resources indefinitely.

### Output truncation

Both stdout and stderr are truncated to `maxOutputLines` lines. Truncated output includes a count of dropped lines.

### Cleanup

The sandbox is always killed in a `finally` block, ensuring resources are released even when execution throws an error.

!!! warning
An E2B API key is required. Without it, the tool throws immediately. Get a key at [e2b.dev](https://e2b.dev).

## Usage Example

```typescript
import { codeInterpreterNode } from '@flowforgejs/nodes';

const workflow = {
  nodes: [
    {
      id: 'analyze-data',
      node: codeInterpreterNode,
      config: {
        apiKey: process.env.E2B_API_KEY,
        sandboxTimeout: 120_000,
        maxOutputLines: 200,
      },
      input: {
        action: 'execute',
        language: 'python',
        code: `
import pandas as pd
import json

df = pd.read_csv("sales.csv")
summary = {
    "total_revenue": float(df["revenue"].sum()),
    "avg_order_value": float(df["revenue"].mean()),
    "top_product": df.groupby("product")["revenue"].sum().idxmax(),
}
print(json.dumps(summary, indent=2))
        `.trim(),
        files: [
          { name: 'sales.csv', content: 'product,revenue\nwidget,100\ngadget,250\nwidget,150' },
        ],
      },
    },
  ],
};
```

!!! tip
For multi-step data analysis, install packages first with `installPackages`, then run your analysis with `execute`. The sandbox persists between calls within the same sandbox lifetime.
