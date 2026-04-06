import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

export interface DeployOptions {
  target?: string;
  dryRun?: boolean;
}

export const deployCommand = new Command('deploy')
  .description('Build and deploy workflows')
  .option('-t, --target <target>', 'Deployment target', 'local')
  .option('--dry-run', 'Show what would be deployed without deploying')
  .action(async (options: DeployOptions) => {
    const target = options.target ?? 'local';
    const dryRun = options.dryRun ?? false;

    console.log(chalk.bold.blue('\n  FlowForge Deploy\n'));
    console.log(chalk.dim(`  Target:   ${target}`));
    console.log(chalk.dim(`  Dry run:  ${dryRun ? 'yes' : 'no'}`));
    console.log('');

    // Step 1: Verify project structure
    const verifySpinner = ora('Verifying project structure...').start();
    const srcDir = path.resolve('src');
    const workflowDir = path.resolve('src/workflows');

    if (!fs.existsSync(srcDir)) {
      verifySpinner.fail('No src/ directory found. Is this a FlowForge project?');
      process.exitCode = 1;
      return;
    }

    if (!fs.existsSync(workflowDir)) {
      verifySpinner.fail('No src/workflows/ directory found. Run `flowforge init` first.');
      process.exitCode = 1;
      return;
    }

    const workflowFiles = fs
      .readdirSync(workflowDir)
      .filter((f) => f.endsWith('.workflow.ts') || f.endsWith('.workflow.js'));

    if (workflowFiles.length === 0) {
      verifySpinner.fail('No workflow files found in src/workflows/');
      process.exitCode = 1;
      return;
    }

    verifySpinner.succeed(`Found ${workflowFiles.length} workflow(s)`);
    for (const file of workflowFiles) {
      console.log(chalk.dim(`    - ${file}`));
    }

    // Step 2: Build
    const buildSpinner = ora('Building project...').start();

    if (dryRun) {
      buildSpinner.succeed('Build skipped (dry run)');
    } else {
      try {
        execSync('npm run build', { stdio: 'pipe', cwd: process.cwd() });
        buildSpinner.succeed('Build completed');
      } catch (error) {
        buildSpinner.fail('Build failed');
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`\n  ${message}`));
        process.exitCode = 1;
        return;
      }
    }

    // Step 3: Package
    const packageSpinner = ora('Packaging for deployment...').start();
    const distDir = path.resolve('dist');

    if (!dryRun && !fs.existsSync(distDir)) {
      packageSpinner.fail('Build output not found in dist/');
      process.exitCode = 1;
      return;
    }

    if (dryRun) {
      packageSpinner.succeed('Packaging skipped (dry run)');
    } else {
      packageSpinner.succeed('Package ready');
    }

    // Step 4: Deploy
    const deploySpinner = ora(`Deploying to ${target}...`).start();

    if (dryRun) {
      deploySpinner.succeed('Deployment skipped (dry run)');
      console.log(chalk.yellow('\n  Dry run complete. No changes were made.\n'));
      return;
    }

    switch (target) {
      case 'local':
        deploySpinner.succeed('Deployed to local environment');
        console.log(chalk.dim('\n  Workflows are available in your local dev worker.'));
        console.log(chalk.dim('  Start the worker with: flowforge dev\n'));
        break;

      default:
        deploySpinner.warn(`Deployment target "${target}" is not yet supported.`);
        console.log(chalk.dim('\n  Currently supported targets: local'));
        console.log(chalk.dim('  Remote deployment support is coming soon.\n'));
        break;
    }
  });
