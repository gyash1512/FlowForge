import { describe, it, expect, vi } from 'vitest';
import { postgresNode } from '../data/postgres.js';
import { redisNode } from '../data/redis.js';
import { mongodbNode } from '../data/mongodb.js';
import { createMockContext } from './helpers.js';

describe('data/postgres', () => {
  it('should execute a raw query', async () => {
    const pull = vi.fn().mockResolvedValue({
      rows: [{ id: 1, name: 'Alice' }],
      rowCount: 1,
    });
    const ctx = createMockContext({
      input: {
        action: 'query' as const,
        query: 'SELECT * FROM users WHERE id = $1',
        params: [1],
      },
      config: { connectionId: 'pg-main' },
      pull,
    });

    const result = (await postgresNode.handler(ctx)) as Record<string, unknown>;

    expect(pull).toHaveBeenCalledWith('postgres', {
      connectionId: 'pg-main',
      query: 'SELECT * FROM users WHERE id = $1',
      params: [1],
    });
    expect(result.rows).toEqual([{ id: 1, name: 'Alice' }]);
    expect(result.rowCount).toBe(1);
    expect(result.command).toBe('SELECT');
  });

  it('should insert a record', async () => {
    const push = vi.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });
    const ctx = createMockContext({
      input: {
        action: 'insert' as const,
        table: 'users',
        data: { name: 'Bob', email: 'bob@example.com' },
        returning: ['id'],
      },
      config: { connectionId: 'pg-main' },
      push,
    });

    const result = (await postgresNode.handler(ctx)) as Record<string, unknown>;

    expect(push).toHaveBeenCalledWith(
      'postgres',
      expect.objectContaining({
        connectionId: 'pg-main',
        params: ['Bob', 'bob@example.com'],
      }),
    );
    expect(result.command).toBe('INSERT');
  });

  it('should throw if query is missing for query action', async () => {
    const ctx = createMockContext({
      input: { action: 'query' as const },
      config: { connectionId: 'pg-main' },
    });

    await expect(postgresNode.handler(ctx)).rejects.toThrow('query is required');
  });

  it('should upsert with conflict columns', async () => {
    const push = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const ctx = createMockContext({
      input: {
        action: 'upsert' as const,
        table: 'users',
        data: { email: 'bob@example.com', name: 'Bob Updated' },
        conflictColumns: ['email'],
      },
      config: { connectionId: 'pg-main' },
      push,
    });

    const result = (await postgresNode.handler(ctx)) as Record<string, unknown>;

    const call = push.mock.calls[0];
    expect(call?.[0]).toBe('postgres');
    const query = (call?.[1] as { query: string }).query;
    expect(query).toContain('ON CONFLICT');
    expect(query).toContain('DO UPDATE SET');
    expect(result.command).toBe('UPSERT');
  });

  it('should update records with where clause', async () => {
    const push = vi.fn().mockResolvedValue({ rows: [], rowCount: 2 });
    const ctx = createMockContext({
      input: {
        action: 'update' as const,
        table: 'users',
        data: { active: false },
        where: { role: 'guest' },
      },
      config: { connectionId: 'pg-main' },
      push,
    });

    const result = (await postgresNode.handler(ctx)) as Record<string, unknown>;

    expect(result.command).toBe('UPDATE');
    expect(result.rowCount).toBe(2);
  });

  it('should delete records', async () => {
    const push = vi.fn().mockResolvedValue({ rows: [], rowCount: 3 });
    const ctx = createMockContext({
      input: {
        action: 'delete' as const,
        table: 'users',
        where: { active: false },
      },
      config: { connectionId: 'pg-main' },
      push,
    });

    const result = (await postgresNode.handler(ctx)) as Record<string, unknown>;

    expect(result.command).toBe('DELETE');
    expect(result.rowCount).toBe(3);
  });
});

