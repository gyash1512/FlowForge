import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as path from 'node:path';
import * as fs from 'node:fs';

const REQUIRED_NODE_FIELDS = [
  'name',
  'version',
  'description',
  'category',
  'inputSchema',
  'outputSchema',
  'configSchema',
  'handler',
] as const;

const VALID_CATEGORIES = ['data', 'communication', 'ai', 'control', 'transform', 'custom'];

export interface NodeValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateNodeDefinition(nodeDef: Record<string, unknown>): NodeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof nodeDef !== 'object' || nodeDef === null) {
    return { valid: false, errors: ['Node definition must be an object'], warnings };
  }

  for (const field of REQUIRED_NODE_FIELDS) {
    if (!(field in nodeDef) || nodeDef[field] === undefined) {
      errors.push(`Missing required field: "${field}"`);
    }
  }

  if ('name' in nodeDef && typeof nodeDef.name !== 'string') {
    errors.push('"name" must be a string');
  }
  if ('name' in nodeDef && typeof nodeDef.name === 'string' && nodeDef.name.length === 0) {
    errors.push('"name" must not be empty');
  }

  if ('version' in nodeDef && typeof nodeDef.version !== 'string') {
    errors.push('"version" must be a string');
  }

  if ('description' in nodeDef && typeof nodeDef.description !== 'string') {
    errors.push('"description" must be a string');
  }

  if ('category' in nodeDef) {
    if (typeof nodeDef.category !== 'string') {
      errors.push('"category" must be a string');
    } else if (!VALID_CATEGORIES.includes(nodeDef.category)) {
      errors.push(
        `"category" must be one of: ${VALID_CATEGORIES.join(', ')}. Got: "${nodeDef.category}"`,
      );
    }
  }

  if ('handler' in nodeDef && typeof nodeDef.handler !== 'function') {
    errors.push('"handler" must be a function');
  }

  if ('inputSchema' in nodeDef) {
    const schema = nodeDef.inputSchema;
    if (typeof schema !== 'object' || schema === null || !('parse' in schema)) {
      errors.push('"inputSchema" must be a Zod schema (must have a .parse method)');
    }
  }
  if ('outputSchema' in nodeDef) {
    const schema = nodeDef.outputSchema;
    if (typeof schema !== 'object' || schema === null || !('parse' in schema)) {
      errors.push('"outputSchema" must be a Zod schema (must have a .parse method)');
    }
  }
  if ('configSchema' in nodeDef) {
    const schema = nodeDef.configSchema;
    if (typeof schema !== 'object' || schema === null || !('parse' in schema)) {
      errors.push('"configSchema" must be a Zod schema (must have a .parse method)');
    }
  }

  // Warnings for optional best-practice fields
  if (!('tags' in nodeDef) || !Array.isArray(nodeDef.tags) || nodeDef.tags.length === 0) {
    warnings.push('Consider adding "tags" for discoverability');
  }
  if (!('retries' in nodeDef)) {
    warnings.push('Consider specifying "retries" for fault tolerance');
  }
  if (!('timeout' in nodeDef)) {
    warnings.push('Consider specifying "timeout" to prevent runaway executions');
  }

  return { valid: errors.length === 0, errors, warnings };
}

const validateSubcommand = new Command('validate')
  .description('Validate a node definition file')
  .argument('<file>', 'Path to the node definition file')
  .action(async (file: string) => {
    const filePath = path.resolve(file);
    const spinner = ora(`Validating ${path.basename(filePath)}...`).start();

    try {
      const imported = (await import(filePath)) as Record<string, unknown>;
      const nodeDef = (imported.default ?? imported) as Record<string, unknown>;

      const result = validateNodeDefinition(nodeDef);

      if (result.valid) {
        spinner.succeed(`Node "${(nodeDef.name as string) ?? file}" is valid`);
      } else {
        spinner.fail(`Node validation failed`);
      }

      if (result.errors.length > 0) {
        console.log(chalk.red('\n  Errors:'));
        for (const err of result.errors) {
          console.log(chalk.red(`    - ${err}`));
        }
      }

      if (result.warnings.length > 0) {
        console.log(chalk.yellow('\n  Warnings:'));
        for (const warn of result.warnings) {
          console.log(chalk.yellow(`    - ${warn}`));
        }
      }

      console.log('');
      if (!result.valid) {
        process.exitCode = 1;
      }
    } catch (error) {
      spinner.fail('Failed to validate node');
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`\n  Error: ${message}`));
      process.exitCode = 1;
    }
  });

