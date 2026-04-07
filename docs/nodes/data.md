# Data Nodes

Data nodes connect workflows to databases, object stores, message brokers, and HTTP endpoints. All data nodes follow a consistent pattern: they use `ctx.pull()` for reads and `ctx.push()` for writes, routing through registered data adaptors.

## Overview

| Node                 | Description                                   | Actions                                                                |
| -------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| `data/postgres`      | PostgreSQL queries and mutations              | `query`, `insert`, `upsert`, `update`, `delete`                        |
| `data/redis`         | Redis key-value, list, and pub/sub operations | `get`, `set`, `delete`, `lpush`, `lrange`, `publish`, `subscribe`      |
| `data/mongodb`       | MongoDB document operations                   | `find`, `findOne`, `insertOne`, `insertMany`, `updateOne`, `deleteOne` |
| `data/s3`            | AWS S3 object storage                         | `getObject`, `putObject`, `deleteObject`, `listObjects`, `copyObject`  |
| `data/http`          | HTTP client for REST APIs                     | `get`, `post`, `put`, `patch`, `delete`, `head`                        |
| `data/elasticsearch` | Elasticsearch search and indexing             | `search`, `index`, `update`, `delete`, `bulk`                          |
| `data/kafka`         | Apache Kafka produce and consume              | `produce`, `consume`, `createTopic`                                    |
| `data/pinecone`      | Pinecone vector database                      | `upsert`, `query`, `delete`, `fetch`, `listIndexes`                    |

## The pull/push Pattern

Every data node uses the engine's adaptor system. When a node calls `ctx.pull('postgres', params)` or `ctx.push('postgres', params)`, the engine routes the request to the registered data adaptor for that source:

```typescript
// Register adaptors at engine startup
engine.registerAdaptor(postgresAdaptor);
engine.registerAdaptor(redisAdaptor);

// In a node handler, pull reads data:
const result = await ctx.pull('postgres', {
  connectionId: 'main-db',
  query: 'SELECT * FROM users WHERE active = $1',
  params: [true],
});

// push writes data:
await ctx.push('postgres', {
  connectionId: 'main-db',
  query: 'INSERT INTO logs (message) VALUES ($1)',
  params: ['event processed'],
});
```

---

## postgres

Execute queries and mutations against a PostgreSQL database.

**Input:**

| Field             | Type                                                      | Required                 | Description              |
| ----------------- | --------------------------------------------------------- | ------------------------ | ------------------------ |
| `action`          | `'query' \| 'insert' \| 'upsert' \| 'update' \| 'delete'` | Yes                      | Operation type           |
| `table`           | `string`                                                  | For mutations            | Target table             |
| `query`           | `string`                                                  | For `query`              | Raw SQL query            |
| `params`          | `unknown[]`                                               | No                       | Query parameters         |
| `data`            | `Record<string, unknown>`                                 | For insert/upsert/update | Column values            |
| `where`           | `Record<string, unknown>`                                 | For update/delete        | WHERE conditions         |
| `conflictColumns` | `string[]`                                                | For `upsert`             | ON CONFLICT columns      |
| `returning`       | `string[]`                                                | No                       | RETURNING clause columns |

**Config:** `{ connectionId: string }`

**Output:** `{ rows: Record<string, unknown>[], rowCount: number, command: string }`

```typescript
import { postgresNode } from '@flowforgejs/nodes';

// Query
workflow('db-query')
  .trigger({ type: 'manual' })
  .node('fetch-users', postgresNode, {
    config: { connectionId: 'main-db' },
    input: () => ({
      action: 'query' as const,
      query: 'SELECT id, name, email FROM users WHERE active = $1 LIMIT $2',
      params: [true, 100],
    }),
  })
  .build();

// Upsert
workflow('db-upsert')
  .trigger({ type: 'event', event: 'user.synced' })
  .node('upsert-user', postgresNode, {
    config: { connectionId: 'main-db' },
    input: (ctx) => ({
      action: 'upsert' as const,
      table: 'users',
      data: ctx.event.data as Record<string, unknown>,
      conflictColumns: ['email'],
      returning: ['id'],
    }),
  })
  .build();
```

---

## redis

Perform key-value, list, and pub/sub operations on Redis.

**Common actions:** `get`, `set`, `delete`, `lpush`, `lrange`, `publish`, `subscribe`

```typescript
import { redisNode } from '@flowforgejs/nodes';

workflow('cache')
  .trigger({ type: 'event', event: 'data.computed' })
  .node('cache-result', redisNode, {
    config: { connectionId: 'cache' },
    input: (ctx) => ({
      action: 'set',
      key: `result:${(ctx.event.data as { id: string }).id}`,
      value: JSON.stringify(ctx.event.data),
      ttl: 3600,
    }),
  })
  .build();
```

---

## http

General-purpose HTTP client for calling REST APIs.

**Common actions:** `get`, `post`, `put`, `patch`, `delete`, `head`

```typescript
import { httpNode } from '@flowforgejs/nodes';

workflow('api-call')
  .trigger({ type: 'manual' })
  .node('fetch-data', httpNode, {
    config: {},
    input: () => ({
      action: 'get',
      url: 'https://api.example.com/data',
      headers: { Authorization: 'Bearer token123' },
      timeout: 10_000,
    }),
  })
  .build();
```

---

## mongodb

Perform document operations on MongoDB collections.

**Common actions:** `find`, `findOne`, `insertOne`, `insertMany`, `updateOne`, `deleteOne`

```typescript
import { mongodbNode } from '@flowforgejs/nodes';

workflow('mongo-insert')
  .trigger({ type: 'event', event: 'order.placed' })
  .node('save-order', mongodbNode, {
    config: { connectionId: 'orders-db' },
    input: (ctx) => ({
      action: 'insertOne',
      collection: 'orders',
      document: ctx.event.data,
    }),
  })
  .build();
```

---

## s3

Interact with AWS S3 or S3-compatible object storage.

**Common actions:** `getObject`, `putObject`, `deleteObject`, `listObjects`, `copyObject`

```typescript
import { s3Node } from '@flowforgejs/nodes';

workflow('upload')
  .trigger({ type: 'event', event: 'file.ready' })
  .node('upload-to-s3', s3Node, {
    config: { connectionId: 'assets' },
    input: (ctx) => ({
      action: 'putObject',
      bucket: 'my-bucket',
      key: `uploads/${(ctx.event.data as { filename: string }).filename}`,
      body: (ctx.event.data as { content: string }).content,
      contentType: 'application/octet-stream',
    }),
  })
  .build();
```

---

## elasticsearch

Search and index documents in Elasticsearch.

**Common actions:** `search`, `index`, `update`, `delete`, `bulk`

---

## kafka

Produce and consume messages with Apache Kafka.

**Common actions:** `produce`, `consume`, `createTopic`

---

## pinecone

Operate on a Pinecone vector database for similarity search and retrieval.

**Common actions:** `upsert`, `query`, `delete`, `fetch`, `listIndexes`

```typescript
import { pineconeNode } from '@flowforgejs/nodes';

workflow('semantic-search')
  .trigger({ type: 'manual' })
  .node('search-vectors', pineconeNode, {
    config: { connectionId: 'vectors' },
    input: (ctx) => ({
      action: 'query',
      vector: (ctx.steps as { embed: { embedding: number[] } }).embed.embedding,
      topK: 10,
      namespace: 'documents',
    }),
  })
  .build();
```

!!! tip "Combining with embed"
Pinecone pairs naturally with the `ai/embed` node. Generate an embedding first, then query Pinecone for similar vectors in a two-step workflow.
