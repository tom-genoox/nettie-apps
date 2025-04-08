import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { simpleGit } from 'simple-git';
import { Octokit } from 'octokit';
import type { UtilityConfig } from '../types/index.ts';
import { createGitHubRepository, generateProjectFiles } from '../utils/index.ts';

/**
 * Creates a new utility in the utilities directory
 */
export async function createUtility(config: UtilityConfig): Promise<void> {
  const { name, description, githubRepo, createGithubRepo, githubToken, type } = config;
  
  console.log(chalk.blue.bold(`Creating new ${type} utility: ${name}`));

  // Determine the relative path from the current directory to the workspace root
  const workspaceRoot = path.resolve(process.cwd(), '../../..');
  const utilityPath = path.join(workspaceRoot, 'utilities', type, name);
  
  try {
    // Check if directory already exists
    try {
      await fs.access(utilityPath);
      throw new Error(`Directory already exists: ${utilityPath}`);
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

    // Create the utility directory
    await fs.mkdir(utilityPath, { recursive: true });
    console.log(chalk.green(`✅ Created utility directory: ${utilityPath}`));

    // Generate project files
    await generateProjectFiles({
      name,
      description,
      outputDir: utilityPath,
      templateDir: path.join(process.cwd(), 'templates', 'utility'),
      type,
    });
    
    console.log(chalk.green(`✅ Project files generated`));

    // Initialize git repository
    const git = simpleGit({ baseDir: utilityPath });
    
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
    await mainGit.submoduleAdd(`https://github.com/${githubRepo}.git`, `utilities/${type}/${name}`);
    await mainGit.add(`.gitmodules`);
    await mainGit.commit(`Add ${name} as a submodule`);
    
    console.log(chalk.green(`✅ Added as submodule to the main repository`));

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create utility: ${error.message}`);
    }
    throw new Error('Failed to create utility due to an unknown error');
  }
} 