import chalk from 'chalk';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { simpleGit } from 'simple-git';
import { findGitRoot } from '../utils/index.ts';

/**
 * Handle errors related to not being in the nettie-apps repository
 */
function handleNettieRepoError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message === 'not in the nettie-apps repository') {
      console.error(chalk.red('\n❌ This command must be run from within the nettie-apps repository.'));
      console.log(chalk.yellow('\nPlease:'));
      console.log(chalk.yellow('1. Navigate to your nettie-apps repository'));
      console.log(chalk.yellow('2. Try the command again'));
      process.exit(1);
    } else if (error.message === 'not in a git repository') {
      console.error(chalk.red('\n❌ Not in a git repository.'));
      console.log(chalk.yellow('\nPlease:'));
      console.log(chalk.yellow('1. Navigate to your nettie-apps repository'));
      console.log(chalk.yellow('2. Try the command again'));
      process.exit(1);
    }
  }
  throw error;
}

/**
 * Execute a command from the git root directory
 */
function execFromGitRoot(command: string, options: { stdio?: 'inherit' | 'pipe', encoding?: 'utf-8' } = { encoding: 'utf-8' }): string {
  const gitRoot = findGitRoot();
  const currentDir = process.cwd();
  
  try {
    process.chdir(gitRoot);
    const result = execSync(command, { ...options, encoding: 'utf-8' });
    return result || '';
  } finally {
    process.chdir(currentDir);
  }
}

/**
 * List all submodules in the repository
 */
export async function listSubmodules(): Promise<void> {
  try {
    console.log(chalk.blue('\nListing all submodules in the repository:'));
    
    // Get workspace root
    const workspaceRoot = findGitRoot();
    const git = simpleGit({ baseDir: workspaceRoot });
    
    // Get submodule status
    const statusOutput = execFromGitRoot('git submodule status', { encoding: 'utf-8' }) as string;
    
    if (!statusOutput.trim()) {
      console.log(chalk.yellow('\nNo submodules found in this repository.'));
      return;
    }
    
    // Get submodule URLs using git config
    const configOutput = execFromGitRoot('git config --file .gitmodules --get-regexp url', { encoding: 'utf-8' }) as string;
    const urlMap = new Map<string, string>();
    
    configOutput.split('\n').forEach(line => {
      const match = line.match(/submodule\.(.+)\.url\s+(.+)/);
      if (match) {
        urlMap.set(match[1], match[2]);
      }
    });
    
    // Parse and display submodules in a more readable format
    const submodules = statusOutput.split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => {
        // The format is typically: [+]<commit-hash> <path> (<branch>)
        const parts = line.trim().match(/^[\s+-]?([a-f0-9]+)\s+(.+?)(?:\s+\((.+?)\))?$/);
        if (!parts) return null;
        
        return {
          commit: parts[1].substr(0, 7),
          path: parts[2],
          branch: parts[3] || 'N/A',
          url: urlMap.get(parts[2]) || 'N/A'
        };
      })
      .filter(item => item !== null);
    
    // Display in a nice format
    submodules.forEach((submodule) => {
      if (!submodule) return;
      console.log(chalk.green(`\n📁 ${chalk.bold(submodule.path)}`));
      console.log(`  Repository: ${chalk.blue(submodule.url)}`);
      console.log(`  Commit: ${chalk.yellow(submodule.commit)}`);
      console.log(`  Branch: ${chalk.yellow(submodule.branch)}`);
    });
    
    console.log(''); // Add a blank line at the end
  } catch (error) {
    handleNettieRepoError(error);
  }
}

/**
 * Update all submodules or a specific submodule
 */