describe('data/redis', () => {
  it('should get a value', async () => {
    const pull = vi.fn().mockResolvedValue('cached-value');
    const ctx = createMockContext({
      input: { action: 'get' as const, key: 'my-key' },
      config: { connectionId: 'redis-main' },
      pull,
    });

    const result = (await redisNode.handler(ctx)) as Record<string, unknown>;

    expect(pull).toHaveBeenCalledWith('redis', {
      connectionId: 'redis-main',
      command: 'GET',
      args: ['my-key'],
    });
    expect(result.value).toBe('cached-value');
    expect(result.success).toBe(true);
  });

  it('should set a value with TTL', async () => {
    const push = vi.fn().mockResolvedValue('OK');
    const ctx = createMockContext({
      input: { action: 'set' as const, key: 'my-key', value: 'my-value', ttl: 3600 },
      config: { connectionId: 'redis-main' },
      push,
    });

    const result = (await redisNode.handler(ctx)) as Record<string, unknown>;

    expect(push).toHaveBeenCalledWith('redis', {
      connectionId: 'redis-main',
      command: 'SET',
      args: ['my-key', 'my-value', 'EX', 3600],
    });
    expect(result.success).toBe(true);
  });

  it('should delete a key', async () => {
    const push = vi.fn().mockResolvedValue(1);
    const ctx = createMockContext({
      input: { action: 'delete' as const, key: 'my-key' },
      config: { connectionId: 'redis-main' },
      push,
    });

    const result = (await redisNode.handler(ctx)) as Record<string, unknown>;

    expect(push).toHaveBeenCalledWith('redis', {
      connectionId: 'redis-main',
      command: 'DEL',
      args: ['my-key'],
    });
    expect(result.success).toBe(true);
  });

  it('should increment a value', async () => {
    const push = vi.fn().mockResolvedValue(42);
    const ctx = createMockContext({
      input: { action: 'incr' as const, key: 'counter' },
      config: { connectionId: 'redis-main' },
      push,
    });

    const result = (await redisNode.handler(ctx)) as Record<string, unknown>;

    expect(push).toHaveBeenCalledWith('redis', {
      connectionId: 'redis-main',
      command: 'INCR',
      args: ['counter'],
    });
    expect(result.value).toBe(42);
  });

  it('should get a hash field', async () => {
    const pull = vi.fn().mockResolvedValue('hash-value');
    const ctx = createMockContext({
      input: { action: 'hget' as const, key: 'myhash', field: 'myfield' },
      config: { connectionId: 'redis-main' },
      pull,
    });

    const result = (await redisNode.handler(ctx)) as Record<string, unknown>;

    expect(pull).toHaveBeenCalledWith('redis', {
      connectionId: 'redis-main',
      command: 'HGET',
      args: ['myhash', 'myfield'],
    });
    expect(result.value).toBe('hash-value');
  });

  it('should throw when publish is called without channel', async () => {
    const ctx = createMockContext({
      input: { action: 'publish' as const, key: 'unused' },
      config: { connectionId: 'redis-main' },
    });

    await expect(redisNode.handler(ctx)).rejects.toThrow('channel is required');
  });

  it('should lrange with default start/stop', async () => {
    const pull = vi.fn().mockResolvedValue(['a', 'b', 'c']);
    const ctx = createMockContext({
      input: { action: 'lrange' as const, key: 'mylist' },
      config: { connectionId: 'redis-main' },
      pull,
    });

    const result = (await redisNode.handler(ctx)) as Record<string, unknown>;

    expect(pull).toHaveBeenCalledWith('redis', {
      connectionId: 'redis-main',
      command: 'LRANGE',
      args: ['mylist', 0, -1],
    });
    expect(result.value).toEqual(['a', 'b', 'c']);
  });
});

describe('data/mongodb', () => {
  it('should find documents', async () => {
    const docs = [
      { _id: '1', name: 'Alice' },
      { _id: '2', name: 'Bob' },
    ];
    const pull = vi.fn().mockResolvedValue(docs);
    const ctx = createMockContext({
      input: {
        action: 'find' as const,
        collection: 'users',
        filter: { active: true },
      },
      config: { connectionId: 'mongo-main', database: 'mydb' },
      pull,
    });

    const result = (await mongodbNode.handler(ctx)) as Record<string, unknown>;

    expect(pull).toHaveBeenCalledWith(
      'mongodb',
      expect.objectContaining({
        connectionId: 'mongo-main',
        database: 'mydb',
        collection: 'users',
        operation: 'find',
        filter: { active: true },
      }),
    );
    expect(result.data).toEqual(docs);
  });

  it('should insertOne document', async () => {
    const push = vi.fn().mockResolvedValue({ insertedCount: 1, insertedId: 'abc' });
    const ctx = createMockContext({
      input: {
        action: 'insertOne' as const,
        collection: 'users',
        document: { name: 'Charlie', age: 30 },
      },
      config: { connectionId: 'mongo-main', database: 'mydb' },
      push,
    });

    const result = (await mongodbNode.handler(ctx)) as Record<string, unknown>;

    expect(push).toHaveBeenCalledWith(
      'mongodb',
      expect.objectContaining({
        operation: 'insertOne',
        document: { name: 'Charlie', age: 30 },
      }),
    );
    expect(result.insertedCount).toBe(1);
  });

  it('should throw when insertOne is called without document', async () => {
    const ctx = createMockContext({
      input: { action: 'insertOne' as const, collection: 'users' },
      config: { connectionId: 'mongo-main', database: 'mydb' },
    });

    await expect(mongodbNode.handler(ctx)).rejects.toThrow('document is required');
  });

  it('should aggregate with pipeline', async () => {
    const pipeline = [
      { $match: { status: 'active' } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ];
    const pull = vi.fn().mockResolvedValue([{ _id: 'A', count: 5 }]);
    const ctx = createMockContext({
      input: {
        action: 'aggregate' as const,
        collection: 'orders',
        pipeline,
      },
      config: { connectionId: 'mongo-main', database: 'mydb' },
      pull,
    });

    const result = (await mongodbNode.handler(ctx)) as Record<string, unknown>;

    expect(pull).toHaveBeenCalledWith(
      'mongodb',
      expect.objectContaining({
        operation: 'aggregate',
        pipeline,
      }),
    );
    expect(result.data).toEqual([{ _id: 'A', count: 5 }]);
  });

  it('should deleteOne with filter', async () => {
    const push = vi.fn().mockResolvedValue({ deletedCount: 1 });
    const ctx = createMockContext({
      input: {
        action: 'deleteOne' as const,
        collection: 'users',
        filter: { _id: '123' },
      },
      config: { connectionId: 'mongo-main', database: 'mydb' },
      push,
    });

    const result = (await mongodbNode.handler(ctx)) as Record<string, unknown>;

    expect(result.deletedCount).toBe(1);
  });
});
