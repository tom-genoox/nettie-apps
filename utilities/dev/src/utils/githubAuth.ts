import { Octokit } from 'octokit';
import chalk from 'chalk';
import inquirer from 'inquirer';
import open from 'open';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

// Try to use keytar for secure storage if possible
let keytar: any;
try {
  keytar = await import('keytar');
} catch (error) {
  // Keytar is optional, if not available we'll use file-based storage
  console.log(chalk.yellow('Secure credential storage not available, falling back to file-based storage'));
}

const SERVICE_NAME = 'nettie-app-generator';
const ACCOUNT_NAME = 'github-token';
const CONFIG_FILE = path.join(os.homedir(), '.nettie-app-generator-config.json');

/**
 * Get GitHub token from various sources
 */
export async function getGitHubToken(): Promise<string | null> {
  // First try environment variable
  const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (envToken) {
    return envToken;
  }

  // Then try secure storage
  if (keytar) {
    const savedToken = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    if (savedToken) {
      return savedToken;
    }
  } else {
    // Try file-based storage
    try {
      const configExists = await fileExists(CONFIG_FILE);
      if (configExists) {
        const configContent = await fs.readFile(CONFIG_FILE, 'utf8');
        const config = JSON.parse(configContent);
        if (config.githubToken) {
          return config.githubToken;
        }
      }
    } catch (error) {
      // Ignore error and continue to prompt
    }
  }

  return null;
}

/**
 * Save GitHub token to secure storage or file
 */
export async function saveGitHubToken(token: string): Promise<void> {
  // First try secure storage
  if (keytar) {
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
  } else {
    // Fall back to file storage
    try {
      let config: Record<string, any> = {};
      
      // Read existing config if it exists
      const configExists = await fileExists(CONFIG_FILE);
      if (configExists) {
        const configContent = await fs.readFile(CONFIG_FILE, 'utf8');
        config = JSON.parse(configContent);
      }
      
      // Update token
      config.githubToken = token;
      
      // Write config
      await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
      await fs.chmod(CONFIG_FILE, 0o600); // Make the file only readable/writable by the owner
    } catch (error) {
      console.error(chalk.red('Failed to save token to config file'));
    }
  }
}

/**
 * Handles GitHub authentication with browser support
 */
export async function handleGitHubAuth(): Promise<string> {
  // First check if we already have a token
  const savedToken = await getGitHubToken();
  
  if (savedToken) {
    // Verify the token is valid
    try {
      const octokit = new Octokit({ auth: savedToken });
      const { data } = await octokit.rest.users.getAuthenticated();
      
      console.log(chalk.green(`✅ Found saved GitHub token for ${data.login}`));
      
      // Ask if user wants to use this token
      const { useExistingToken } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useExistingToken',
          message: `Use existing GitHub token for ${data.login}?`,
          default: true,
        }
      ]);
      
      if (useExistingToken) {
        return savedToken;
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️ Saved GitHub token is not valid or expired'));
    }
  }
  
  // Ask how the user wants to authenticate
  const { authMethod } = await inquirer.prompt([
    {
      type: 'list',
      name: 'authMethod',
      message: 'How would you like to authenticate with GitHub?',
      choices: [
        { name: 'Open GitHub token page in browser', value: 'browser' },
        { name: 'Enter token manually', value: 'manual' }
      ],
    }
  ]);
  
  let token = '';
  
  if (authMethod === 'browser') {
    console.log(chalk.blue('Opening GitHub token creation page in your browser...'));
    console.log(chalk.yellow('Make sure to enable "repo" scope for the token.'));
    
    // Open GitHub token page
    await open('https://github.com/settings/tokens/new?description=Nettie%20App%20Generator&scopes=repo');
    
    // Prompt for the token
    const { tokenInput } = await inquirer.prompt([
      {
        type: 'password',
        name: 'tokenInput',
        message: 'Paste your GitHub token here:',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'GitHub token cannot be empty';
          }
          return true;
        },
      }
    ]);
    
    token = tokenInput;
  } else {
    // Manual token entry
    const { tokenInput } = await inquirer.prompt([
      {
        type: 'password',
        name: 'tokenInput',
        message: 'Enter your GitHub token (with repo scope):',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'GitHub token cannot be empty';
          }
          return true;
        },
      }
    ]);
    
    token = tokenInput;
  }
  
  // Verify the token is valid
  try {
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.users.getAuthenticated();
    console.log(chalk.green(`✅ Successfully authenticated as ${data.login}`));
    
    // Ask if the user wants to save the token
    const { saveToken } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'saveToken',
        message: 'Would you like to save this token for future use?',
        default: true,
      }
    ]);
    
    if (saveToken) {
      await saveGitHubToken(token);
      console.log(chalk.green('✅ Token saved for future use'));
    }
    
    return token;
  } catch (error) {
    console.error(chalk.red('❌ Failed to authenticate with GitHub. Please check your token.'));
    throw new Error('GitHub authentication failed');
  }
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
} 