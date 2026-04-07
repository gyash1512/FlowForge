import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const inputSchema = z.object({
  value: z.string().describe('Text to embed'),
});

const outputSchema = z.object({
  embedding: z.array(z.number()),
  usage: z
    .object({
      tokens: z.number(),
    })
    .optional(),
});

const configSchema = z.object({
  model: z.string().default('text-embedding-3-small'),
});

export const embedNode = defineNode({
  name: 'ai/embed',
  version: '0.1.0',
  description: 'Generate vector embeddings for text using an embedding model',
  category: 'ai',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['ai', 'embeddings', 'vector'],

  handler: async (ctx) => {
    const { value } = ctx.input as z.infer<typeof inputSchema>;
    const { model } = ctx.config as z.infer<typeof configSchema>;

    ctx.logger.info({ model, length: value.length }, 'Generating embedding');

    const result = await ctx.ai.embed({
      model,
      value,
    });

    return {
      embedding: result.embedding,
      usage: result.usage,
    };
  },
});
