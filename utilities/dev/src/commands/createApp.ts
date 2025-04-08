import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { simpleGit } from 'simple-git';
import { Octokit } from 'octokit';
import type { ProjectConfig } from '../types/index.ts';
import { createGitHubRepository, generateProjectFiles } from '../utils/index.ts';

/**
 * Creates a new app in the apps directory
 */
export async function createApp(config: ProjectConfig): Promise<void> {
  const { name, description, githubRepo, createGithubRepo, githubToken } = config;
  
  console.log(chalk.blue.bold(`Creating new app: ${name}`));

  // Determine the relative path from the current directory to the workspace root
  const workspaceRoot = path.resolve(process.cwd(), '../../..');
  const appPath = path.join(workspaceRoot, 'apps', name);
  
  try {
    // Check if directory already exists
    try {
      await fs.access(appPath);
      throw new Error(`Directory already exists: ${appPath}`);
    } catch (error) {
      // Directory doesn't exist, which is good
      console.log(chalk.green(`✅ Target directory is available`));
    }

    // Create GitHub repository if requested
    if (createGithubRepo && githubToken) {
      console.log(chalk.blue(`Creating GitHub repository: ${githubRepo}`));
      
      await createGitHubRepository({
        name: githubRepo.split('/')[1],
        description,
        token: githubToken,
        org: githubRepo.split('/')[0],
      });
      
      console.log(chalk.green(`✅ GitHub repository created: ${githubRepo}`));
    }

    // Create the app directory
    await fs.mkdir(appPath, { recursive: true });
    console.log(chalk.green(`✅ Created app directory: ${appPath}`));

    // Generate project files
    await generateProjectFiles({
      name,
      description,
      outputDir: appPath,
      templateDir: path.join(process.cwd(), 'templates', 'app'),
      type: 'app',
    });
    
    console.log(chalk.green(`✅ Project files generated`));

    // Initialize git repository
    const git = simpleGit({ baseDir: appPath });
    
    await git.init();
    await git.add('.');
    await git.commit('Initial commit');
    
    if (createGithubRepo) {
      await git.addRemote('origin', `https://github.com/${githubRepo}.git`);
      console.log(chalk.green(`✅ Git repository initialized with remote`));
    } else {
      console.log(chalk.green(`✅ Git repository initialized locally`));
    }

    // Add as submodule to the main repository
    console.log(chalk.blue(`Adding as submodule to the main repository`));
    
    const mainGit = simpleGit({ baseDir: workspaceRoot });
    await mainGit.submoduleAdd(`https://github.com/${githubRepo}.git`, `apps/${name}`);
    await mainGit.add(`.gitmodules`);
    await mainGit.commit(`Add ${name} as a submodule`);
    
    console.log(chalk.green(`✅ Added as submodule to the main repository`));

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create app: ${error.message}`);
    }
    throw new Error('Failed to create app due to an unknown error');
  }
} 