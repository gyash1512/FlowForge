import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEFAULT_WORKER_PORT } from '@flowforgejs/shared';
import { Worker } from '@flowforgejs/worker';

export interface DevOptions {
  port?: string;
  watch?: boolean;
}

export const devCommand = new Command('dev')
  .description('Start the FlowForge development worker')
  .option('-p, --port <port>', 'Worker port', String(DEFAULT_WORKER_PORT))
  .option('--no-watch', 'Disable file watching')
  .action(async (options: DevOptions) => {
    const port = parseInt(options.port ?? String(DEFAULT_WORKER_PORT), 10);
    const shouldWatch = options.watch !== false;

    const spinner = ora('Starting dev worker...').start();

    let worker = new Worker({ port });

    try {
      await worker.start();
      spinner.succeed(chalk.green(`Dev worker running on port ${port}`));
    } catch (err) {
      spinner.fail(chalk.red(`Failed to start worker: ${err}`));
      process.exit(1);
    }

    // File watching for hot reload
    if (shouldWatch) {
      const watchDir = path.resolve(process.cwd(), 'src');
      if (fs.existsSync(watchDir)) {
        console.log(chalk.dim(`Watching ${watchDir} for changes...`));
        const watcher = fs.watch(watchDir, { recursive: true }, async (eventType, filename) => {
          if (!filename || !filename.endsWith('.ts')) return;
          console.log(chalk.yellow(`\n  File changed: ${filename} — restarting...`));
          try {
            await worker.stop();
            worker = new Worker({ port });
            await worker.start();
            console.log(chalk.green('  Worker restarted.\n'));
          } catch (err) {
            console.error(chalk.red(`  Restart failed: ${err}\n`));
          }
        });

        process.on('SIGINT', async () => {
          watcher.close();
          await worker.stop();
          console.log(chalk.dim('\nWorker stopped.'));
          process.exit(0);
        });
        process.on('SIGTERM', async () => {
          watcher.close();
          await worker.stop();
          process.exit(0);
        });
      } else {
        console.log(chalk.dim(`No src/ directory found — file watching disabled.`));
      }
    }
  });
