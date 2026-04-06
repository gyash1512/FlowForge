import { describe, it, expect } from 'vitest';
import { validateNodeDefinition } from '../commands/node-cmd.js';

function createMockSchema() {
  return {
    parse: (v: unknown) => v,
    safeParse: (v: unknown) => ({ success: true, data: v }),
  };
}

function createValidNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'test-node',
    version: '1.0.0',
    description: 'A test node',
    category: 'data',
    inputSchema: createMockSchema(),
    outputSchema: createMockSchema(),
    configSchema: createMockSchema(),
    handler: async () => ({}),
    tags: ['test'],
    retries: 3,
    timeout: 30000,
    ...overrides,
  };
}

describe('validateNodeDefinition', () => {
  it('should pass for a valid node definition', () => {
    const node = createValidNode();
    const result = validateNodeDefinition(node);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail if input is not an object', () => {
    const result = validateNodeDefinition(null as unknown as Record<string, unknown>);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Node definition must be an object');
  });

  describe('required fields', () => {
    it('should report missing "name"', () => {
      const node = createValidNode();
      delete node.name;
      const result = validateNodeDefinition(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: "name"');
    });

    it('should report missing "version"', () => {
      const node = createValidNode();
      delete node.version;
      const result = validateNodeDefinition(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: "version"');
    });

    it('should report missing "description"', () => {
      const node = createValidNode();
      delete node.description;
      const result = validateNodeDefinition(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: "description"');
    });

    it('should report missing "category"', () => {
      const node = createValidNode();
      delete node.category;
      const result = validateNodeDefinition(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: "category"');
    });

    it('should report missing "inputSchema"', () => {
      const node = createValidNode();
      delete node.inputSchema;
      const result = validateNodeDefinition(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: "inputSchema"');
    });

    it('should report missing "outputSchema"', () => {
      const node = createValidNode();
      delete node.outputSchema;
      const result = validateNodeDefinition(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: "outputSchema"');
    });

    it('should report missing "configSchema"', () => {
      const node = createValidNode();
      delete node.configSchema;
      const result = validateNodeDefinition(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: "configSchema"');
    });

    it('should report missing "handler"', () => {
      const node = createValidNode();
      delete node.handler;
      const result = validateNodeDefinition(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: "handler"');
    });

    it('should report all missing required fields at once', () => {
      const result = validateNodeDefinition({});

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(8);
    });
  });

  describe('type validation', () => {
    it('should fail if "name" is not a string', () => {
      const node = createValidNode({ name: 123 });
      const result = validateNodeDefinition(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"name" must be a string');
    });

    it('should fail if "name" is empty', () => {
      const node = createValidNode({ name: '' });
      const result = validateNodeDefinition(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"name" must not be empty');
    });

    it('should fail if "version" is not a string', () => {
      const node = createValidNode({ version: 1 });
      const result = validateNodeDefinition(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"version" must be a string');
    });

    it('should fail if "description" is not a string', () => {
      const node = createValidNode({ description: true });
      const result = validateNodeDefinition(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"description" must be a string');
    });

    it('should fail if "handler" is not a function', () => {
      const node = createValidNode({ handler: 'not a function' });
      const result = validateNodeDefinition(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"handler" must be a function');
    });
  });

  describe('category validation', () => {
    it('should accept valid categories', () => {
      for (const category of ['data', 'communication', 'ai', 'control', 'transform', 'custom']) {
        const node = createValidNode({ category });
        const result = validateNodeDefinition(node);

        expect(result.valid).toBe(true);
      }
    });

    it('should reject invalid category', () => {
      const node = createValidNode({ category: 'invalid' });
      const result = validateNodeDefinition(node);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('"category" must be one of');
      expect(result.errors[0]).toContain('invalid');
    });

    it('should fail if "category" is not a string', () => {
      const node = createValidNode({ category: 42 });
      const result = validateNodeDefinition(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"category" must be a string');
    });
  });

  describe('schema validation', () => {
    it('should fail if inputSchema has no .parse method', () => {
      const node = createValidNode({ inputSchema: { notASchema: true } });
      const result = validateNodeDefinition(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"inputSchema" must be a Zod schema (must have a .parse method)');
    });

    it('should fail if outputSchema has no .parse method', () => {
      const node = createValidNode({ outputSchema: 'string' });
      const result = validateNodeDefinition(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"outputSchema" must be a Zod schema (must have a .parse method)');
    });

    it('should fail if configSchema has no .parse method', () => {
      const node = createValidNode({ configSchema: null });
      const result = validateNodeDefinition(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"configSchema" must be a Zod schema (must have a .parse method)');
    });
  });

  describe('warnings', () => {
    it('should warn about missing tags', () => {
      const node = createValidNode({ tags: undefined });
      delete node.tags;
      const result = validateNodeDefinition(node);

      expect(result.warnings).toContain('Consider adding "tags" for discoverability');
    });

    it('should warn about missing retries', () => {
      const node = createValidNode({ retries: undefined });
      delete node.retries;
      const result = validateNodeDefinition(node);

      expect(result.warnings).toContain('Consider specifying "retries" for fault tolerance');
    });

    it('should warn about missing timeout', () => {
      const node = createValidNode({ timeout: undefined });
      delete node.timeout;
      const result = validateNodeDefinition(node);

      expect(result.warnings).toContain('Consider specifying "timeout" to prevent runaway executions');
    });

    it('should not warn when all optional fields are present', () => {
      const node = createValidNode();
      const result = validateNodeDefinition(node);

      expect(result.warnings).toHaveLength(0);
    });
  });
});
