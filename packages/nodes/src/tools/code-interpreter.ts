import { z } from 'zod';
import { defineNode } from '@flowforgejs/sdk';

const supportedLanguages = [
  'python',
  'javascript',
  'typescript',
  'r',
  'java',
  'go',
  'ruby',
  'php',
  'bash',
] as const;

const inputSchema = z.object({
  action: z.enum(['execute', 'installPackages']),
  code: z.string().optional(),
  language: z.enum(supportedLanguages).default('python'),
  packages: z.array(z.string()).optional(),
  timeout: z.number().int().positive().optional(),
  files: z
    .array(
      z.object({
        name: z.string(),
        content: z.string(),
      }),
    )
    .optional(),
});

const outputSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  results: z.array(z.unknown()),
  error: z.string().optional(),
  language: z.string(),
  success: z.boolean(),
});

const configSchema = z.object({
  apiKey: z.string().optional().describe('E2B API key (or set E2B_API_KEY env var)'),
  sandboxTimeout: z
    .number()
    .int()
    .default(300_000)
    .describe('Sandbox lifetime in ms (default 5min)'),
  maxOutputLines: z
    .number()
    .int()
    .default(500)
    .describe('Maximum number of output lines before truncation'),
});

type Input = z.infer<typeof inputSchema>;
type Config = z.infer<typeof configSchema>;

function getInstallCommand(language: Input['language'], packages: string[]): string {
  const joined = packages.join(' ');

  switch (language) {
    case 'python':
      return `pip install ${joined}`;
    case 'javascript':
    case 'typescript':
      return `npm install ${joined}`;
    case 'ruby':
      return `gem install ${joined}`;
    case 'go':
      return packages.map((p) => `go get ${p}`).join(' && ');
    case 'php':
      return `composer require ${joined}`;
    case 'r':
      return packages
        .map((p) => `Rscript -e 'install.packages("${p}", repos="https://cran.r-project.org")'`)
        .join(' && ');
    case 'java':
      return `echo "Java packages must be managed via build tools (Maven/Gradle)"`;
    case 'bash':
      return `apt-get install -y ${joined}`;
    default:
      throw new Error(`Unsupported language for package installation: ${language}`);
  }
}

function truncateLines(text: string, maxLines: number): string {
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text;

  const kept = lines.slice(0, maxLines);
  const dropped = lines.length - maxLines;
  return kept.join('\n') + `\n... (${dropped} lines truncated)`;
}

export const codeInterpreterNode = defineNode({
  name: 'tools/code-interpreter',
  version: '0.1.0',
  description: 'Execute code in a sandboxed E2B cloud environment with full isolation',
  category: 'custom',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['code', 'sandbox', 'e2b', 'interpreter', 'python', 'tools', 'agentic'],

  handler: async (ctx) => {
    const input = ctx.input as Input;
    const config = ctx.config as Config;
    const { action, language } = input;

    const apiKey = config.apiKey ?? process.env.E2B_API_KEY;
    if (!apiKey) {
      throw new Error('E2B API key is required — set via config.apiKey or E2B_API_KEY env var');
    }

    const { Sandbox } = await import('@e2b/code-interpreter');
    const sandbox = await Sandbox.create({
      apiKey,
      timeoutMs: config.sandboxTimeout,
    });

    try {
      if (input.files && input.files.length > 0) {
        for (const file of input.files) {
          await sandbox.files.write(file.name, file.content);
        }
      }

      switch (action) {
        case 'execute': {
          if (!input.code) {
            throw new Error('code is required for action "execute"');
          }

          const execution = await sandbox.runCode(input.code, {
            language: language ?? 'python',
            timeoutMs: input.timeout ?? 60_000,
          });

          const stdout = truncateLines(execution.logs.stdout.join('\n'), config.maxOutputLines);
          const stderr = truncateLines(execution.logs.stderr.join('\n'), config.maxOutputLines);

          return {
            stdout,
            stderr,
            results: execution.results.map((r) => r.toJSON()),
            error: execution.error ? String(execution.error) : undefined,
            language,
            success: !execution.error,
          };
        }

        case 'installPackages': {
          if (!input.packages?.length) {
            throw new Error('packages array is required for action "installPackages"');
          }

          const cmd = getInstallCommand(language, input.packages);

          const execution = await sandbox.runCode(
            `import subprocess; result = subprocess.run(${JSON.stringify(cmd)}, shell=True, capture_output=True, text=True); print(result.stdout); print(result.stderr, end='')`,
            { language: 'python' },
          );

          const stdout = truncateLines(execution.logs.stdout.join('\n'), config.maxOutputLines);
          const stderr = truncateLines(execution.logs.stderr.join('\n'), config.maxOutputLines);

          return {
            stdout,
            stderr,
            results: [],
            error: execution.error ? String(execution.error) : undefined,
            language,
            success: !execution.error,
          };
        }

        default:
          throw new Error(`Unknown action: ${action as string}`);
      }
    } finally {
      await sandbox.kill();
    }
  },
});
