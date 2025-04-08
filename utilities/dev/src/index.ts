#!/usr/bin/env bun

import { Command } from 'commander';
import figlet from 'figlet';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { createApp } from './commands/createApp.ts';
import { createUtility } from './commands/createUtility.ts';
import type { ProjectType, ProjectAnswers } from './types/index.ts';
import { handleGitHubAuth } from './utils/githubAuth.ts';

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
export async function runCLI(): Promise<void> {
  displayBanner();

  const program = new Command();

  program
    .name('nettie-create')
    .description('CLI tool to create new Nettie apps and utilities')
    .version('0.1.0');

  program
    .command('init')
    .description('Initialize a new Nettie project')
    .action(async () => {
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
            `tom-genoox/${answers.projectName}`,
          validate: (input: string) => {
            if (!input.trim()) {
              return 'GitHub repository name cannot be empty';
            }
            if (!/^[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+$/.test(input)) {
              return 'GitHub repository name must be in the format "organization/repo-name"';
            }
            return true;
          },
        },
        {
          type: 'confirm',
          name: 'createGithubRepo',
          message: 'Do you want to create a GitHub repository automatically?',
          default: true,
        },
      ]);

      try {
        // Handle GitHub authentication if needed
        let githubToken: string | undefined;
        
        if (answers.createGithubRepo) {
          // Use our improved auth flow
          githubToken = await handleGitHubAuth();
        }
        
        switch (answers.projectType) {
          case 'app':
            await createApp({
              name: answers.projectName,
              description: answers.description,
              githubRepo: answers.githubRepo,
              createGithubRepo: answers.createGithubRepo,
              githubToken,
            });
            break;
          case 'frontend':
          case 'backend':
            await createUtility({
              name: answers.projectName,
              description: answers.description,
              githubRepo: answers.githubRepo,
              createGithubRepo: answers.createGithubRepo,
              githubToken,
              type: answers.projectType as ProjectType,
            });
            break;
          default:
            throw new Error(`Unknown project type: ${answers.projectType}`);
        }

        console.log(chalk.green.bold('\n✅ Project created successfully!'));
        console.log(chalk.blue('Next steps:'));
        console.log(`  1. Navigate to the new project: ${chalk.yellow(`cd ${answers.projectType === 'app' ? `apps/${answers.projectName}` : `utilities/${answers.projectType}/${answers.projectName}`}`)}`);
        console.log(`  2. Read the README.md for specific setup instructions`);
        console.log(`  3. Start developing!\n`);
      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red(`Error: ${error.message}`));
        } else {
          console.error(chalk.red('An unknown error occurred'));
        }
        process.exit(1);
      }
    });

  // Parse arguments
  program.parse();

  // If no arguments, show help
  if (process.argv.length <= 2) {
    program.help();
  }
} 