const testSubcommand = new Command('test')
  .description('Test a node with mock context')
  .argument('<file>', 'Path to the node definition file')
  .option('-i, --input <json>', 'Input data as JSON', '{}')
  .option('-c, --config <json>', 'Config data as JSON', '{}')
  .action(async (file: string, options: { input?: string; config?: string }) => {
    const filePath = path.resolve(file);
    const spinner = ora(`Testing ${path.basename(filePath)}...`).start();

    try {
      const imported = (await import(filePath)) as Record<string, unknown>;
      const nodeDef = (imported.default ?? imported) as Record<string, unknown>;

      // First validate
      const validation = validateNodeDefinition(nodeDef);
      if (!validation.valid) {
        spinner.fail('Node validation failed — fix errors before testing');
        for (const err of validation.errors) {
          console.log(chalk.red(`    - ${err}`));
        }
        process.exitCode = 1;
        return;
      }

      let input: unknown;
      let config: unknown;
      try {
        input = JSON.parse(options.input ?? '{}');
        config = JSON.parse(options.config ?? '{}');
      } catch {
        spinner.fail('Invalid JSON for --input or --config');
        process.exitCode = 1;
        return;
      }

      // Build mock context
      const logs: Array<{ level: string; args: unknown[] }> = [];
      const mockLogger = {
        info: (...args: unknown[]) => logs.push({ level: 'info', args }),
        warn: (...args: unknown[]) => logs.push({ level: 'warn', args }),
        error: (...args: unknown[]) => logs.push({ level: 'error', args }),
        debug: (...args: unknown[]) => logs.push({ level: 'debug', args }),
        child: () => mockLogger,
      };

      const mockCtx = {
        input,
        config,
        event: { id: 'test-event', type: 'test', data: input, timestamp: new Date() },
        steps: {},
        logger: mockLogger,
        pull: async () => null,
        push: async () => null,
        integrate: async () => null,
        ai: {
          generateText: async () => ({ text: '' }),
          streamText: async () => ({
            textStream: (async function* () {})(),
            text: Promise.resolve(''),
          }),
          generateObject: async () => ({ object: {} }),
          embed: async () => ({ embedding: [] }),
        },
        emit: async () => {},
        wait: async () => null,
        sleep: async () => {},
        checkpoint: async () => {},
        metadata: {
          runId: 'test-run',
          workflowId: 'test-workflow',
          workflowName: 'Test',
          attempt: 1,
          startedAt: new Date(),
        },
        signal: AbortSignal.timeout(30_000),
      };

      spinner.text = 'Executing handler...';
      const handler = nodeDef.handler as (ctx: typeof mockCtx) => Promise<unknown>;
      const startTime = Date.now();
      const result = await handler(mockCtx);
      const duration = Date.now() - startTime;

      spinner.succeed(`Node "${nodeDef.name as string}" executed successfully (${duration}ms)`);

      if (logs.length > 0) {
        console.log(chalk.bold('\n  Logs:'));
        for (const log of logs) {
          const level = log.level.toUpperCase().padEnd(6);
          const color =
            log.level === 'error' ? chalk.red : log.level === 'warn' ? chalk.yellow : chalk.dim;
          console.log(`  ${color(level)} ${log.args.map(String).join(' ')}`);
        }
      }

      console.log(chalk.bold('\n  Output:'));
      console.log(chalk.cyan(`  ${JSON.stringify(result, null, 2).replace(/\n/g, '\n  ')}`));
      console.log('');
    } catch (error) {
      spinner.fail('Node test failed');
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`\n  Error: ${message}`));
      if (error instanceof Error && error.stack) {
        console.error(chalk.dim(`\n  ${error.stack.split('\n').slice(1).join('\n  ')}`));
      }
      process.exitCode = 1;
    }
  });

