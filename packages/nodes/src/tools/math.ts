import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const inputSchema = z.object({
  action: z.enum(['evaluate', 'simplify', 'derivative', 'convert']),
  expression: z
    .string()
    .optional()
    .describe('Math expression for evaluate, simplify, or derivative'),
  variable: z.string().default('x').describe('Variable for derivative (default "x")'),
  from: z.string().optional().describe('Source value with unit for convert — e.g. "10 km"'),
  to: z.string().optional().describe('Target unit for convert — e.g. "miles"'),
});

const outputSchema = z.object({
  result: z.unknown(),
  expression: z.string().optional(),
  success: z.boolean(),
});

const configSchema = z.object({
  precision: z
    .number()
    .int()
    .default(14)
    .describe('Number of significant digits for numeric output'),
  allowedFunctions: z
    .array(z.string())
    .optional()
    .describe('If set, restrict mathjs to only these functions'),
});

// ---------------------------------------------------------------------------
// Node definition
// ---------------------------------------------------------------------------

export const mathNode = defineNode({
  name: 'tools/math',
  version: '0.1.0',
  description: 'Evaluate, simplify, differentiate math expressions and convert units using mathjs',
  category: 'custom',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['math', 'calculator', 'algebra', 'tools', 'agentic'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const config = ctx.config as z.infer<typeof configSchema>;
    const { action, expression, variable } = input;
    const { precision, allowedFunctions } = config;

    // --- Dynamic import ---
    const math = await import('mathjs');

    // --- Build a (possibly restricted) scope ---
    let scope: Record<string, unknown> | undefined;
    if (allowedFunctions && allowedFunctions.length > 0) {
      scope = {};
      for (const fn of allowedFunctions) {
        const value = (math as Record<string, unknown>)[fn];
        if (value !== undefined) {
          scope[fn] = value;
        }
      }
    }

    switch (action) {
      // ---------------------------------------------------------------
      // Evaluate
      // ---------------------------------------------------------------
      case 'evaluate': {
        if (!expression) throw new Error('expression is required for action "evaluate"');
        const raw = scope ? math.evaluate(expression, scope) : math.evaluate(expression);
        const result =
          typeof raw === 'number' ? parseFloat(raw.toPrecision(precision)) : String(raw);
        return { result, expression, success: true };
      }

      // ---------------------------------------------------------------
      // Simplify
      // ---------------------------------------------------------------
      case 'simplify': {
        if (!expression) throw new Error('expression is required for action "simplify"');
        const simplified = math.simplify(expression);
        return { result: simplified.toString(), expression, success: true };
      }

      // ---------------------------------------------------------------
      // Derivative
      // ---------------------------------------------------------------
      case 'derivative': {
        if (!expression) throw new Error('expression is required for action "derivative"');
        const derived = math.derivative(expression, variable);
        return { result: derived.toString(), expression, success: true };
      }

      // ---------------------------------------------------------------
      // Unit conversion
      // ---------------------------------------------------------------
      case 'convert': {
        if (!input.from) throw new Error('from is required for action "convert"');
        if (!input.to) throw new Error('to is required for action "convert"');
        const unit = math.unit(input.from);
        const converted = unit.to(input.to);
        const numericValue = converted.toNumber(input.to);
        return {
          result: {
            value: parseFloat(numericValue.toPrecision(precision)),
            unit: input.to,
            formatted: converted.toString(),
          },
          expression: `${input.from} → ${input.to}`,
          success: true,
        };
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
