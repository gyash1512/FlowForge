import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const toolDefSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.unknown()),
});

const inputSchema = z.object({
  prompt: z.string(),
  tools: z.array(toolDefSchema).optional(),
  context: z.unknown().optional(),
});

const outputSchema = z.object({
  result: z.unknown(),
  toolsUsed: z.array(z.string()),
  iterations: z.number(),
  text: z.string(),
});

const configSchema = z.object({
  model: z.string().default('gpt-4o'),
  systemPrompt: z.string().default('You are a helpful agent.'),
  maxIterations: z.number().int().min(1).max(50).default(10),
  maxTokens: z.number().int().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export const agentNode = defineNode({
  name: 'ai/agent',
  version: '0.1.0',
  description: 'Run a configurable agent loop with tools and iterative reasoning',
  category: 'ai',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['ai', 'agent', 'tool-use'],
  timeout: 120_000,
  retries: 1,

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const { prompt, context } = input;
    const { model, systemPrompt, maxIterations, maxTokens, temperature } = ctx.config as z.infer<
      typeof configSchema
    >;

    const toolsUsed: string[] = [];
    let iterations = 0;
    let lastResponse: unknown = null;

    // Build tool definitions from input if provided
    const aiTools: Record<string, { description: string; parameters: z.ZodType }> = {};
    if (input.tools) {
      for (const tool of input.tools) {
        aiTools[tool.name] = {
          description: tool.description,
          parameters: z.any(),
        };
      }
    }

    const contextStr = context ? `\nContext: ${JSON.stringify(context)}` : '';

    while (iterations < maxIterations) {
      iterations++;

      const currentPrompt =
        iterations === 1
          ? `${prompt}${contextStr}`
          : `Continue based on previous results. Previous: ${JSON.stringify(lastResponse)}`;

      ctx.logger.info({ iteration: iterations, model }, 'Agent iteration');

      const result = await ctx.ai.generateText({
        model,
        system: systemPrompt,
        prompt: currentPrompt,
        tools: Object.keys(aiTools).length > 0 ? aiTools : undefined,
        maxTokens,
        temperature,
      });

      if (result.toolCalls) {
        for (const call of result.toolCalls) {
          toolsUsed.push(call.toolName);
        }
      }

      // If no more tool calls, the agent is done
      if (!result.toolCalls || result.toolCalls.length === 0) {
        return {
          result: lastResponse,
          toolsUsed,
          iterations,
          text: result.text,
        };
      }

      lastResponse = result.toolResults ?? result.text;
    }

    // Max iterations reached
    ctx.logger.warn({ maxIterations }, 'Agent reached max iterations');
    return {
      result: lastResponse,
      toolsUsed,
      iterations,
      text: 'Max iterations reached',
    };
  },
});