function extractSchemaFields(
  schema: unknown,
): Array<{ name: string; type: string; required: boolean }> {
  const fields: Array<{ name: string; type: string; required: boolean }> = [];

  if (!schema || typeof schema !== 'object') return fields;

  const s = schema as Record<string, unknown>;

  // Zod object schemas expose .shape
  const shape = s.shape as Record<string, unknown> | undefined;
  if (!shape || typeof shape !== 'object') return fields;

  for (const [name, fieldDef] of Object.entries(shape)) {
    const def = fieldDef as Record<string, unknown>;

    let type = 'unknown';
    let required = true;

    // Attempt to extract _def.typeName from Zod internals
    const innerDef = def._def as Record<string, unknown> | undefined;
    if (innerDef) {
      const typeName = innerDef.typeName as string | undefined;
      if (typeName) {
        type = typeName.replace('Zod', '').toLowerCase();
      }

      // Check if optional (wrapped in ZodOptional)
      if (typeName === 'ZodOptional') {
        required = false;
        const innerType = innerDef.innerType as Record<string, unknown> | undefined;
        if (innerType?._def) {
          const innerTypeName = (innerType._def as Record<string, unknown>).typeName as
            | string
            | undefined;
          if (innerTypeName) {
            type = innerTypeName.replace('Zod', '').toLowerCase();
          }
        }
      }
    }

    fields.push({ name, type, required });
  }

  return fields;
}

function generateSchemaTable(title: string, schema: unknown): string {
  const fields = extractSchemaFields(schema);
  if (fields.length === 0) return '';

  let md = `### ${title}\n\n`;
  md += '| Field | Type | Required |\n';
  md += '|-------|------|----------|\n';
  for (const field of fields) {
    md += `| ${field.name} | ${field.type} | ${field.required ? 'required' : 'optional'} |\n`;
  }
  md += '\n';
  return md;
}

function generateMarkdown(nodeDef: Record<string, unknown>): string {
  const name = (nodeDef.name as string) ?? 'Unknown';
  const version = (nodeDef.version as string) ?? '0.0.0';
  const description = (nodeDef.description as string) ?? '';
  const category = (nodeDef.category as string) ?? '';
  const tags = (nodeDef.tags as string[]) ?? [];

  let md = `# ${name}\n\n`;

  if (description) {
    md += `${description}\n\n`;
  }

  md += `- **Version:** ${version}\n`;
  if (category) md += `- **Category:** ${category}\n`;
  if (tags.length > 0) md += `- **Tags:** ${tags.join(', ')}\n`;
  md += '\n';

  md += generateSchemaTable('Input Schema', nodeDef.inputSchema);
  md += generateSchemaTable('Output Schema', nodeDef.outputSchema);
  md += generateSchemaTable('Config Schema', nodeDef.configSchema);

  return md;
}

const docsSubcommand = new Command('docs')
  .description('Generate markdown documentation from a node definition')
  .argument('<file>', 'Path to the node definition file')
  .option('-o, --output <path>', 'Write documentation to a file instead of stdout')
  .action(async (file: string, options: { output?: string }) => {
    const filePath = path.resolve(file);
    const spinner = ora(`Generating docs for ${path.basename(filePath)}...`).start();

    try {
      const imported = (await import(filePath)) as Record<string, unknown>;

      // Find the node definition: check default export, then named exports
      let nodeDef: Record<string, unknown> | undefined;
      if (
        imported.default &&
        typeof imported.default === 'object' &&
        'name' in (imported.default as object)
      ) {
        nodeDef = imported.default as Record<string, unknown>;
      } else {
        for (const value of Object.values(imported)) {
          if (
            value &&
            typeof value === 'object' &&
            'name' in (value as object) &&
            'handler' in (value as object)
          ) {
            nodeDef = value as Record<string, unknown>;
            break;
          }
        }
      }

      if (!nodeDef) {
        spinner.fail('No node definition found in file');
        console.error(chalk.red('\n  Could not find a valid node definition export.\n'));
        process.exitCode = 1;
        return;
      }

      const markdown = generateMarkdown(nodeDef);

      if (options.output) {
        const outputPath = path.resolve(options.output);
        fs.writeFileSync(outputPath, markdown, 'utf-8');
        spinner.succeed(`Documentation written to ${path.relative(process.cwd(), outputPath)}`);
      } else {
        spinner.succeed(`Documentation for "${nodeDef.name as string}"`);
        console.log('');
        console.log(markdown);
      }
    } catch (error) {
      spinner.fail('Failed to generate documentation');
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`\n  Error: ${message}`));
      process.exitCode = 1;
    }
  });

export const nodeCommand = new Command('node')
  .description('Node development utilities')
  .addCommand(validateSubcommand)
  .addCommand(testSubcommand)
  .addCommand(docsSubcommand);
