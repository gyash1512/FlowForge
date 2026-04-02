import type { z } from 'zod';
import type { NodeDefinition, NodeCategory } from '@flowforge/shared';

export interface DefineNodeInput<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
  TConfig extends z.ZodType = z.ZodType,
> {
  name: string;
  version: string;
  description: string;
  category: NodeCategory;
  inputSchema: TInput;
  outputSchema: TOutput;
  configSchema: TConfig;
  handler: NodeDefinition<TInput, TOutput, TConfig>['handler'];
  onInit?: NodeDefinition<TInput, TOutput, TConfig>['onInit'];
  onDestroy?: () => Promise<void>;
  onError?: NodeDefinition<TInput, TOutput, TConfig>['onError'];
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
export function defineNode<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TConfig extends z.ZodType,
>(input: DefineNodeInput<TInput, TOutput, TConfig>): NodeDefinition<TInput, TOutput, TConfig> {
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