export function updateSubmodules(submodulePath?: string): void {
  try {
    const gitRoot = execFromGitRoot('git rev-parse --show-toplevel').trim();
    process.chdir(gitRoot);

    // Get list of submodules to update
    const submodules = submodulePath
      ? [submodulePath]
      : execFromGitRoot('git submodule status')
          .split('\n')
          .filter(Boolean)
          .map((line: string) => line.trim().split(/\s+/)[1]);

    if (submodules.length === 0) {
      console.log(chalk.yellow('No submodules found.'));
      return;
    }

    // Store initial states
    const initialStates = new Map(submodules.map((path: string) => {
      try {
        const commit = execFromGitRoot(`git -C "${path}" rev-parse HEAD`).trim();
        const branch = execFromGitRoot(`git -C "${path}" rev-parse --abbrev-ref HEAD`).trim();
        return [path, { commit, branch }];
      } catch {
        return [path, { commit: '', branch: '' }];
      }
    }));

    // Fetch all changes for each submodule
    for (const path of submodules) {
      console.log(chalk.blue(`\nFetching updates for ${path}...`));
      try {
        // Initialize submodule if needed
        execFromGitRoot(`git submodule update --init "${path}"`, { stdio: 'inherit' });
        
        // Fetch all branches, tags, and remotes
        execFromGitRoot(`git -C "${path}" remote update --prune`, { stdio: 'inherit' });
        execFromGitRoot(`git -C "${path}" fetch --all --tags --prune --prune-tags`, { stdio: 'inherit' });
        
        // Get all remote branches
        const remoteBranches = execFromGitRoot(`git -C "${path}" branch -r`)
          .split('\n')
          .filter(line => line.trim() && !line.includes('HEAD'))
          .map(line => line.trim());

        // Create local tracking branches for all remote branches
        for (const remoteBranch of remoteBranches) {
          const localBranch = remoteBranch.replace(/^origin\//, '');
          try {
            // Check if local branch exists
            const branchExists = execFromGitRoot(`git -C "${path}" rev-parse --verify ${localBranch} 2>/dev/null`);
            if (!branchExists) {
              execFromGitRoot(`git -C "${path}" branch --track ${localBranch} ${remoteBranch}`, { stdio: 'inherit' });
              console.log(chalk.green(`   Created tracking branch ${localBranch} -> ${remoteBranch}`));
            }
          } catch {
            // Branch already exists or other error, continue to next branch
          }
        }
        
        console.log(chalk.green(`✅ Fetched all branches and tags for ${path}`));
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Could not fetch updates for ${path}: ${error instanceof Error ? error.message : 'unknown error'}`));
      }
    }

    // Check for local changes before updating
    const submoduleStatuses = submodules.map((path: string) => {
      const hasChanges = (execFromGitRoot(`git -C "${path}" status --porcelain`) || '').length > 0;
      const hasUnpushedChanges = (execFromGitRoot(`git -C "${path}" log @{u}..@ --oneline 2>/dev/null || true`) || '').length > 0;
      return { path, hasChanges, hasUnpushedChanges };
    });

    // Update submodules
    console.log(chalk.blue('\nUpdating submodules...'));
    let hasConflicts = false;

    for (const path of submodules) {
      const status = submoduleStatuses.find(s => s.path === path);
      const initialState = initialStates.get(path);

      if (status?.hasChanges || status?.hasUnpushedChanges) {
        console.log(chalk.yellow(`\n⚠️  ${path}:`));
        if (status.hasChanges) {
          console.log(chalk.yellow(`   Has local uncommitted changes`));
        }
        if (status.hasUnpushedChanges) {
          console.log(chalk.yellow(`   Has unpushed commits`));
        }
        hasConflicts = true;
        continue;
      }

      try {
        // Get remote branch info
        const trackingBranch = execFromGitRoot(`git -C "${path}" rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo ''`)?.trim() || '';
        
        if (!trackingBranch) {
          console.log(chalk.yellow(`\n⚠️  ${path}: No tracking branch set`));
          continue;
        }

        // Update to latest of current branch
        execFromGitRoot(`git -C "${path}" merge --ff-only @{u}`);
        
        const newCommit = execFromGitRoot(`git -C "${path}" rev-parse HEAD`)?.trim() || '';
        const newBranch = execFromGitRoot(`git -C "${path}" rev-parse --abbrev-ref HEAD`)?.trim() || '';

        if (newCommit !== initialState?.commit) {
          console.log(chalk.green(`\n✅ ${path}:`));
          console.log(chalk.green(`   Updated from ${initialState?.commit.slice(0, 7)} to ${newCommit.slice(0, 7)}`));
          console.log(chalk.green(`   On branch ${newBranch}`));
        } else {
          console.log(chalk.blue(`\n📌 ${path}: Already up to date on ${newBranch}`));
        }
      } catch (error) {
        console.log(chalk.yellow(`\n⚠️  ${path}: Update failed - ${error instanceof Error ? error.message : 'unknown error'}`));
        hasConflicts = true;
      }
    }

    if (hasConflicts) {
      console.log(chalk.yellow('\n⚠️  Some submodules need attention:'));
      console.log(chalk.yellow('   1. For uncommitted changes:'));
      console.log(chalk.yellow('      - Commit your changes: git -C <submodule-path> commit -am "your message"'));
      console.log(chalk.yellow('      - Or stash them: git -C <submodule-path> stash'));
      console.log(chalk.yellow('   2. For unpushed commits:'));
      console.log(chalk.yellow('      - Push your changes: git -C <submodule-path> push'));
      console.log(chalk.yellow('      - Or reset to remote: git -C <submodule-path> reset --hard @{u}'));
      console.log(chalk.yellow('   3. Run nettie submodule update again'));
    } else {
      console.log(chalk.green('\n✨ All submodules updated successfully!'));
    }
  } catch (error) {
    handleNettieRepoError(error);
  }
}

/**
 * Remove a submodule from the repository
 */
export async function removeSubmodule(submodulePath?: string): Promise<void> {
  try {
    // If no path provided, ask the user to select from existing submodules
    if (!submodulePath) {
      submodulePath = await promptSubmoduleSelection();
      if (!submodulePath) {
        console.log(chalk.yellow('\nNo submodule selected. Operation cancelled.'));
        return;
      }
    }
    
    const gitRoot = findGitRoot();
    
    // Get list of actual submodules with their full paths
    const submoduleStatus = execFromGitRoot('git submodule status', { encoding: 'utf-8' }) as string;
    const submodules = submoduleStatus.split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => {
        const parts = line.trim().match(/^[\s+-]?[a-f0-9]+\s+(.+?)(?:\s+\(.+?\))?$/);
        return parts ? parts[1] : null;
      })
      .filter(path => path !== null) as string[];

    // If the provided path is just the submodule name (e.g., "kit-validator"),
    // try to find its full path (e.g., "apps/kit-validator")
    if (!submodules.includes(submodulePath)) {
      const matchingSubmodule = submodules.find(path => path.endsWith('/' + submodulePath));
      if (matchingSubmodule) {
        submodulePath = matchingSubmodule;
      } else {
        throw new Error(`Submodule '${submodulePath}' does not exist`);
      }
    }
    
    // Confirm removal
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to remove the submodule '${submodulePath}'?`,
        default: false
      }
    ]);
    
    if (!confirm) {
      console.log(chalk.yellow('\nOperation cancelled.'));
      return;
    }
    
    console.log(chalk.blue(`\nRemoving submodule: ${chalk.bold(submodulePath)}...`));
    
    // Steps to properly remove a Git submodule
    execFromGitRoot(`git submodule deinit -f ${submodulePath}`, { stdio: 'inherit' });
    execFromGitRoot(`git rm -f ${submodulePath}`, { stdio: 'inherit' });
    execFromGitRoot(`rm -rf .git/modules/${submodulePath}`, { stdio: 'inherit' });
    execFromGitRoot(`git commit -m "Remove submodule ${submodulePath}"`, { stdio: 'inherit' });
    
    console.log(chalk.green(`\n✅ Submodule '${submodulePath}' removed successfully!`));

    // Ask if user wants to delete the folder
    const { deleteFolder } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'deleteFolder',
        message: `Do you want to delete the folder '${submodulePath}' as well?`,
        default: false
      }
    ]);

    if (deleteFolder) {
      const fullPath = path.join(gitRoot, submodulePath);
      try {
        execFromGitRoot(`rm -rf ${submodulePath}`, { stdio: 'inherit' });
        console.log(chalk.green(`\n✅ Folder '${submodulePath}' deleted successfully!`));
      } catch (error) {
        console.log(chalk.yellow(`\n⚠️  Could not delete folder: ${error instanceof Error ? error.message : 'unknown error'}`));
      }
    }
  } catch (error) {
    handleNettieRepoError(error);
  }
}

/**
 * Prompt the user to select a submodule from the list of existing submodules
 */
async function promptSubmoduleSelection(): Promise<string | undefined> {
  try {
    const output = execFromGitRoot('git submodule status', { encoding: 'utf-8' }) as string;
    
    if (!output.trim()) {
      console.log(chalk.yellow('\nNo submodules found in this repository.'));
      return undefined;
    }
    
    // Parse submodules
    const submodules = output.split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => {
        const parts = line.trim().match(/^[\s+-]?[a-f0-9]+\s+(.+?)(?:\s+\(.+?\))?$/);
        return parts ? parts[1] : null;
      })
      .filter(path => path !== null) as string[];
    
    if (submodules.length === 0) {
      console.log(chalk.yellow('\nNo submodules found in this repository.'));
      return undefined;
    }
    
    // Ask user to select a submodule
    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: 'Select a submodule to remove:',
        choices: submodules
      }
    ]);
    
    return selected;
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`\n❌ Error listing submodules: ${error.message}`));
    } else {
      console.error(chalk.red('\n❌ An unknown error occurred while listing submodules'));
    }
    return undefined;
  }
} 