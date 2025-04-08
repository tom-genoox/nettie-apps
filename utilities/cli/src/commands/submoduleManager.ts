import chalk from 'chalk';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';

/**
 * List all submodules in the repository
 */
export function listSubmodules(): void {
  try {
    console.log(chalk.blue('\nListing all submodules in the repository:'));
    const output = execSync('git submodule status', { encoding: 'utf-8' });
    
    if (!output.trim()) {
      console.log(chalk.yellow('\nNo submodules found in this repository.'));
      return;
    }
    
    // Parse and display submodules in a more readable format
    const submodules = output.split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => {
        // The format is typically: [+]<commit-hash> <path> (<branch>)
        const parts = line.trim().match(/^[\s+-]?([a-f0-9]+)\s+(.+?)(?:\s+\((.+?)\))?$/);
        if (!parts) return null;
        
        return {
          commit: parts[1].substr(0, 7),
          path: parts[2],
          branch: parts[3] || 'N/A'
        };
      })
      .filter(item => item !== null);
    
    // Display in a nice format
    submodules.forEach((submodule) => {
      if (!submodule) return;
      console.log(chalk.green(`\n📁 ${chalk.bold(submodule.path)}`));
      console.log(`  Commit: ${chalk.yellow(submodule.commit)}`);
      console.log(`  Branch: ${chalk.yellow(submodule.branch)}`);
    });
    
    console.log(''); // Add a blank line at the end
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`\n❌ Error listing submodules: ${error.message}`));
    } else {
      console.error(chalk.red('\n❌ An unknown error occurred while listing submodules'));
    }
    process.exit(1);
  }
}

/**
 * Update all submodules or a specific submodule
 */
export function updateSubmodules(submodulePath?: string): void {
  try {
    if (submodulePath) {
      console.log(chalk.blue(`\nUpdating submodule: ${chalk.bold(submodulePath)}...`));
      execSync(`git submodule update --init --recursive ${submodulePath}`, { stdio: 'inherit' });
    } else {
      console.log(chalk.blue('\nUpdating all submodules...'));
      execSync('git submodule update --init --recursive', { stdio: 'inherit' });
    }
    
    console.log(chalk.green('\n✅ Submodules updated successfully!'));
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`\n❌ Error updating submodules: ${error.message}`));
    } else {
      console.error(chalk.red('\n❌ An unknown error occurred while updating submodules'));
    }
    process.exit(1);
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
    
    // Check if the submodule exists
    if (!fs.existsSync(path.join('.git/modules', submodulePath))) {
      throw new Error(`Submodule '${submodulePath}' does not exist`);
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
    execSync(`git submodule deinit -f ${submodulePath}`, { stdio: 'inherit' });
    execSync(`git rm -f ${submodulePath}`, { stdio: 'inherit' });
    execSync(`rm -rf .git/modules/${submodulePath}`, { stdio: 'inherit' });
    execSync(`git commit -m "Remove submodule ${submodulePath}"`, { stdio: 'inherit' });
    
    console.log(chalk.green(`\n✅ Submodule '${submodulePath}' removed successfully!`));
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`\n❌ Error removing submodule: ${error.message}`));
    } else {
      console.error(chalk.red('\n❌ An unknown error occurred while removing the submodule'));
    }
    process.exit(1);
  }
}

/**
 * Prompt the user to select a submodule from the list of existing submodules
 */
async function promptSubmoduleSelection(): Promise<string | undefined> {
  try {
    const output = execSync('git submodule status', { encoding: 'utf-8' });
    
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