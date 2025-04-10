import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { simpleGit } from 'simple-git';
import { Octokit } from 'octokit';
import type { ProjectConfig } from '../types/index.ts';
import { createGitHubRepository, generateProjectFiles, findGitRoot, getProjectPath } from '../utils/index.ts';
import { getGitHubUsername } from '../utils/githubAuth.ts';

/**
 * Creates a new app in the apps directory
 */
export async function createApp(config: ProjectConfig): Promise<void> {
  const { name, description, githubRepo, createGithubRepo, githubToken } = config;
  
  console.log(chalk.blue.bold(`Creating new app: ${name}`));

  // Get the workspace root and app path
  const workspaceRoot = await findGitRoot();
  const appPath = await getProjectPath('app', name);
  
  console.log(chalk.green(`✅ Found Git repository root at: ${workspaceRoot}`));
  
  // Variable to store the actual GitHub repository path
  let actualGithubRepo = githubRepo;
  
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
      // Check if remote 'origin' already exists and remove it if it does
      try {
        const remotes = await git.getRemotes();
        const originExists = remotes.some(remote => remote.name === 'origin');
        
        if (originExists) {
          console.log(chalk.yellow(`⚠️ Remote 'origin' already exists, updating it with the new URL...`));
          await git.remote(['remove', 'origin']);
        }
        
        await git.addRemote('origin', `https://github.com/${actualGithubRepo}.git`);
        
        // Push the initial commit to GitHub - important for submodule to work
        console.log(chalk.blue(`Pushing initial commit to GitHub repository...`));
        
        // Try different branch names for push
        let pushSuccess = false;
        const branchNames = ['main', 'master'];
        
        for (const branch of branchNames) {
          try {
            await git.push('origin', branch);
            pushSuccess = true;
            break;
          } catch (error) {
            // Try next branch name
          }
        }
        
        if (!pushSuccess) {
          console.log(chalk.yellow(`⚠️ Failed to push to GitHub. You may need to push manually later.`));
        } else {
          console.log(chalk.green(`✅ Initial commit pushed to GitHub`));
        }
      } catch (error) {
        console.log(chalk.yellow(`⚠️ Failed to set up GitHub remote: ${error instanceof Error ? error.message : 'unknown error'}`));
      }
      
      // Add as submodule to the main repository
      console.log(chalk.blue(`Adding as submodule to the main repository`));
      
      // First check if workspaceRoot is actually a git repository
      try {
        const mainGit = simpleGit({ baseDir: workspaceRoot });
        
        // Verify this is a git repository (this will throw if not)
        await mainGit.revparse(['--git-dir']);
        
        // Make sure the push has been processed by GitHub - increase the delay
        console.log(chalk.blue(`Waiting for GitHub to process the push before adding submodule...`));
        // Use a longer delay (5 seconds) to ensure GitHub has time to process the push
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check if the submodule path already exists to avoid errors
        const submodulePath = path.join(workspaceRoot, 'apps', name);
        try {
          const stats = await fs.stat(submodulePath);
          if (stats.isDirectory()) {
            // If directory exists but is our newly created app, we can remove it before adding submodule
            if (submodulePath === appPath) {
              console.log(chalk.yellow(`Removing directory before adding as submodule...`));
              await fs.rm(submodulePath, { recursive: true, force: true });
            } else {
              throw new Error(`Directory 'apps/${name}' already exists and seems to be different from our newly created app`);
            }
          }
        } catch (statError) {
          // Directory doesn't exist, which is good for adding a submodule
        }
        
        try {
          // Add the submodule
          await mainGit.submoduleAdd(`https://github.com/${actualGithubRepo}.git`, `apps/${name}`);
          console.log(chalk.green(`✅ Added as submodule successfully`));
        } catch (submoduleError) {
          console.log(chalk.red(`❌ Failed to add submodule: ${submoduleError instanceof Error ? submoduleError.message : 'unknown error'}`));
          
          // Try alternative method
          console.log(chalk.blue(`💡 Attempting alternative method to add submodule...`));
          try {
            await mainGit.raw(['submodule', 'add', `https://github.com/${actualGithubRepo}.git`, `apps/${name}`]);
            console.log(chalk.green(`✅ Added as submodule successfully using alternative method`));
          } catch (altError) {
            console.log(chalk.red(`❌ Alternative method also failed: ${altError instanceof Error ? altError.message : 'unknown error'}`));
            console.log(chalk.blue(`💡 The project has been created but not added as a submodule.`));
            console.log(chalk.blue(`💡 To add it manually, run the following commands from your workspace root:`));
            console.log(chalk.yellow(`   git submodule add https://github.com/${actualGithubRepo}.git apps/${name}`));
            console.log(chalk.yellow(`   git add .gitmodules`));
            console.log(chalk.yellow(`   git commit -m "Add ${name} as a submodule"`));
          }
        }
      } catch (error) {
        console.log(chalk.red(`❌ Failed to add as submodule: ${error instanceof Error ? error.message : 'unknown error'}`));
      }
    } else {
      console.log(chalk.green(`✅ Git repository initialized locally`));
      console.log(chalk.blue(`💡 Since no GitHub repository was created, the project will not be added as a submodule.`));
      console.log(chalk.blue(`💡 If you want to add it as a submodule later, first create a GitHub repository and then run:`));
      console.log(chalk.yellow(`   git remote add origin <your-github-repo-url>`));
      console.log(chalk.yellow(`   git push -u origin main`));
      console.log(chalk.yellow(`   cd ${workspaceRoot}`));
      console.log(chalk.yellow(`   git submodule add <your-github-repo-url> apps/${name}`));
    }

    console.log(chalk.green.bold('\n✅ Project created successfully!'));
    console.log(chalk.blue('Next steps:'));
    console.log(`  1. Navigate to the new project: ${chalk.yellow(`cd apps/${name}`)}`);
    console.log(`  2. Read the README.md for specific setup instructions`);
    console.log(`  3. Start developing!\n`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create app: ${error.message}`);
    }
    throw new Error('Failed to create app due to an unknown error');
  }
} 