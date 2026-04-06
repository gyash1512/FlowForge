import type { z } from 'zod';
import type { NodeDefinition, NodeCategory, NodeContext } from '@flowforge/shared';

export interface DefineNodeInput {
  name: string;
  version: string;
  description: string;
  category: NodeCategory;
  inputSchema: z.ZodTypeAny;
  outputSchema: z.ZodTypeAny;
  configSchema: z.ZodTypeAny;
  handler: (ctx: NodeContext) => Promise<unknown>;
  onInit?: (config: unknown) => Promise<void>;
  onDestroy?: () => Promise<void>;
  onError?: (error: Error, ctx: NodeContext) => Promise<void>;
  retries?: number;
  timeout?: number;
  tags?: string[];
  author?: string;
  repository?: string;
}

/**
 * Define a custom node using the standard NodeDefinition interface.
 * The returned object can be used directly in workflows or published as an npm package.
 */
export function defineNode(input: DefineNodeInput): NodeDefinition {
  return {
    name: input.name,
    version: input.version,
    description: input.description,
    category: input.category,
    inputSchema: input.inputSchema,
    outputSchema: input.outputSchema,
    configSchema: input.configSchema,
    handler: input.handler,
    onInit: input.onInit,
    onDestroy: input.onDestroy,
    onError: input.onError,
    retries: input.retries ?? 3,
    timeout: input.timeout,
    tags: input.tags,
    author: input.author,
    repository: input.repository,
  };
}
