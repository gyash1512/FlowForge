import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { DEFAULT_WORKER_PORT, type RunRecord, type StepRecord } from '@flowforgejs/shared';

export interface RunsListOptions {
  port?: string;
  limit?: string;
  status?: string;
}

export interface RunsInspectOptions {
  port?: string;
}

function formatStatus(status: string): string {
  switch (status) {
    case 'completed':
      return chalk.green(status);
    case 'failed':
      return chalk.red(status);
    case 'running':
      return chalk.blue(status);
    case 'pending':
      return chalk.yellow(status);
    case 'cancelled':
      return chalk.gray(status);
    case 'paused':
      return chalk.magenta(status);
    case 'waiting':
      return chalk.cyan(status);
    default:
      return status;
  }
}

function formatDuration(ms: number | undefined): string {
  if (ms === undefined || ms === null) return chalk.dim('--');
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

const listSubcommand = new Command('list')
  .description('List recent workflow runs')
  .option('-p, --port <port>', 'Worker port', String(DEFAULT_WORKER_PORT))
  .option('-l, --limit <count>', 'Number of runs to display', '20')
  .option('-s, --status <status>', 'Filter by status')
  .action(async (options: RunsListOptions) => {
    const port = parseInt(options.port ?? String(DEFAULT_WORKER_PORT), 10);
    const limit = parseInt(options.limit ?? '20', 10);
    const url = new URL(`http://localhost:${port}/runs`);

    url.searchParams.set('limit', String(limit));
    if (options.status) {
      url.searchParams.set('status', options.status);
    }

    const spinner = ora('Fetching runs...').start();

    try {
      const response = await fetch(url.toString());

      if (!response.ok) {
        spinner.fail(`Failed to fetch runs (HTTP ${response.status})`);
        process.exitCode = 1;
        return;
      }

      const runs = (await response.json()) as RunRecord[];
      spinner.stop();

      if (runs.length === 0) {
        console.log(chalk.dim('\n  No runs found.\n'));
        return;
      }

      console.log(chalk.bold('\n  Recent Runs\n'));
      console.log(
        chalk.dim(
          '  ' +
            'ID'.padEnd(28) +
            'Workflow'.padEnd(24) +
            'Status'.padEnd(14) +
            'Duration'.padEnd(12) +
            'Started',
        ),
      );
      console.log(chalk.dim('  ' + '-'.repeat(90)));

      for (const run of runs) {
        const startedAt = run.startedAt ? new Date(run.startedAt).toLocaleString() : '--';
        const duration =
          run.startedAt && run.completedAt
            ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
            : undefined;

        console.log(
          `  ${chalk.cyan(run.id.padEnd(28))}${(run.workflowId ?? '').padEnd(24)}${formatStatus(run.status).padEnd(24)}${formatDuration(duration).padEnd(12)}${chalk.dim(startedAt)}`,
        );
      }

      console.log('');
    } catch (error) {
      spinner.fail('Failed to fetch runs');
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('ECONNREFUSED')) {
        console.error(chalk.red(`\n  Could not connect to worker at localhost:${port}`));
        console.error(chalk.dim('  Is the dev worker running? Try: flowforge dev'));
      } else {
        console.error(chalk.red(`\n  Error: ${message}`));
      }
      process.exitCode = 1;
    }
  });

const inspectSubcommand = new Command('inspect')
  .description('Show detailed run trace')
  .argument('<id>', 'Run ID')
  .option('-p, --port <port>', 'Worker port', String(DEFAULT_WORKER_PORT))
  .action(async (id: string, options: RunsInspectOptions) => {
    const port = parseInt(options.port ?? String(DEFAULT_WORKER_PORT), 10);
    const url = `http://localhost:${port}/runs/${id}`;

    const spinner = ora(`Fetching run ${id}...`).start();

    try {
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          spinner.fail(`Run not found: ${id}`);
        } else {
          spinner.fail(`Failed to fetch run (HTTP ${response.status})`);
        }
        process.exitCode = 1;
        return;
      }

      const result = (await response.json()) as { run: RunRecord; steps: StepRecord[] };
      spinner.stop();

      const { run, steps } = result;

      console.log(chalk.bold('\n  Run Details\n'));
      console.log(`  ${chalk.dim('ID:')}          ${chalk.cyan(run.id)}`);
      console.log(`  ${chalk.dim('Workflow:')}    ${run.workflowId}`);
      console.log(`  ${chalk.dim('Status:')}      ${formatStatus(run.status)}`);
      console.log(
        `  ${chalk.dim('Started:')}     ${run.startedAt ? new Date(run.startedAt).toLocaleString() : '--'}`,
      );
      console.log(
        `  ${chalk.dim('Completed:')}   ${run.completedAt ? new Date(run.completedAt).toLocaleString() : '--'}`,
      );

      if (run.error) {
        console.log(`  ${chalk.dim('Error:')}       ${chalk.red(run.error)}`);
      }

      if (steps && steps.length > 0) {
        console.log(chalk.bold('\n  Steps\n'));
        console.log(
          chalk.dim(
            '  ' +
              'Step'.padEnd(24) +
              'Node'.padEnd(20) +
              'Status'.padEnd(14) +
              'Duration'.padEnd(12) +
              'Attempt',
          ),
        );
        console.log(chalk.dim('  ' + '-'.repeat(78)));

        for (const step of steps) {
          console.log(
            `  ${step.stepName.padEnd(24)}${step.nodeName.padEnd(20)}${formatStatus(step.status).padEnd(24)}${formatDuration(step.durationMs).padEnd(12)}${String(step.attempt)}`,
          );
        }
      }

      if (run.input !== undefined) {
        console.log(chalk.bold('\n  Input'));
        console.log(chalk.dim(`  ${JSON.stringify(run.input, null, 2).replace(/\n/g, '\n  ')}`));
      }

      if (run.output !== undefined) {
        console.log(chalk.bold('\n  Output'));
        console.log(chalk.dim(`  ${JSON.stringify(run.output, null, 2).replace(/\n/g, '\n  ')}`));
      }

      console.log('');
    } catch (error) {
      spinner.fail('Failed to fetch run details');
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('ECONNREFUSED')) {
        console.error(chalk.red(`\n  Could not connect to worker at localhost:${port}`));
        console.error(chalk.dim('  Is the dev worker running? Try: flowforge dev'));
      } else {
        console.error(chalk.red(`\n  Error: ${message}`));
      }
      process.exitCode = 1;
    }
  });

export const runsCommand = new Command('runs')
  .description('Manage workflow runs')
  .addCommand(listSubcommand)
  .addCommand(inspectSubcommand);
