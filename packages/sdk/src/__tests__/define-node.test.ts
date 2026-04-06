import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defineNode } from '../define-node.js';

describe('defineNode', () => {
  it('creates a node definition with all fields', () => {
    const node = defineNode({
      name: 'custom/greet',
      version: '1.0.0',
      description: 'Greets a user',
      category: 'custom',
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.string(),
      configSchema: z.object({ prefix: z.string().default('Hello') }),
      handler: async (ctx) => `${(ctx.config as { prefix: string }).prefix}, ${(ctx.input as { name: string }).name}!`,
      tags: ['greet'],
      author: 'test',
    });

    expect(node.name).toBe('custom/greet');
    expect(node.version).toBe('1.0.0');
    expect(node.category).toBe('custom');
    expect(node.retries).toBe(3); // default
    expect(node.tags).toEqual(['greet']);
    expect(node.handler).toBeDefined();
  });

  it('validates input schema correctly', () => {
    const node = defineNode({
      name: 'data/fetch',
      version: '1.0.0',
      description: 'Fetches data',
      category: 'data',
      inputSchema: z.object({ url: z.string().url() }),
      outputSchema: z.any(),
      configSchema: z.object({}),
      handler: async (ctx) => (ctx.input as { url: string }).url,
    });

    const validInput = node.inputSchema.safeParse({ url: 'https://example.com' });
    expect(validInput.success).toBe(true);

    const invalidInput = node.inputSchema.safeParse({ url: 'not-a-url' });
    expect(invalidInput.success).toBe(false);
  });

  it('applies custom retries and timeout', () => {
    const node = defineNode({
      name: 'test/slow',
      version: '1.0.0',
      description: 'Slow node',
      category: 'custom',
      inputSchema: z.any(),
      outputSchema: z.any(),
      configSchema: z.any(),
      handler: async () => 'done',
      retries: 5,
      timeout: 60000,
    });

    expect(node.retries).toBe(5);
    expect(node.timeout).toBe(60000);
  });

  it('includes lifecycle hooks', () => {
    const onInit = async () => {};
    const onDestroy = async () => {};
    const onError = async () => {};

    const node = defineNode({
      name: 'test/lifecycle',
      version: '1.0.0',
      description: 'Lifecycle node',
      category: 'custom',
      inputSchema: z.any(),
      outputSchema: z.any(),
      configSchema: z.any(),
      handler: async () => 'ok',
      onInit,
      onDestroy,
      onError,
    });

    expect(node.onInit).toBe(onInit);
    expect(node.onDestroy).toBe(onDestroy);
    expect(node.onError).toBe(onError);
  });
});
