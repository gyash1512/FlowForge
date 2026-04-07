import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface InitOptions {
  name?: string;
  dir?: string;
}

export function generateProjectFiles(projectName: string): Record<string, string> {
  return {
    'package.json': JSON.stringify(
      {
        name: projectName,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: {
          dev: 'flowforge dev',
          build: 'tsc',
          deploy: 'flowforge deploy',
          test: 'vitest run',
        },
        dependencies: {
          '@flowforgejs/sdk': 'workspace:*',
          '@flowforgejs/shared': 'workspace:*',
          zod: '^3.23.0',
        },
        devDependencies: {
          typescript: '^5.5.0',
          vitest: '^2.1.0',
        },
      },
      null,
      2,
    ),

    'tsconfig.json': JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          outDir: './dist',
          rootDir: './src',
          declaration: true,
          sourceMap: true,
        },
        include: ['src'],
      },
      null,
      2,
    ),

    '.env.example': [
      '# FlowForge Environment Configuration',
      '',
      '# Worker',
      'CONDUIT_WORKER_PORT=4000',
      '',
      '# Redis',
      'REDIS_HOST=localhost',
      'REDIS_PORT=6379',
      'REDIS_PASSWORD=',
      '',
      '# Postgres',
      'DATABASE_URL=postgresql://localhost:5432/flowforge',
      '',
      '# Integrations',
      'NANGO_URL=',
      'NANGO_SECRET_KEY=',
      '',
    ].join('\n'),

    '.gitignore': ['node_modules', 'dist', '.turbo', '.env', 'coverage', '*.log', ''].join('\n'),

    'src/workflows/example.workflow.ts': [
      "import { z } from 'zod';",
      '',
      'export default {',
      "  id: 'example-workflow',",
      "  name: 'Example Workflow',",
      "  version: '0.1.0',",
      "  description: 'A sample workflow to get you started',",
      '  trigger: {',
      "    type: 'event' as const,",
      "    event: 'example.trigger',",
      '  },',
      '  steps: [',
      '    {',
      "      name: 'log-event',",
      '      node: {',
      "        name: 'logger',",
      "        version: '1.0.0',",
      "        description: 'Logs the incoming event',",
      "        category: 'data' as const,",
      '        inputSchema: z.object({ message: z.string() }),',
      '        outputSchema: z.object({ logged: z.boolean() }),',
      '        configSchema: z.object({}),',
      '        handler: async (ctx) => {',
      "          ctx.logger.info('Received event', { event: ctx.event });",
      '          return { logged: true };',
      '        },',
      '      },',
      '      input: (ctx) => ({ message: JSON.stringify(ctx.event.data) }),',
      '    },',
      '  ],',
      '};',
      '',
    ].join('\n'),
  };
}

export const initCommand = new Command('init')
  .description('Scaffold a new FlowForge project')
  .option('-n, --name <name>', 'Project name')
  .option('-d, --dir <directory>', 'Target directory')
  .action(async (options: InitOptions) => {
    const projectName = options.name ?? path.basename(process.cwd());
    const targetDir = path.resolve(options.dir ?? '.');

    console.log(chalk.bold.blue('\n  FlowForge') + chalk.dim(' — Scaffolding new project\n'));

    const spinner = ora('Generating project files...').start();

    try {
      const files = generateProjectFiles(projectName);

      for (const [filePath, content] of Object.entries(files)) {
        const fullPath = path.join(targetDir, filePath);
        const dir = path.dirname(fullPath);

        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(fullPath, content, 'utf-8');
      }

      spinner.succeed('Project scaffolded successfully!');

      console.log(chalk.green('\n  Created files:'));
      for (const filePath of Object.keys(files)) {
        console.log(chalk.dim(`    - ${filePath}`));
      }

      console.log(chalk.bold('\n  Next steps:\n'));
      if (options.dir) {
        console.log(chalk.cyan(`    cd ${options.dir}`));
      }
      console.log(chalk.cyan('    pnpm install'));
      console.log(chalk.cyan('    flowforge dev'));
      console.log('');
    } catch (error) {
      spinner.fail('Failed to scaffold project');
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`\n  Error: ${message}`));
      process.exitCode = 1;
    }
  });
