import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  prompt: z.string().optional(),
  messages: z
    .array(z.object({ role: z.string(), content: z.string() }))
    .optional(),
  system: z.string().optional(),
});

const outputSchema = z.object({
  text: z.string(),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
    })
    .optional(),
  finishReason: z.string().optional(),
});

const configSchema = z.object({
  model: z.string().default('gpt-4o'),
  maxTokens: z.number().int().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export const generateTextNode = defineNode({
  name: 'ai/generate-text',
  version: '0.1.0',
  description: 'Generate text using an LLM via the AI SDK',
  category: 'ai',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['ai', 'llm', 'text-generation'],

  handler: async (ctx) => {
    const { prompt, messages, system } = ctx.input;
    const { model, maxTokens, temperature } = ctx.config;

    if (!prompt && !messages?.length) {
      throw new Error('Either prompt or messages is required');
    }

    ctx.logger.info({ model }, 'Generating text');

    const result = await ctx.ai.generateText({
      model,
      prompt,
      messages,
      system,
      maxTokens,
      temperature,
    });

    return {
      text: result.text,
      usage: result.usage,
      finishReason: result.finishReason,
    };
  },
});
