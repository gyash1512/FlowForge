import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

// ────────────────────────────────────────────────────────────────
// Default blocked patterns — dangerous shell operations
// ────────────────────────────────────────────────────────────────

const DEFAULT_BLOCKED_PATTERNS = [
  'rm\\s+-rf\\s+/',
  'mkfs',
  ':(\\)\\{',
  'dd\\s+if=',
  '> /dev/sd',
  'chmod\\s+777',
  'curl.*\\|.*sh',
];

// ────────────────────────────────────────────────────────────────
// Schemas
// ────────────────────────────────────────────────────────────────

const inputSchema = z.object({
  action: z.enum(['execute', 'script']).default('execute'),
  command: z.string().optional().describe('Command to execute (for "execute" action)'),
  args: z.array(z.string()).optional().describe('Arguments for the command'),
  cwd: z.string().optional().describe('Working directory'),
  env: z.record(z.string()).optional().describe('Additional environment variables'),
  timeout: z.number().int().positive().optional().describe('Timeout in milliseconds'),
  stdin: z.string().optional().describe('Data to pipe to stdin'),
  script: z.string().optional().describe('Multi-line script content (for "script" action)'),
  shell: z.string().optional().describe('Shell to use for script execution (e.g. bash, sh, zsh)'),
});

const outputSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number(),
  duration: z.number(),
  success: z.boolean(),
});

const configSchema = z.object({
  allowedCommands: z
    .array(z.string())
    .optional()
    .describe('If set, only these base commands are allowed to run'),
  blockedPatterns: z
    .array(z.string())
    .default(DEFAULT_BLOCKED_PATTERNS)
    .describe('Regex patterns that are always blocked'),
  maxTimeout: z.number().int().default(30_000).describe('Maximum execution time in milliseconds'),
  allowedCwd: z
    .array(z.string())
    .optional()
    .describe('If set, only these working directories are allowed'),
  maxOutputSize: z
    .number()
    .int()
    .default(1_000_000)
    .describe('Truncate stdout/stderr beyond this byte count'),
});

// ────────────────────────────────────────────────────────────────
// Security helpers
// ────────────────────────────────────────────────────────────────

/** Check a command string against all blocked regex patterns. */
function assertNotBlocked(commandStr: string, patterns: string[]): void {
  for (const pat of patterns) {
    if (new RegExp(pat).test(commandStr)) {
      throw new Error(`Blocked: command matches dangerous pattern "${pat}"`);
    }
  }
}

/** Validate that a base command name is in the allow-list (if configured). */
function assertCommandAllowed(command: string, allowedCommands?: string[]): void {
  if (!allowedCommands || allowedCommands.length === 0) return;

  // Extract the base command name (strip leading path segments).
  const base = command.split('/').pop() ?? command;
  if (!allowedCommands.includes(base)) {
    throw new Error(
      `Command "${base}" is not in the allowed list: [${allowedCommands.join(', ')}]`,
    );
  }
}

/** Validate the working directory against the allow-list (if configured). */
function assertCwdAllowed(
  cwd: string | undefined,
  allowedCwd: string[] | undefined,
  resolve: (p: string) => string,
): void {
  if (!cwd || !allowedCwd || allowedCwd.length === 0) return;

  const resolved = resolve(cwd);
  const allowed = allowedCwd.some((dir) => {
    const resolvedDir = resolve(dir);
    return resolved === resolvedDir || resolved.startsWith(resolvedDir + '/');
  });

  if (!allowed) {
    throw new Error(
      `Working directory "${resolved}" is not in allowed directories [${allowedCwd.join(', ')}]`,
    );
  }
}

/** Truncate a string to a maximum byte length, appending a notice if trimmed. */
function truncate(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value, 'utf-8') <= maxBytes) return value;
  const truncated = Buffer.from(value, 'utf-8').subarray(0, maxBytes).toString('utf-8');
  return truncated + '\n... [output truncated]';
}

// ────────────────────────────────────────────────────────────────
// Node definition
// ────────────────────────────────────────────────────────────────

export const shellNode = defineNode({
  name: 'tools/shell',
  version: '0.1.0',
  description:
    'Execute shell commands and scripts with allow-listing, pattern blocking, and timeout controls',
  category: 'custom',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['shell', 'bash', 'terminal', 'command', 'tools', 'agentic'],

  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof inputSchema>;
    const config = ctx.config as z.infer<typeof configSchema>;
    const { action } = input;

    const nodePath = await import('node:path');
    const resolve = (p: string) => nodePath.resolve(p);
    const timeout = Math.min(input.timeout ?? config.maxTimeout, config.maxTimeout);

    // ── Validate working directory ──────────────────────────────
    assertCwdAllowed(input.cwd, config.allowedCwd, resolve);

    // ── Action dispatch ─────────────────────────────────────────
    switch (action) {
      // ── execute (single command) ──────────────────────────────
      case 'execute': {
        if (!input.command) {
          throw new Error('command is required for action "execute"');
        }

        // Build the full command string for pattern checks.
        const fullCommand = input.args ? `${input.command} ${input.args.join(' ')}` : input.command;

        // Security checks.
        assertNotBlocked(fullCommand, config.blockedPatterns);
        assertCommandAllowed(input.command, config.allowedCommands);

        ctx.logger.info(`execute: ${fullCommand}`);

        const { execa } = await import('execa');
        const start = Date.now();

        try {
          const result = await execa(input.command, input.args ?? [], {
            cwd: input.cwd,
            env: input.env,
            timeout,
            input: input.stdin,
            reject: false,
          });

          const duration = Date.now() - start;
          return {
            stdout: truncate(result.stdout, config.maxOutputSize),
            stderr: truncate(result.stderr, config.maxOutputSize),
            exitCode: result.exitCode,
            duration,
            success: result.exitCode === 0,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`Shell execution failed: ${message}`);
        }
      }

      // ── script (multi-line via temp file) ─────────────────────
      case 'script': {
        if (!input.script) {
          throw new Error('script is required for action "script"');
        }

        // Check every line of the script against blocked patterns.
        assertNotBlocked(input.script, config.blockedPatterns);

        const shell = input.shell ?? 'bash';
        ctx.logger.info(`script: running ${input.script.split('\n').length} line(s) via ${shell}`);

        const nodeFs = await import('node:fs/promises');
        const nodeOs = await import('node:os');
        const tmpFile = nodePath.join(
          nodeOs.tmpdir(),
          `flowforge-script-${Date.now()}-${Math.random().toString(36).slice(2)}.sh`,
        );

        try {
          // Write script to temp file.
          await nodeFs.writeFile(tmpFile, input.script, { mode: 0o700 });

          const { execa } = await import('execa');
          const start = Date.now();

          const result = await execa(shell, [tmpFile], {
            cwd: input.cwd,
            env: input.env,
            timeout,
            input: input.stdin,
            reject: false,
          });

          const duration = Date.now() - start;
          return {
            stdout: truncate(result.stdout, config.maxOutputSize),
            stderr: truncate(result.stderr, config.maxOutputSize),
            exitCode: result.exitCode,
            duration,
            success: result.exitCode === 0,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`Script execution failed: ${message}`);
        } finally {
          // Always clean up the temp file.
          const nodeFs2 = await import('node:fs/promises');
          await nodeFs2.unlink(tmpFile).catch(() => {});
        }
      }

      default:
        throw new Error(`Unknown action: ${action as string}`);
    }
  },
});
