import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  prompt: z.string().optional(),
  messages: z
    .array(z.object({ role: z.string(), content: z.string() }))
    .optional(),
  system: z.string().optional(),
  schema: z.record(z.unknown()).describe('JSON representation of the desired output schema'),
});

const outputSchema = z.object({
  object: z.unknown(),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
    })
    .optional(),
});

const configSchema = z.object({
  model: z.string().default('gpt-4o'),
  maxTokens: z.number().int().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export const generateObjectNode = defineNode({
  name: 'ai/generate-object',
  version: '0.1.0',
  description: 'Generate a structured JSON object from an LLM using a Zod schema',
  category: 'ai',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['ai', 'llm', 'structured-output'],

  handler: async (ctx) => {
    const { prompt, messages, system, schema } = ctx.input as z.infer<typeof inputSchema>;
    const { model, maxTokens, temperature } = ctx.config as z.infer<typeof configSchema>;

    if (!prompt && !messages?.length) {
      throw new Error('Either prompt or messages is required');
    }

    ctx.logger.info({ model }, 'Generating structured object');

    // The schema field from input is a JSON description of the desired output
    // shape. The AIContext.generateObject method accepts z.ZodType, so we
    // convert the plain record into a z.ZodType via z.object() wrapping.
    // In practice the engine resolves it to a proper schema before reaching
    // the LLM provider.
    const zodSchema = z.object(
      Object.fromEntries(
        Object.entries(schema).map(([key]) => [key, z.unknown()]),
      ),
    );

    const result = await ctx.ai.generateObject({
      model,
      prompt,
      messages,
      system,
      schema: zodSchema,
      maxTokens,
      temperature,
    });

    return {
      object: result.object,
      usage: result.usage,
    };
  },
});
