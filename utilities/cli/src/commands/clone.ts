import chalk from 'chalk';
import inquirer from 'inquirer';
import { simpleGit } from 'simple-git';
import path from 'path';
import { findGitRoot, getProjectPath } from '../utils/index.ts';
import { handleGitHubAuth, getGitHubUsername } from '../utils/githubAuth.ts';
import { forkRepo } from './forkRepo.ts';

interface CloneOptions {
  url: string;
}

/**
 * Extract organization and repository name from GitHub URL
 */
function parseGitHubUrl(url: string): { org: string; repo: string } {
  // Handle both HTTPS and SSH URLs
  const httpsMatch = url.match(/https:\/\/github\.com\/([^\/]+)\/([^\/\.]+)(?:\.git)?/);
  const sshMatch = url.match(/git@github\.com:([^\/]+)\/([^\/\.]+)(?:\.git)?/);
  const match = httpsMatch || sshMatch;

  if (!match) {
    throw new Error('Invalid GitHub URL format');
  }

  return {
    org: match[1],
    repo: match[2]
  };
}

/**
 * Clone a repository and add it as a submodule
 */
export async function cloneRepo(options: CloneOptions): Promise<void> {
  try {
    const { url } = options;
    const { org, repo } = parseGitHubUrl(url);

    console.log(chalk.blue(`\nProcessing repository: ${org}/${repo}`));

    // Ask for project type
    const { projectType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'projectType',
        message: 'What type of project is this?',
        choices: [
          { name: 'App (standalone application)', value: 'app' },
          { name: 'Frontend Utility', value: 'frontend' },
          { name: 'Backend Utility', value: 'backend' },
        ],
      }
    ]);

    // If not from genoox-nettie org, ask if user wants to fork
    if (org !== 'genoox-nettie') {
      console.log(chalk.yellow(`\nWarning: Repository is not from the genoox-nettie organization.`));
      
      const { shouldFork } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldFork',
          message: 'Would you like to fork this repository to the genoox-nettie organization?',
          default: true,
        }
      ]);

      if (shouldFork) {
        // Fork the repository
        console.log(chalk.blue('\nForking repository to genoox-nettie organization...'));
        await forkRepo({
          repoUrl: url,
          repoType: projectType,
        });
        return; // forkRepo handles the submodule addition
      } else {
        console.log(chalk.yellow('\nProceeding with direct clone (not recommended)'));
      }
    }

    // Get workspace root
    const workspaceRoot = await findGitRoot();
    const git = simpleGit({ baseDir: workspaceRoot });

    // Determine the submodule path based on project type
    const submodulePath = await getProjectPath(projectType, repo);
    const relativePath = path.relative(workspaceRoot, submodulePath);

    // Add as submodule
    console.log(chalk.blue(`\nAdding as submodule to ${relativePath}...`));
    await git.submoduleAdd(url, relativePath);

    // Initialize and update the submodule
    await git.submoduleInit();
    await git.submoduleUpdate(['--recursive', '--remote']);

    // Get the default branch
    console.log(chalk.blue('\nFetching default branch...'));
    const submoduleGit = simpleGit({ baseDir: submodulePath });
    await submoduleGit.fetch(['--all']);
    const defaultBranch = (await submoduleGit.raw(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])).trim().replace('origin/', '');
    
    // Checkout the default branch
    console.log(chalk.blue(`Checking out default branch: ${defaultBranch}`));
    await submoduleGit.checkout(defaultBranch);
    await submoduleGit.pull();

    // Stage the changes
    await git.add(['.gitmodules', relativePath]);
    
    // Commit the changes
    await git.commit(`Add ${org}/${repo} as ${projectType} submodule`);

    console.log(chalk.green.bold('\n✅ Repository successfully cloned and added as submodule!'));
    console.log(chalk.blue('\nNext steps:'));
    console.log(`  1. Navigate to the submodule: ${chalk.yellow(`cd ${relativePath}`)}`);
    console.log(`  2. Read the README.md for setup instructions`);
    console.log(`  3. Start developing!\n`);

  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to clone repository: ${error instanceof Error ? error.message : 'unknown error'}`));
    process.exit(1);
  }
} 