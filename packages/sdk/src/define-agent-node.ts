import { z } from 'zod';
import type {
  NodeDefinition,
  AgentNodeOptions,
  AgentToolDef,
  NodeContext,
} from '@flowforge/shared';

/**
 * Define an agent node that runs an LLM tool-calling loop.
 * Uses Vercel AI SDK under the hood via ctx.ai.
 */
export function defineAgentNode<TOutput extends z.ZodType>(
  options: AgentNodeOptions<TOutput>,
): NodeDefinition<z.ZodType, TOutput, z.ZodObject<{ model: z.ZodDefault<z.ZodString> }>> {
  const configSchema = z.object({
    model: z.string().default(options.model),
  });

  const inputSchema = z.any();

  return {
    name: options.name,
    version: options.version,
    description: options.description,
    category: 'ai',
    inputSchema,
    outputSchema: options.outputSchema,
    configSchema,

    handler: async (ctx: NodeContext) => {
      const model = (ctx.config as { model: string }).model;
      const maxIterations = options.maxIterations ?? 10;

      // Build tool definitions for AI SDK
      const aiTools: Record<string, { description: string; parameters: z.ZodType; execute: (...args: unknown[]) => Promise<unknown> }> = {};
      for (const [name, tool] of Object.entries(options.tools)) {
        const t = tool as AgentToolDef;
        aiTools[name] = {
          description: t.description,
          parameters: t.inputSchema,
          execute: async (...args: unknown[]) => t.handler(ctx, args[0]),
        };
      }

      // Run the agent loop
      let iterations = 0;
      const toolsUsed: string[] = [];
      let lastResponse: unknown = null;

      while (iterations < maxIterations) {
        iterations++;

        const result = await ctx.ai.generateText({
          model,
          system: options.systemPrompt,
          prompt: iterations === 1
            ? JSON.stringify(ctx.input)
            : `Continue based on tool results. Previous: ${JSON.stringify(lastResponse)}`,
          tools: aiTools,
          maxTokens: options.maxTokens,
          temperature: options.temperature,
        });

        // Track tool calls
        if (result.toolCalls) {
          for (const call of result.toolCalls) {
            toolsUsed.push(call.toolName);
          }
        }

        // If no more tool calls, agent is done
        if (!result.toolCalls || result.toolCalls.length === 0) {
          // Try to parse as structured output
          try {
            const parsed = await ctx.ai.generateObject({
              model,
              schema: options.outputSchema,
              prompt: `Based on your analysis, provide the final structured output. Context: ${result.text}`,
            });
            return parsed.object;
          } catch {
            return { text: result.text, toolsUsed } as z.infer<TOutput>;
          }
        }

        lastResponse = result.toolResults ?? result.text;
      }

      // Max iterations reached — produce best-effort output
      const finalResult = await ctx.ai.generateObject({
        model,
        schema: options.outputSchema,
        prompt: `Max iterations reached. Provide the best output based on what you've gathered so far.`,
      });
      return finalResult.object;
    },

    retries: 1,
    timeout: 120_000,
    tags: [...(options.tags ?? []), 'agent', 'ai'],
    author: options.author,
  };
}
