import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { simpleGit } from 'simple-git';
import { Octokit } from 'octokit';
import type { UtilityConfig } from '../types/index.ts';
import { createGitHubRepository, generateProjectFiles, findGitRoot } from '../utils/index.ts';
import { getGitHubUsername } from '../utils/githubAuth.ts';

/**
 * Creates a new utility in the utilities directory
 */
export async function createUtility(config: UtilityConfig): Promise<void> {
  const { name, description, githubRepo, createGithubRepo, githubToken, type } = config;
  
  console.log(chalk.blue.bold(`Creating new ${type} utility: ${name}`));

  // Find the Git repository root
  let workspaceRoot: string;
  try {
    workspaceRoot = await findGitRoot();
    console.log(chalk.green(`✅ Found Git repository root at: ${workspaceRoot}`));
  } catch (error) {
    console.log(chalk.yellow('⚠️ Could not find Git repository root. Using current directory structure.'));
    // Fallback to the old method
    workspaceRoot = path.resolve(process.cwd(), '../../..');
    console.log(chalk.yellow(`Using fallback workspace root: ${workspaceRoot}`));
  }
  
  const utilityPath = path.join(workspaceRoot, 'utilities', type, name);
  
  // Variable to store the actual GitHub repository path
  let actualGithubRepo = githubRepo;
  
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
      console.log(chalk.blue(`Creating GitHub repository based on: ${githubRepo}`));
      
      const [orgOrUser, repoName] = githubRepo.split('/');
      
      // Get user's GitHub username
      const username = await getGitHubUsername(githubToken);
      
      // If the org/user is not the authenticated user, try to create in that org
      // otherwise, just create in the user's account
      const useOrg = orgOrUser !== username ? orgOrUser : undefined;
      
      // Create the repository
      actualGithubRepo = await createGitHubRepository({
        name: repoName,
        description,
        token: githubToken,
        org: useOrg,
      });
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
      await git.addRemote('origin', `https://github.com/${actualGithubRepo}.git`);
      
      // Push the initial commit to GitHub - important for submodule to work
      console.log(chalk.blue(`Pushing initial commit to GitHub repository...`));
      try {
        await git.push('origin', 'main', ['--set-upstream']);
      } catch (pushError) {
        // Try with master branch if main failed
        try {
          await git.push('origin', 'master', ['--set-upstream']);
        } catch (masterError) {
          console.log(chalk.yellow(`⚠️ Could not push to remote repository. You may need to push manually.`));
          console.log(chalk.yellow(`   Run: cd ${utilityPath} && git push -u origin main`));
        }
      }
      
      console.log(chalk.green(`✅ Git repository initialized with remote and initial commit pushed`));
    } else {
      console.log(chalk.green(`✅ Git repository initialized locally`));
    }

    // Add as submodule to the main repository
    console.log(chalk.blue(`Adding as submodule to the main repository`));
    
    // First check if workspaceRoot is actually a git repository
    try {
      const mainGit = simpleGit({ baseDir: workspaceRoot });
      
      // Verify this is a git repository (this will throw if not)
      await mainGit.revparse(['--git-dir']);
      
      await mainGit.submoduleAdd(`https://github.com/${actualGithubRepo}.git`, `utilities/${type}/${name}`);
      await mainGit.add(`.gitmodules`);
      await mainGit.commit(`Add ${name} as a submodule`);
      
      console.log(chalk.green(`✅ Added as submodule to the main repository`));
    } catch (error) {
      console.error(chalk.red(`❌ Could not add as submodule: ${error instanceof Error ? error.message : 'Unknown error'}`));
      console.log(chalk.yellow(`💡 The project has been created but not added as a submodule.`));
      console.log(chalk.yellow(`💡 To add it manually, run the following commands from your workspace root:`));
      console.log(chalk.yellow(`   git submodule add https://github.com/${actualGithubRepo}.git utilities/${type}/${name}`));
      console.log(chalk.yellow(`   git add .gitmodules`));
      console.log(chalk.yellow(`   git commit -m "Add ${name} as a submodule"`));
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create utility: ${error.message}`);
    }
    throw new Error('Failed to create utility due to an unknown error');
  }
} 