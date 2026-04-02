import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  variables: z.record(z.unknown()),
});

const outputSchema = z.object({
  result: z.string(),
});

const configSchema = z.object({
  template: z.string().describe('Template string with {{variable}} placeholders'),
});

export const templateNode = defineNode({
  name: 'transform/template',
  version: '0.1.0',
  description: 'Render a string template with variable substitution using {{variable}} syntax',
  category: 'transform',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['transform', 'template', 'string'],

  handler: async (ctx) => {
    const { variables } = ctx.input;
    const { template } = ctx.config;

    const result = template.replace(/\{\{(\s*[\w.]+\s*)\}\}/g, (_match, key: string) => {
      const trimmedKey = key.trim();
      // Support nested access like "user.name"
      const parts = trimmedKey.split('.');
      let value: unknown = variables;
      for (const part of parts) {
        if (value === null || value === undefined) break;
        value = (value as Record<string, unknown>)[part];
      }
      return value !== undefined && value !== null ? String(value) : '';
    });

    return { result };
  },
});
