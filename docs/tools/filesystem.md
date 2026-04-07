# Filesystem Tool

The Filesystem tool provides comprehensive file and directory operations with directory-scoped permissions and optional read-only enforcement. It is one of the most commonly used tools for agents that need to read, write, search, and manage files on the host system.

## Quick Reference

| Property            | Value                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Node name**       | `tools/filesystem`                                                                                                         |
| **Version**         | 0.1.0                                                                                                                      |
| **Library**         | Node.js `fs/promises`                                                                                                      |
| **Actions**         | readFile, writeFile, editFile, listDirectory, searchFiles, fileInfo, moveFile, copyFile, deleteFile, createDirectory, grep |
| **Required config** | `allowedDirectories`                                                                                                       |
| **Tags**            | filesystem, files, read, write, tools, agentic                                                                             |

## Actions

### readFile

Read the contents of a file with optional line-based pagination.

| Parameter  | Type    | Required | Description                                 |
| ---------- | ------- | -------- | ------------------------------------------- |
| `path`     | string  | Yes      | Path to the file                            |
| `encoding` | string  | No       | File encoding (default: `utf-8`)            |
| `offset`   | integer | No       | Line offset to start reading from (0-based) |
| `limit`    | integer | No       | Maximum number of lines to return           |

Returns `{ content, totalLines, offset, linesReturned }` when pagination is used, or `{ content }` when reading the full file.

### writeFile

Write content to a file, creating parent directories as needed.

| Parameter | Type   | Required | Description      |
| --------- | ------ | -------- | ---------------- |
| `path`    | string | Yes      | Target file path |
| `content` | string | Yes      | Content to write |

### editFile

Find and replace text within an existing file.

| Parameter | Type   | Required | Description      |
| --------- | ------ | -------- | ---------------- |
| `path`    | string | Yes      | Path to the file |
| `oldText` | string | Yes      | Text to find     |
| `newText` | string | Yes      | Replacement text |

!!! note
Only the **first occurrence** of `oldText` is replaced (uses `String.replace`, not `replaceAll`).

### listDirectory

List entries in a directory with type information.

| Parameter | Type   | Required | Description    |
| --------- | ------ | -------- | -------------- |
| `path`    | string | Yes      | Directory path |

Returns an array of `{ name, type }` where `type` is `"file"`, `"directory"`, or `"symlink"`.

### searchFiles

Recursively search for files whose names match a regex pattern.

| Parameter | Type   | Required | Description                               |
| --------- | ------ | -------- | ----------------------------------------- |
| `path`    | string | Yes      | Root directory to search                  |
| `pattern` | string | Yes      | Regex pattern to match against file names |

Returns an array of absolute file paths.

### fileInfo

Get metadata about a file or directory.

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `path`    | string | Yes      | Target path |

Returns `{ path, size, isFile, isDirectory, isSymlink, permissions, modified, created, accessed }`.

### moveFile

Move (rename) a file or directory. Both source and destination must be within allowed directories.

| Parameter     | Type   | Required | Description      |
| ------------- | ------ | -------- | ---------------- |
| `path`        | string | Yes      | Source path      |
| `destination` | string | Yes      | Destination path |

### copyFile

Copy a file. Both source and destination must be within allowed directories.

| Parameter     | Type   | Required | Description           |
| ------------- | ------ | -------- | --------------------- |
| `path`        | string | Yes      | Source file path      |
| `destination` | string | Yes      | Destination file path |

### deleteFile

Delete a file or directory.

| Parameter   | Type    | Required | Description                                                |
| ----------- | ------- | -------- | ---------------------------------------------------------- |
| `path`      | string  | Yes      | Path to delete                                             |
| `recursive` | boolean | No       | If true, recursively delete directories (default: `false`) |

### createDirectory

Create a directory, including any missing parent directories.

| Parameter | Type   | Required | Description              |
| --------- | ------ | -------- | ------------------------ |
| `path`    | string | Yes      | Directory path to create |

### grep

Search file contents for lines matching a regex pattern, optionally filtered by file name glob.

| Parameter     | Type    | Required | Description                                                   |
| ------------- | ------- | -------- | ------------------------------------------------------------- |
| `path`        | string  | Yes      | File or directory to search                                   |
| `pattern`     | string  | Yes      | Regex pattern to match against line content                   |
| `recursive`   | boolean | No       | Recurse into subdirectories (default: `true`)                 |
| `filePattern` | string  | No       | Glob pattern to filter which files are searched (e.g. `*.ts`) |

Returns `{ matches: [{ file, line, content }], totalMatches }`.

## Configuration Reference

| Property             | Type     | Default | Required | Description                                                                  |
| -------------------- | -------- | ------- | -------- | ---------------------------------------------------------------------------- |
| `allowedDirectories` | string[] | --      | Yes      | Directories the node is allowed to access. Paths outside these are rejected. |
| `readOnly`           | boolean  | `false` | No       | If true, only read operations are allowed. Write actions throw an error.     |

### Write actions (blocked in read-only mode)

`writeFile`, `editFile`, `moveFile`, `copyFile`, `deleteFile`, `createDirectory`

## Safety

### Directory scoping

Every path passed to the filesystem tool is resolved to an absolute path and checked against the `allowedDirectories` list. A path is considered allowed if it equals or is a child of one of the allowed directories.

### Path traversal blocking

After resolution, the tool checks for remaining `..` segments in the resolved path. If any are found, the operation is rejected with a `"Path traversal detected"` error. This prevents attempts to escape the allowed directory via crafted relative paths.

### Read-only mode

When `readOnly` is set to `true`, any action in the write set (`writeFile`, `editFile`, `moveFile`, `copyFile`, `deleteFile`, `createDirectory`) is rejected before execution.

!!! warning
The `destination` parameter for `moveFile` and `copyFile` is also validated against `allowedDirectories`. You cannot move or copy a file to a location outside the permitted directories.

## Usage Example: Workflow

```typescript
import { filesystemNode } from '@flowforgejs/nodes';

// Use within a workflow definition
const workflow = {
  nodes: [
    {
      id: 'read-config',
      node: filesystemNode,
      config: {
        allowedDirectories: ['/app/config'],
        readOnly: true,
      },
      input: {
        action: 'readFile',
        path: '/app/config/settings.json',
      },
    },
  ],
};
```

## Usage Example: Agent Tool

```typescript
import { filesystemNode } from '@flowforgejs/nodes';
import { nodeAsAgentTool } from '@flowforgejs/engine';

// Convert to an agent tool with injected config
const fsTool = nodeAsAgentTool(filesystemNode);

// The agent can now call actions like:
// { action: "readFile", path: "/workspace/data.csv" }
// { action: "grep", path: "/workspace/src", pattern: "TODO", filePattern: "*.ts" }
```

!!! tip
Use `readFile` with `offset` and `limit` for large files. Reading a 100k-line log file in full wastes context window tokens. Paginate with `offset: 0, limit: 200` and iterate as needed.
