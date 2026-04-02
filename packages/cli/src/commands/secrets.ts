import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ENV_FILE = '.env';

function readEnvFile(envPath: string): Map<string, string> {
  const entries = new Map<string, string>();
  if (!fs.existsSync(envPath)) {
    return entries;
  }

  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.substring(0, eqIndex).trim();
    const value = trimmed.substring(eqIndex + 1).trim();
    entries.set(key, value);
  }

  return entries;
}

function writeEnvFile(envPath: string, entries: Map<string, string>): void {
  let content = '';

  // Preserve comments and structure if file exists
  if (fs.existsSync(envPath)) {
    const existing = fs.readFileSync(envPath, 'utf-8');
    const lines = existing.split('\n');
    const written = new Set<string>();

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('#')) {
        content += line + '\n';
        continue;
      }

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        content += line + '\n';
        continue;
      }

      const key = trimmed.substring(0, eqIndex).trim();
      if (entries.has(key)) {
        content += `${key}=${entries.get(key)}\n`;
        written.add(key);
      } else {
        content += line + '\n';
      }
    }

    // Add new keys not yet in the file
    for (const [key, value] of entries) {
      if (!written.has(key)) {
        content += `${key}=${value}\n`;
      }
    }
  } else {
    content = '# Conduit Secrets\n\n';
    for (const [key, value] of entries) {
      content += `${key}=${value}\n`;
    }
  }

  fs.writeFileSync(envPath, content, 'utf-8');
}

const setSubcommand = new Command('set')
  .description('Store a secret/credential')
  .argument('<key>', 'Secret key (e.g., API_KEY)')
  .argument('<value>', 'Secret value')
  .option('--env-file <path>', 'Path to .env file', ENV_FILE)
  .action((key: string, value: string, options: { envFile?: string }) => {
    const envPath = path.resolve(options.envFile ?? ENV_FILE);
    const spinner = ora(`Setting secret "${key}"...`).start();

    try {
      const entries = readEnvFile(envPath);
      const isUpdate = entries.has(key);
      entries.set(key, value);
      writeEnvFile(envPath, entries);

      spinner.succeed(
        isUpdate
          ? `Updated secret "${key}" in ${path.relative(process.cwd(), envPath)}`
          : `Stored secret "${key}" in ${path.relative(process.cwd(), envPath)}`,
      );
      console.log(
        chalk.dim(
          '\n  Make sure .env is in your .gitignore to avoid committing secrets.\n',
        ),
      );
    } catch (error) {
      spinner.fail('Failed to store secret');
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`\n  Error: ${message}`));
      process.exitCode = 1;
    }
  });

const listSubcommand = new Command('list')
  .description('List stored secret keys')
  .option('--env-file <path>', 'Path to .env file', ENV_FILE)
  .option('--show-values', 'Show secret values (use with caution)')
  .action((options: { envFile?: string; showValues?: boolean }) => {
    const envPath = path.resolve(options.envFile ?? ENV_FILE);

    try {
      const entries = readEnvFile(envPath);

      if (entries.size === 0) {
        console.log(chalk.dim('\n  No secrets found.\n'));
        console.log(chalk.dim('  Store a secret with: conduit secrets set <key> <value>\n'));
        return;
      }

      console.log(chalk.bold(`\n  Secrets (${path.relative(process.cwd(), envPath)})\n`));

      for (const [key, value] of entries) {
        if (options.showValues) {
          console.log(`  ${chalk.cyan(key.padEnd(30))} ${chalk.dim(value)}`);
        } else {
          const masked = value.length > 4 ? value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2) : '****';
          console.log(`  ${chalk.cyan(key.padEnd(30))} ${chalk.dim(masked)}`);
        }
      }

      console.log(chalk.dim(`\n  ${entries.size} secret(s) found.\n`));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`\n  Error: ${message}`));
      process.exitCode = 1;
    }
  });

export const secretsCommand = new Command('secrets')
  .description('Manage secrets and credentials')
  .addCommand(setSubcommand)
  .addCommand(listSubcommand);
