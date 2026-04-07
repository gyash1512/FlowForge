# Document Parser Tool

The Document Parser tool reads and parses structured documents -- PDF, JSON, CSV, and plain text -- from file paths or base64-encoded content. It supports directory-scoped access control and file size limits.

## Quick Reference

| Property      | Value                                               |
| ------------- | --------------------------------------------------- |
| **Node name** | `tools/document-parser`                             |
| **Version**   | 0.1.0                                               |
| **Library**   | pdf-parse (for PDF), built-in (for JSON, CSV, text) |
| **Actions**   | parsePdf, parseJson, parseCsv, parseText            |
| **Tags**      | parser, pdf, csv, json, documents, tools, agentic   |

## Actions

### parsePdf

Parse a PDF document and extract text content and metadata.

| Parameter    | Type   | Required | Description                          |
| ------------ | ------ | -------- | ------------------------------------ |
| `source`     | string | Yes      | File path or base64-encoded PDF      |
| `sourceType` | enum   | No       | `file` or `base64` (default: `file`) |

Returns:

```json
{
  "text": "extracted text content...",
  "pages": 12,
  "info": {
    "title": "Document Title",
    "author": "Author Name",
    "pages": 12
  }
}
```

### parseJson

Parse a JSON file or base64-encoded JSON string.

| Parameter    | Type   | Required | Description                          |
| ------------ | ------ | -------- | ------------------------------------ |
| `source`     | string | Yes      | File path or base64-encoded JSON     |
| `sourceType` | enum   | No       | `file` or `base64` (default: `file`) |

Returns the parsed JSON value directly as `data`.

### parseCsv

Parse a CSV file with configurable delimiter and header handling.

| Parameter           | Type    | Required | Description                                         |
| ------------------- | ------- | -------- | --------------------------------------------------- |
| `source`            | string  | Yes      | File path or base64-encoded CSV                     |
| `sourceType`        | enum    | No       | `file` or `base64` (default: `file`)                |
| `options.delimiter` | string  | No       | Column delimiter (default: `,`)                     |
| `options.header`    | boolean | No       | Whether the first row is a header (default: `true`) |

Returns:

```json
{
  "headers": ["name", "value", "category"],
  "rows": [
    ["alice", "10", "A"],
    ["bob", "20", "B"]
  ],
  "rowCount": 2
}
```

When `header` is `false`, the `headers` field is `null`.

### parseText

Parse a plain text file with optional line-based pagination.

| Parameter        | Type   | Required | Description                          |
| ---------------- | ------ | -------- | ------------------------------------ |
| `source`         | string | Yes      | File path or base64-encoded text     |
| `sourceType`     | enum   | No       | `file` or `base64` (default: `file`) |
| `options.offset` | number | No       | Starting line number (default: 0)    |
| `options.limit`  | number | No       | Maximum number of lines to return    |

Returns:

```json
{
  "lines": ["line 1", "line 2", "..."],
  "lineCount": 1000,
  "offset": 0,
  "limit": 1000
}
```

## Output Schema

| Field     | Type    | Description                                          |
| --------- | ------- | ---------------------------------------------------- |
| `data`    | object  | Parsed document content (structure varies by action) |
| `format`  | string  | Format identifier: `pdf`, `json`, `csv`, or `text`   |
| `success` | boolean | `true` on success                                    |

## Configuration Reference

| Property             | Type     | Default            | Description                                                                                 |
| -------------------- | -------- | ------------------ | ------------------------------------------------------------------------------------------- |
| `allowedDirectories` | string[] | (none)             | If set, file paths must be within these directories. Not enforced for `base64` source type. |
| `maxFileSize`        | integer  | `50000000` (50 MB) | Maximum file size in bytes. Files exceeding this limit are rejected.                        |

## Source Types

The `sourceType` parameter controls how the `source` string is interpreted:

| Source Type | Behavior                                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------- |
| `file`      | Treat `source` as a file path. Read the file from disk. Subject to `allowedDirectories` and `maxFileSize` checks. |
| `base64`    | Treat `source` as base64-encoded content. Decode it in memory. Not subject to directory restrictions.             |

## Safety

### Directory scoping

When `sourceType` is `file`, the file path is resolved and checked against `allowedDirectories`. If the path does not fall within an allowed directory, access is denied.

### File size limits

Before reading a file, its size is checked against `maxFileSize`. Files exceeding the limit are rejected with a descriptive error.

!!! note
Directory restrictions and file size checks only apply to `file` source type. Base64 input bypasses directory checks (since there is no file path), but the decoded content is still limited by available memory.

## Usage Example

```typescript
import { documentParserNode } from '@flowforgejs/nodes';

const workflow = {
  nodes: [
    {
      id: 'parse-report',
      node: documentParserNode,
      config: {
        allowedDirectories: ['/data/reports'],
        maxFileSize: 10_000_000,
      },
      input: {
        action: 'parseCsv',
        source: '/data/reports/quarterly-sales.csv',
        sourceType: 'file',
        options: {
          delimiter: ',',
          header: true,
        },
      },
    },
  ],
};
```

### Base64 Example

```typescript
// Parse a CSV passed as base64 (e.g. from an API response)
{
  action: 'parseCsv',
  source: Buffer.from('name,score\nalice,95\nbob,87').toString('base64'),
  sourceType: 'base64',
  options: { delimiter: ',', header: true },
}
```

!!! tip
Use `parseText` with `offset` and `limit` for large log files. This avoids loading the entire file into the LLM context window and allows incremental processing.
