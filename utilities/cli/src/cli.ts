#!/usr/bin/env bun

import { Command } from 'commander';
import figlet from 'figlet';
import chalk from 'chalk';
import { runCLI as runCreateCLI } from './index.ts';
import { forkRepo } from './commands/forkRepo.ts';
import { listSubmodules, updateSubmodules, removeSubmodule } from './commands/submoduleManager.ts';

/**
 * Display the Nettie CLI banner
 */
function displayBanner(): void {
  console.log(
    chalk.blue(
      figlet.textSync('Nettie CLI', {
        font: 'Standard',
        horizontalLayout: 'default',
        verticalLayout: 'default',
      })
    )
  );
  console.log(chalk.green('Nettie development tools\n'));
}

/**
 * Main CLI execution function
 */
export async function runNettieCLI(): Promise<void> {
  displayBanner();

  const program = new Command();

  program
    .name('nettie')
    .description('Nettie CLI tools for improved developer experience')
    .version('0.1.0');

  program
    .command('create')
    .description('Create new Nettie apps and utilities')
    .action(async () => {
      // Simulate running 'nettie-create init' by passing ['init'] as args
      // This ensures the original CLI runs with the init command
      process.argv = [process.argv[0], process.argv[1], 'init'];
      await runCreateCLI();
    });

  program
    .command('fork')
    .description('Fork a GitHub repository to your organization and add it as a submodule')
    .option('-u, --url <url>', 'GitHub repository URL')
    .option('-t, --type <type>', 'Repository type (app, frontend, backend)')
    .action(async (options) => {
      await forkRepo({
        repoUrl: options.url,
        repoType: options.type,
      });
    });

  // Submodule command with subcommands
  const submoduleCommand = program
    .command('submodule')
    .description('Manage Git submodules in the repository');

  submoduleCommand
    .command('list')
    .description('List all submodules in the repository')
    .action(() => {
      listSubmodules();
    });

  submoduleCommand
    .command('update')
    .description('Update all submodules or a specific submodule')
    .argument('[path]', 'Path to a specific submodule to update')
    .action((path) => {
      updateSubmodules(path);
    });

  submoduleCommand
    .command('remove')
    .description('Remove a submodule from the repository')
    .argument('[path]', 'Path to the submodule to remove')
    .action(async (path) => {
      await removeSubmodule(path);
    });

  // TODO: Implement setup command in the future
  program
    .command('setup')
    .description('Setup your environment for Nettie development (not implemented yet)')
    .action(() => {
      console.log(chalk.yellow('The setup command is not yet implemented.'));
      console.log(chalk.blue('Coming soon!'));
    });

  // Parse arguments
  program.parse();

  // If no arguments, show help
  if (process.argv.length <= 2) {
    program.help();
  }
} 