import type { NodeDefinition } from '@flowforge/shared';
import { createMockContext } from './mock-context.js';
import type { MockContextOptions, MockCall } from './mock-context.js';
import type { MockLogger } from './mock-logger.js';

export interface TestNodeConfig {
  /** Override mock context options (event, steps, metadata, etc.) */
  contextOverrides?: Omit<MockContextOptions, 'input' | 'config'>;
}

export interface TestNodeResult<TOutput = unknown> {
  /** The output returned by the node handler. */
  output: TOutput;
  /** All tracked method calls made during execution. */
  calls: MockCall[];
  /** The mock logger instance for asserting log output. */
  logger: MockLogger;
}

/**
 * Run a node with a mock context and return the output plus context for assertions.
 *
 * @param node - The NodeDefinition to test
 * @param input - The input to pass to the node handler
 * @param config - Optional node configuration (defaults to {} parsed through configSchema)
 * @param options - Additional test options
 */
export async function testNode<TOutput = unknown>(
  node: NodeDefinition,
  input: unknown,
  config?: unknown,
  options?: TestNodeConfig,
): Promise<TestNodeResult<TOutput>> {
  // Parse input through the node's schema if available
  let parsedInput = input;
  if (node.inputSchema) {
    const result = node.inputSchema.safeParse(input);
    if (result.success) {
      parsedInput = result.data;
    }
  }

  // Parse config through the node's schema if available
  let parsedConfig = config ?? {};
  if (node.configSchema) {
    const result = node.configSchema.safeParse(parsedConfig);
    if (result.success) {
      parsedConfig = result.data;
    }
  }

  const { ctx, calls, logger } = createMockContext({
    input: parsedInput,
    config: parsedConfig,
    ...options?.contextOverrides,
  });

  const output = await node.handler(ctx);

  // Validate output through the node's schema if available
  let validatedOutput = output;
  if (node.outputSchema) {
    const result = node.outputSchema.safeParse(output);
    if (result.success) {
      validatedOutput = result.data;
    }
  }

  return {
    output: validatedOutput as TOutput,
    calls,
    logger,
  };
}
