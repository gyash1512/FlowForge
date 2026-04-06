import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { nodeAsAgentTool, nodesToAgentTools } from '../node-as-tool.js';
import type { NodeDefinition, NodeContext, AIContext, WorkflowEvent, WorkflowMetadata } from '@flowforge/shared';

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function makeNode(
  name: string,
  description: string,
  handler: (ctx: NodeContext) => Promise<unknown>,
  overrides?: Partial<NodeDefinition>,
): NodeDefinition {
  return {
    name,
    version: '1.0.0',
    description,
    category: 'custom' as const,
    inputSchema: z.any(),
    outputSchema: z.any(),
    configSchema: z.any(),
    handler,
    ...overrides,
  };
}

function makeContext(input: unknown = {}): NodeContext {
  const noopAI: AIContext = {
    generateText: async () => ({ text: '', toolCalls: [], toolResults: [] }),
    streamText: async () => ({
      textStream: (async function* () {})(),
      text: Promise.resolve(''),
    }),
    generateObject: async () => ({ object: {} }),
    embed: async () => ({ embedding: [] }),
  };

  const event: WorkflowEvent = {
    id: 'evt_test',
    type: 'test',
    data: input,
    timestamp: new Date(),
  };

  const metadata: WorkflowMetadata = {
    runId: 'run_test123',
    workflowId: 'wf_test',
    workflowName: 'test-workflow',
    attempt: 1,
    startedAt: new Date(),
  };

  return {
    input,
    config: {},
    event,
    steps: {},
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      child: () => makeContext(input).logger,
    },
    signal: new AbortController().signal,
    metadata,
    ai: noopAI,
    pull: async () => {
      throw new Error('not available');
    },
    push: async () => {
      throw new Error('not available');
    },
    integrate: async () => {
      throw new Error('not available');
    },
    emit: async () => {},
    wait: async () => ({}),
    sleep: async (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    checkpoint: async () => {},
  };
}

// ────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────

describe('nodeAsAgentTool', () => {
  it('preserves the node description on the tool', () => {
    const node = makeNode('test/echo', 'Echoes back the input', async (ctx) => ctx.input);
    const tool = nodeAsAgentTool(node);

    expect(tool.description).toBe('Echoes back the input');
  });

  it('preserves the node inputSchema on the tool', () => {
    const schema = z.object({ message: z.string() });
    const node = makeNode('test/typed', 'Typed node', async (ctx) => ctx.input, {
      inputSchema: schema,
    });
    const tool = nodeAsAgentTool(node);

    expect(tool.inputSchema).toBe(schema);
  });

  it('executes the node handler when the tool handler is called', async () => {
    const handler = vi.fn().mockResolvedValue({ result: 42 });
    const node = makeNode('test/compute', 'Compute something', handler);
    const tool = nodeAsAgentTool(node);

    const ctx = makeContext();
    const result = await tool.handler(ctx, { value: 21 });

    expect(result).toEqual({ result: 42 });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('passes the tool input as ctx.input to the node handler', async () => {
    const node = makeNode('test/passthrough', 'Passthrough', async (ctx) => ctx.input);
    const tool = nodeAsAgentTool(node);

    const ctx = makeContext({ original: 'context-input' });
    const toolInput = { tool: 'specific-input' };
    const result = await tool.handler(ctx, toolInput);

    // The tool input should replace the original context input
    expect(result).toEqual({ tool: 'specific-input' });
  });

  it('provides an empty config to the node handler', async () => {
    let capturedConfig: unknown;
    const node = makeNode('test/config-check', 'Config check', async (ctx) => {
      capturedConfig = ctx.config;
      return {};
    });
    const tool = nodeAsAgentTool(node);

    const ctx = makeContext();
    await tool.handler(ctx, {});

    expect(capturedConfig).toEqual({});
  });

  it('propagates errors from the node handler', async () => {
    const node = makeNode('test/failing', 'Always fails', async () => {
      throw new Error('node handler error');
    });
    const tool = nodeAsAgentTool(node);

    const ctx = makeContext();
    await expect(tool.handler(ctx, {})).rejects.toThrow('node handler error');
  });
});

describe('nodesToAgentTools', () => {
  it('converts multiple nodes into a tools record', () => {
    const nodeA = makeNode('test/a', 'Node A', async () => 'a');
    const nodeB = makeNode('test/b', 'Node B', async () => 'b');

    const tools = nodesToAgentTools({ alpha: nodeA, beta: nodeB });

    expect(Object.keys(tools)).toEqual(['alpha', 'beta']);
    expect(tools['alpha']!.description).toBe('Node A');
    expect(tools['beta']!.description).toBe('Node B');
  });

  it('returns an empty record for empty input', () => {
    const tools = nodesToAgentTools({});
    expect(tools).toEqual({});
  });

  it('produces tools that are independently executable', async () => {
    const nodeA = makeNode('test/add', 'Add 10', async (ctx) => {
      return (ctx.input as { n: number }).n + 10;
    });
    const nodeB = makeNode('test/mul', 'Multiply by 3', async (ctx) => {
      return (ctx.input as { n: number }).n * 3;
    });

    const tools = nodesToAgentTools({ add: nodeA, mul: nodeB });
    const ctx = makeContext();

    const addResult = await tools['add']!.handler(ctx, { n: 5 });
    const mulResult = await tools['mul']!.handler(ctx, { n: 7 });

    expect(addResult).toBe(15);
    expect(mulResult).toBe(21);
  });
});
