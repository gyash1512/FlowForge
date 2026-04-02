import { describe, it, expect } from 'vitest';
import { mapNode } from '../transform/map.js';
import { filterNode } from '../transform/filter.js';
import { reduceNode } from '../transform/reduce.js';
import { templateNode } from '../transform/template.js';
import { createMockContext } from './helpers.js';

describe('transform/map', () => {
  it('should transform each item using the expression', async () => {
    const ctx = createMockContext({
      input: { data: [1, 2, 3] },
      config: { expression: 'return item * 2' },
    });
    const result = await mapNode.handler(ctx);
    expect(result.data).toEqual([2, 4, 6]);
    expect(result.count).toBe(3);
  });

  it('should pass index to the expression', async () => {
    const ctx = createMockContext({
      input: { data: ['a', 'b', 'c'] },
      config: { expression: 'return item + index' },
    });
    const result = await mapNode.handler(ctx);
    expect(result.data).toEqual(['a0', 'b1', 'c2']);
  });

  it('should handle empty arrays', async () => {
    const ctx = createMockContext({
      input: { data: [] },
      config: { expression: 'return item' },
    });
    const result = await mapNode.handler(ctx);
    expect(result.data).toEqual([]);
    expect(result.count).toBe(0);
  });

  it('should transform objects', async () => {
    const ctx = createMockContext({
      input: { data: [{ name: 'Alice' }, { name: 'Bob' }] },
      config: { expression: 'return { ...item, greeting: "Hello " + item.name }' },
    });
    const result = await mapNode.handler(ctx);
    expect(result.data).toEqual([
      { name: 'Alice', greeting: 'Hello Alice' },
      { name: 'Bob', greeting: 'Hello Bob' },
    ]);
  });
});

describe('transform/filter', () => {
  it('should filter items based on predicate', async () => {
    const ctx = createMockContext({
      input: { data: [1, 2, 3, 4, 5] },
      config: { expression: 'return item > 3' },
    });
    const result = await filterNode.handler(ctx);
    expect(result.data).toEqual([4, 5]);
    expect(result.count).toBe(2);
    expect(result.removedCount).toBe(3);
  });

  it('should return all items when all pass', async () => {
    const ctx = createMockContext({
      input: { data: [10, 20, 30] },
      config: { expression: 'return item > 0' },
    });
    const result = await filterNode.handler(ctx);
    expect(result.data).toEqual([10, 20, 30]);
    expect(result.removedCount).toBe(0);
  });

  it('should return empty array when none pass', async () => {
    const ctx = createMockContext({
      input: { data: [1, 2, 3] },
      config: { expression: 'return item > 100' },
    });
    const result = await filterNode.handler(ctx);
    expect(result.data).toEqual([]);
    expect(result.count).toBe(0);
    expect(result.removedCount).toBe(3);
  });

  it('should filter objects by property', async () => {
    const items = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 17 },
      { name: 'Charlie', age: 25 },
    ];
    const ctx = createMockContext({
      input: { data: items },
      config: { expression: 'return item.age >= 18' },
    });
    const result = await filterNode.handler(ctx);
    expect(result.data).toHaveLength(2);
    expect(result.removedCount).toBe(1);
  });
});

describe('transform/reduce', () => {
  it('should reduce array to single value with initial value', async () => {
    const ctx = createMockContext({
      input: { data: [1, 2, 3, 4], initialValue: 0 },
      config: { expression: 'return accumulator + item' },
    });
    const result = await reduceNode.handler(ctx);
    expect(result.result).toBe(10);
  });

  it('should reduce without initial value', async () => {
    const ctx = createMockContext({
      input: { data: [1, 2, 3, 4] },
      config: { expression: 'return accumulator + item' },
    });
    const result = await reduceNode.handler(ctx);
    expect(result.result).toBe(10);
  });

  it('should build an object from array', async () => {
    const ctx = createMockContext({
      input: {
        data: [
          { key: 'a', val: 1 },
          { key: 'b', val: 2 },
        ],
        initialValue: {},
      },
      config: { expression: 'accumulator[item.key] = item.val; return accumulator' },
    });
    const result = await reduceNode.handler(ctx);
    expect(result.result).toEqual({ a: 1, b: 2 });
  });

  it('should concatenate strings', async () => {
    const ctx = createMockContext({
      input: { data: ['hello', ' ', 'world'], initialValue: '' },
      config: { expression: 'return accumulator + item' },
    });
    const result = await reduceNode.handler(ctx);
    expect(result.result).toBe('hello world');
  });
});

describe('transform/template', () => {
  it('should substitute simple variables', async () => {
    const ctx = createMockContext({
      input: { variables: { name: 'World' } },
      config: { template: 'Hello, {{name}}!' },
    });
    const result = await templateNode.handler(ctx);
    expect(result.result).toBe('Hello, World!');
  });

  it('should handle nested variable access', async () => {
    const ctx = createMockContext({
      input: { variables: { user: { name: 'Alice', email: 'alice@example.com' } } },
      config: { template: '{{user.name}} <{{user.email}}>' },
    });
    const result = await templateNode.handler(ctx);
    expect(result.result).toBe('Alice <alice@example.com>');
  });

  it('should replace missing variables with empty string', async () => {
    const ctx = createMockContext({
      input: { variables: { name: 'Alice' } },
      config: { template: '{{name}} - {{missing}}' },
    });
    const result = await templateNode.handler(ctx);
    expect(result.result).toBe('Alice - ');
  });

  it('should handle multiple occurrences of same variable', async () => {
    const ctx = createMockContext({
      input: { variables: { x: 'test' } },
      config: { template: '{{x}}-{{x}}-{{x}}' },
    });
    const result = await templateNode.handler(ctx);
    expect(result.result).toBe('test-test-test');
  });

  it('should handle templates with no variables', async () => {
    const ctx = createMockContext({
      input: { variables: {} },
      config: { template: 'No variables here' },
    });
    const result = await templateNode.handler(ctx);
    expect(result.result).toBe('No variables here');
  });

  it('should handle whitespace in variable names', async () => {
    const ctx = createMockContext({
      input: { variables: { name: 'Bob' } },
      config: { template: 'Hi {{ name }}!' },
    });
    const result = await templateNode.handler(ctx);
    expect(result.result).toBe('Hi Bob!');
  });
});
