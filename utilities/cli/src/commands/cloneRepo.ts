import chalk from 'chalk';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { Octokit } from 'octokit';
import type { CloneOptions } from '../types/index.ts';
import { handleGitHubAuth } from '../utils/githubAuth.ts';
import { getProjectPath } from '../utils/index.ts';
import simpleGit from 'simple-git';

/**
 * Fork and clone a repository from GitHub and add it as a submodule
 */
export async function forkRepo(options?: Partial<CloneOptions>): Promise<void> {
  try {
    // Get GitHub token
    const githubToken = await handleGitHubAuth();
    if (!githubToken) {
      throw new Error('GitHub token is required to fork a repository');
    }
    
    // Get repo URL if not provided
    const repoUrl = options?.repoUrl || await askForRepoUrl();
    
    // Get repo type if not provided
    const repoType = options?.repoType || await askForRepoType();
    
    // Extract info from the repo URL
    const { owner, repo } = extractRepoInfo(repoUrl);
    if (!owner || !repo) {
      throw new Error('Could not extract repository information from URL');
    }
    
    // Fork the repo to the organization
    console.log(chalk.blue(`\nForking repository ${chalk.bold(`${owner}/${repo}`)} to your organization...`));
    const forkedRepoInfo = await forkGitHubRepo(githubToken, owner, repo);
    
    // Wait for the fork to be ready (GitHub needs a moment)
    console.log(chalk.blue('Waiting for the fork to be ready...'));
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Calculate target directory
    const targetDir = await getTargetDirectory(repoType, repo);
    
    // Clone and add as submodule
    console.log(chalk.blue(`\nCloning forked repository ${chalk.bold(forkedRepoInfo.fullName)} as a ${chalk.bold(repoType)}...`));
    await cloneAndCheckout(forkedRepoInfo.cloneUrl, targetDir);
    
    console.log(chalk.green(`\n✅ Repository successfully forked and cloned to ${chalk.bold(targetDir)}`));
    console.log(chalk.green(`   Forked repository: ${chalk.bold(forkedRepoInfo.htmlUrl)}`));
    console.log(chalk.blue('\nNext steps:'));
    console.log(`  1. Navigate to the repository: ${chalk.yellow(`cd ${targetDir}`)}`);
    console.log(`  2. Follow the README.md for setup instructions\n`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
    } else {
      console.error(chalk.red('\n❌ An unknown error occurred'));
    }
    process.exit(1);
  }
}

/**
 * Fork a GitHub repository to the user's account or organization
 */
async function forkGitHubRepo(token: string, owner: string, repo: string) {
  try {
    const octokit = new Octokit({ auth: token });
    
    // The organization to fork to (could be configurable later)
    const org = 'genoox-nettie';
    
    // Create the fork
    const response = await octokit.rest.repos.createFork({
      owner,
      repo,
      organization: org,
    });
    
    return {
      fullName: response.data.full_name,
      cloneUrl: response.data.clone_url,
      htmlUrl: response.data.html_url,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fork repository: ${error.message}`);
    } else {
      throw new Error('Failed to fork repository: unknown error');
    }
  }
}

/**
 * Extract owner and repo name from GitHub URL
 */
function extractRepoInfo(url: string): { owner: string | null; repo: string | null } {
  // Handle HTTPS URLs
  let match = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)(?:\.git)?$/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  
  // Handle SSH URLs
  match = url.match(/git@github\.com:([^\/]+)\/([^\/\.]+)(?:\.git)?$/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  
  return { owner: null, repo: null };
}

/**
 * Ask the user for the GitHub repository URL
 */
async function askForRepoUrl(): Promise<string> {
  const { repoUrl } = await inquirer.prompt([
    {
      type: 'input',
      name: 'repoUrl',
      message: 'Enter the GitHub repository URL to fork:',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Repository URL cannot be empty';
        }
        // Basic validation for Git URLs
        if (!(input.includes('github.com/') || input.includes('git@github.com:'))) {
          return 'Please enter a valid GitHub repository URL';
        }
        return true;
      },
    },
  ]);
  
  return repoUrl;
}

/**
 * Ask the user for the repository type
 */
async function askForRepoType(): Promise<string> {
  const { repoType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'repoType',
      message: 'What type of repository is this?',
      choices: [
        { name: 'App (standalone application)', value: 'app' },
        { name: 'Frontend Utility', value: 'frontend' },
        { name: 'Backend Utility', value: 'backend' },
      ],
    },
  ]);
  
  return repoType;
}

/**
 * Extract the repository name from the URL
 */
function getRepoNameFromUrl(url: string): string {
  // Handle both HTTPS and SSH URLs
  const match = url.match(/\/([^\/]+)\.git$/);
  if (!match) {
    throw new Error('Could not extract repository name from URL');
  }
  return match[1];
}

/**
 * Get the target directory based on the repository type
 */
async function getTargetDirectory(repoType: string, repoName: string): Promise<string> {
  try {
    return await getProjectPath(repoType, repoName);
  } catch (error) {
    throw new Error(`Failed to determine target directory: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

/**
 * Clone and checkout the repository
 */
async function cloneAndCheckout(repoUrl: string, targetDir: string): Promise<void> {
  try {
    // Clone the forked repository
    await simpleGit({ baseDir: targetDir }).clone(repoUrl);
    
    // Get the default branch
    console.log(chalk.blue('\nFetching default branch...'));
    const repoGit = simpleGit({ baseDir: targetDir });
    await repoGit.fetch(['--all']);
    const defaultBranch = (await repoGit.raw(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])).trim().replace('origin/', '');
    
    // Checkout the default branch
    console.log(chalk.blue(`Checking out default branch: ${defaultBranch}`));
    await repoGit.checkout(defaultBranch);
    await repoGit.pull();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to clone and checkout repository: ${error.message}`);
    } else {
      throw new Error('Failed to clone and checkout repository: unknown error');
    }
  }
}

/**
 * Add the repository as a submodule
 */
function addSubmodule(repoUrl: string, targetDir: string): void {
  try {
    // Make sure the parent directory exists
    const parentDir = path.dirname(targetDir);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    
    // Add the submodule
    console.log(chalk.blue(`Adding submodule to ${targetDir}...`));
    execSync(`git submodule add ${repoUrl} ${targetDir}`, { stdio: 'inherit' });
    
    // Initialize the submodule
    console.log(chalk.blue(`Initializing submodule...`));
    execSync(`git submodule update --init ${targetDir}`, { stdio: 'inherit' });
    
    // Commit the changes
    console.log(chalk.blue(`Committing the changes...`));
    execSync(`git commit -m "Add ${targetDir} as submodule"`, { stdio: 'inherit' });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to add submodule: ${error.message}`);
    } else {
      throw new Error('Failed to add submodule: unknown error');
    }
  }
} 