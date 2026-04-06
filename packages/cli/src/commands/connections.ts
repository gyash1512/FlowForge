import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

const testSubcommand = new Command('test')
  .description('Test a data source connection')
  .argument('<name>', 'Connection name to test')
  .option('--url <url>', 'Server URL', 'http://localhost:4000')
  .action(async (name: string, options: { url?: string }) => {
    const baseUrl = options.url ?? 'http://localhost:4000';
    const spinner = ora(`Testing connection "${name}"...`).start();

    try {
      const response = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Connection-Name': name,
        },
      });

      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>;
        spinner.succeed(`Connection "${name}" is healthy`);
        console.log(chalk.green(`\n  Status: ${response.status}`));
        if (data && typeof data === 'object') {
          console.log(
            chalk.dim(`  Response: ${JSON.stringify(data, null, 2).replace(/\n/g, '\n  ')}`),
          );
        }
      } else {
        spinner.fail(`Connection "${name}" health check failed`);
        console.log(chalk.red(`\n  Status: ${response.status}`));
        const body = await response.text();
        if (body) {
          console.log(chalk.red(`  Response: ${body}`));
        }
        process.exitCode = 1;
      }
    } catch (error) {
      spinner.fail(`Failed to reach server at ${baseUrl}`);
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`\n  Error: ${message}`));
      console.log(chalk.dim('\n  Make sure the FlowForge server is running (flowforge dev).\n'));
      process.exitCode = 1;
    }

    console.log('');
  });

export function connectionsCommand(program: Command): void {
  const cmd = new Command('connections')
    .description('Manage and test data source connections')
    .addCommand(testSubcommand);

  program.addCommand(cmd);
}
