import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { devCommand } from './commands/dev.js';
import { emitCommand } from './commands/emit.js';
import { runsCommand } from './commands/runs.js';
import { nodeCommand } from './commands/node-cmd.js';
import { secretsCommand } from './commands/secrets.js';
import { deployCommand } from './commands/deploy.js';
import { connectionsCommand } from './commands/connections.js';

const program = new Command();

program
  .name('conduit')
  .description('Conduit CLI — Developer tools for building and managing workflows')
  .version('0.1.0');

program.addCommand(initCommand);
program.addCommand(devCommand);
program.addCommand(emitCommand);
program.addCommand(runsCommand);
program.addCommand(nodeCommand);
program.addCommand(secretsCommand);
program.addCommand(deployCommand);
connectionsCommand(program);

program.parse();
