import chalk from 'chalk';
import { simpleGit } from 'simple-git';
import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import { findGitRoot } from '../utils/index.ts';
import { generateCompletion } from './completion.ts';

/**
 * Updates the nettie CLI tool to the latest version
 */
export async function updateCLI(): Promise<void> {
  const originalDir = process.cwd();
  
  try {
    console.log(chalk.blue.bold('Updating Nettie CLI...'));

    // Find the Git repository root
    const workspaceRoot = await findGitRoot();
    if (!workspaceRoot) {
      throw new Error('not in a git repository');
    }
    
    const cliPath = path.join(workspaceRoot, 'utilities', 'cli');
    
    // Verify the CLI directory exists
    try {
      await fs.access(cliPath);
    } catch {
      throw new Error('CLI directory not found. Are you in the nettie-apps repository?');
    }
    
    // Get the current branch
    const git = simpleGit({ baseDir: workspaceRoot });
    const branchInfo = await git.branch();
    const currentBranch = branchInfo.current;

    console.log(chalk.blue(`Current branch: ${currentBranch}`));

    // Pull latest changes from the root directory
    process.chdir(workspaceRoot);
    console.log(chalk.blue('Pulling latest changes...'));
    const pullResult = await git.pull('origin', currentBranch);
    
    if (pullResult.summary.changes === 0 && pullResult.summary.insertions === 0 && pullResult.summary.deletions === 0) {
      console.log(chalk.green('✅ Already up to date!'));
    } else {
      console.log(chalk.green(`✅ Updated with ${pullResult.summary.changes} changes`));
    }

    // Reinstall and relink the CLI from the CLI directory
    console.log(chalk.blue('Reinstalling CLI...'));
    process.chdir(cliPath);
    
    execSync('bun install', { stdio: 'inherit' });
    execSync('bun link', { stdio: 'inherit' });

    // Regenerate completions
    console.log(chalk.blue('Updating shell completions...'));
    await generateCompletion();

    // Force a complete refresh of the completion system
    console.log(chalk.blue('Refreshing completion system...'));
    const zshCommands = [
      'rm -f ~/.zcompdump*',  // Remove completion cache
      'autoload -Uz compinit', // Reload compinit
      'compinit -u',          // Update completions
      'rehash'                // Rebuild command hash table
    ].join(' && ');
    
    execSync(`zsh -c "${zshCommands}"`, { stdio: 'inherit' });

    console.log(chalk.green.bold('\n✅ Nettie CLI updated successfully!'));
    console.log(chalk.yellow('\nPlease run `source ~/.zshrc` or start a new shell session to use the updated CLI.'));
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to update Nettie CLI: ${error instanceof Error ? error.message : 'unknown error'}`));
    if (error instanceof Error && error.message.includes('not in a git repository')) {
      console.log(chalk.yellow('\nPlease run this command from within the nettie-apps repository.'));
    }
    process.exit(1);
  } finally {
    // Always restore the original directory
    process.chdir(originalDir);
  }
} 