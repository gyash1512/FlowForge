import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { DEFAULT_WORKER_PORT } from '@flowforge/shared';

export interface EmitOptions {
  port?: string;
  source?: string;
}

export const emitCommand = new Command('emit')
  .description('Send a test event to the local dev worker')
  .argument('<type>', 'Event type (e.g., "order.created")')
  .argument('[data]', 'Event data as JSON string', '{}')
  .option('-p, --port <port>', 'Worker port', String(DEFAULT_WORKER_PORT))
  .option('-s, --source <source>', 'Event source identifier', 'cli')
  .action(async (type: string, data: string, options: EmitOptions) => {
    const port = parseInt(options.port ?? String(DEFAULT_WORKER_PORT), 10);
    const url = `http://localhost:${port}/events`;

    let parsedData: unknown;
    try {
      parsedData = JSON.parse(data);
    } catch {
      console.error(chalk.red('\n  Error: Invalid JSON data'));
      console.error(chalk.dim(`  Received: ${data}`));
      process.exitCode = 1;
      return;
    }

    const spinner = ora(`Emitting event "${type}"...`).start();

    const payload = {
      type,
      data: parsedData,
      source: options.source ?? 'cli',
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text();
        spinner.fail(`Failed to emit event (HTTP ${response.status})`);
        console.error(chalk.red(`\n  ${body}`));
        process.exitCode = 1;
        return;
      }

      const result = await response.json() as Record<string, unknown>;
      spinner.succeed(`Event "${type}" emitted successfully`);
      console.log(chalk.dim(`\n  URL:      ${url}`));
      console.log(chalk.dim(`  Type:     ${type}`));
      console.log(chalk.dim(`  Source:   ${options.source ?? 'cli'}`));
      if (result && typeof result === 'object' && 'id' in result) {
        console.log(chalk.dim(`  Event ID: ${result.id}`));
      }
      console.log('');
    } catch (error) {
      spinner.fail('Failed to emit event');
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('ECONNREFUSED')) {
        console.error(
          chalk.red(`\n  Could not connect to dev worker at ${url}`),
        );
        console.error(chalk.dim('  Is the dev worker running? Try: conduit dev'));
      } else {
        console.error(chalk.red(`\n  Error: ${message}`));
      }
      process.exitCode = 1;
    }
  });
