#!/usr/bin/env bun

import { Command } from 'commander';
import figlet from 'figlet';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { createApp } from './commands/createApp.ts';
import { createUtility } from './commands/createUtility.ts';
import { updateCLI } from './commands/update.ts';
import type { ProjectType, ProjectAnswers } from './types/index.ts';
import { handleGitHubAuth, getGitHubUsername } from './utils/githubAuth.ts';
import { runCLI as runCreateCLI } from './index.ts';
import { forkRepo } from './commands/forkRepo.ts';
import { listSubmodules, updateSubmodules, removeSubmodule } from './commands/submoduleManager.ts';
import { generateCompletion } from './commands/completion.ts';
import { cloneRepo } from './commands/clone.ts';

/**
 * Display the welcome banner
 */
function displayBanner(): void {
  console.log(
    chalk.blue(
      figlet.textSync('Nettie Apps Generator', {
        font: 'Standard',
        horizontalLayout: 'default',
        verticalLayout: 'default',
      })
    )
  );
  console.log(chalk.green('Create new Nettie apps and utilities with ease!\n'));
}

/**
 * Main CLI execution function
 */
export async function runNettieCLI(): Promise<void> {
  displayBanner();

  const program = new Command();

  program
    .name('nettie')
    .description('CLI tool for managing Nettie apps and utilities')
    .version('0.1.0');

  program
    .command('create')
    .description('Create a new Nettie app or utility')
    .action(async () => {
      // First ask about GitHub repository creation to get token early 
      // so we can use the username in defaults
      const { createGithubRepo } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'createGithubRepo',
          message: 'Do you want to create a GitHub repository automatically?',
          default: true,
        }
      ]);
      
      // Handle GitHub authentication if needed
      let githubToken: string | undefined;
      let githubUsername: string = 'genoox-nettie'; // Default organization
      
      if (createGithubRepo) {
        // Use our improved auth flow
        githubToken = await handleGitHubAuth();
        
        // Get the authenticated username for better defaults
        if (githubToken) {
          try {
            const username = await getGitHubUsername(githubToken);
            console.log(chalk.blue(`Authenticated as GitHub user: ${username}`));
            console.log(chalk.blue(`Will use organization: genoox-nettie for repository creation`));
          } catch (error) {
            console.log(chalk.yellow('Could not get GitHub username, using default organization'));
          }
        }
      }
      
      // Ask the user what type of project they want to create
      const answers = await inquirer.prompt<ProjectAnswers>([
        {
          type: 'list',
          name: 'projectType',
          message: 'What type of project do you want to create?',
          choices: [
            { name: 'App (standalone application)', value: 'app' },
            { name: 'Frontend Utility', value: 'frontend' },
            { name: 'Backend Utility', value: 'backend' },
          ],
        },
        {
          type: 'input',
          name: 'projectName',
          message: 'What is the name of your project?',
          validate: (input: string) => {
            if (!input.trim()) {
              return 'Project name cannot be empty';
            }
            // Check for kebab-case format
            if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input)) {
              return 'Project name must be in kebab-case format (e.g. my-project)';
            }
            return true;
          },
        },
        {
          type: 'input',
          name: 'description',
          message: 'Please provide a short description for your project:',
          validate: (input: string) => {
            if (!input.trim()) {
              return 'Description cannot be empty';
            }
            return true;
          },
        },
        {
          type: 'input',
          name: 'githubRepo',
          message: 'GitHub repository name (usually organization/repo-name):',
          default: (answers: { projectName: string }) => 
            `genoox-nettie/${answers.projectName}`,
          validate: (input: string) => {
            if (!input.trim()) {
              return 'GitHub repository name cannot be empty';
            }
            if (!/^[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+$/.test(input)) {
              return 'GitHub repository name must be in the format "organization/repo-name"';
            }
            return true;
          },
        }
      ]);

      try {
        switch (answers.projectType) {
          case 'app':
            await createApp({
              name: answers.projectName,
              description: answers.description,
              githubRepo: answers.githubRepo,
              createGithubRepo,
              githubToken,
            });
            break;
          case 'frontend':
          case 'backend':
            await createUtility({
              name: answers.projectName,
              description: answers.description,
              githubRepo: answers.githubRepo,
              createGithubRepo,
              githubToken,
              type: answers.projectType as ProjectType,
            });
            break;
          default:
            throw new Error(`Unknown project type: ${answers.projectType}`);
        }
      } catch (error) {
        if (error instanceof Error) {
          // Check if error is about repository name already existing
          if (error.message.includes('already exists')) {
            console.error(chalk.red.bold(`\n❌ ${error.message}`));
            console.log(chalk.yellow(`\nPlease try again with a different project name.`));
          } else {
            console.error(chalk.red(`Error: ${error.message}`));
          }
        } else {
          console.error(chalk.red('An unknown error occurred'));
        }
        process.exit(1);
      }
    });

  program
    .command('update')
    .description('Update Nettie CLI to the latest version')
    .action(async () => {
      await updateCLI();
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
    .description('List all submodules in the repository with their repository URLs')
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

  program
    .command('clone')
    .description('Clone a repository and add it as a submodule')
    .argument('<url>', 'GitHub repository URL')
    .action(async (url) => {
      await cloneRepo({ url });
    });

  program
    .command('completion')
    .description('Generate shell completion script')
    .action(async () => {
      await generateCompletion();
    });

  // Parse arguments
  program.parse();

  // If no arguments, show help
  if (process.argv.length <= 2) {
    program.help();
  }
} 