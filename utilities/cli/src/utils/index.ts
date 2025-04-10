import { Octokit } from 'octokit';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import type { ProjectType } from '../types/index.ts';
import chalk from 'chalk';
import { simpleGit } from 'simple-git';
import { execSync } from 'child_process';

interface CreateRepoParams {
  name: string;
  description: string;
  token: string;
  org?: string;
}

interface GenerateProjectFilesParams {
  name: string;
  description: string;
  outputDir: string;
  templateDir: string;
  type: ProjectType | string;
}

interface GitHubErrorResponse {
  response?: {
    status?: number;
    data?: {
      errors?: Array<{
        message?: string;
      }>;
    };
  };
  message?: string;
}

/**
 * Find the root directory of the Git repository, handling submodules
 * @returns The absolute path to the main Git repository root
 */
export function findGitRoot(): string {
  try {
    // First try to get the immediate git root
    const currentGitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
    
    // Check if we're in a submodule by looking for a .git file
    const gitPath = path.join(currentGitRoot, '.git');
    try {
      const gitFileContent = fs.readFileSync(gitPath, 'utf-8').trim();
      const gitdirMatch = gitFileContent.match(/^gitdir:\s*(.+)$/);
      
      if (gitdirMatch) {
        // We're in a submodule, the gitdir path will be relative to the submodule root
        // and will point to .git/modules/[submodule-path] in the parent repository
        const relativeGitDir = gitdirMatch[1];
        const absoluteGitDir = path.resolve(currentGitRoot, relativeGitDir);
        
        // The parent repository root will be 3 levels up from the modules directory
        // e.g., /path/to/parent/.git/modules/submodule -> /path/to/parent
        const parentRoot = path.resolve(absoluteGitDir, '..', '..', '..');
        
        // Verify this is actually the nettie-apps repository by checking for the CLI directory
        const cliPath = path.join(parentRoot, 'utilities', 'cli');
        if (fs.existsSync(cliPath)) {
          return parentRoot;
        }
      }
    } catch (error) {
      // If reading .git fails, we're probably in a regular git directory, not a submodule
    }
    
    // If we're not in a submodule or couldn't find the parent, verify this is the nettie-apps repository
    const cliPath = path.join(currentGitRoot, 'utilities', 'cli');
    if (fs.existsSync(cliPath)) {
      return currentGitRoot;
    }
    
    throw new Error('not in the nettie-apps repository');
  } catch (error) {
    throw new Error('not in a git repository');
  }
}

/**
 * Ensures a path is relative to the repository root
 * @param type The type of project ('app', 'frontend', or 'backend')
 * @param name The name of the project
 * @returns The full path relative to the repository root
 */
export async function getProjectPath(type: ProjectType | string, name: string): Promise<string> {
  const root = findGitRoot();
  
  switch (type) {
    case 'app':
      return path.join(root, 'apps', name);
    case 'frontend':
    case 'backend':
      return path.join(root, 'utilities', type, name);
    default:
      throw new Error(`Unknown project type: ${type}`);
  }
}

/**
 * Creates a new GitHub repository
 */
export async function createGitHubRepository(params: CreateRepoParams): Promise<string> {
  const { name, description, token, org } = params;
  
  try {
    const octokit = new Octokit({
      auth: token
    });

    // If org is specified, try to create in the organization
    if (org) {
      try {
        // Check if organization exists and user has access
        await octokit.rest.orgs.get({ org });
        
        // Create repository in the organization
        const { data } = await octokit.rest.repos.createInOrg({
          org,
          name,
          description,
          auto_init: false,
          private: true,
        });
        
        console.log(chalk.green(`✅ Created repository in organization: ${org}/${name}`));
        return `${org}/${name}`;
      } catch (error: unknown) {
        // Check for name already exists error
        const gitHubError = error as GitHubErrorResponse;
        if (gitHubError.response && gitHubError.response.status === 422 && 
            gitHubError.response.data && gitHubError.response.data.errors && 
            gitHubError.response.data.errors.some(e => e.message && e.message.includes('already exists'))) {
          throw new Error(`Repository name '${name}' already exists in organization ${org}. Please choose a different name.`);
        }
        
        console.log(chalk.yellow(`⚠️ Could not create repository in organization: ${org}`));
        console.log(chalk.blue('Creating repository in your personal account instead...'));
      }
    }
    
    // If we get here, either no org was specified or creating in the org failed
    // Create in the user's account instead
    try {
      const { data } = await octokit.rest.repos.createForAuthenticatedUser({
        name,
        description,
        auto_init: false,
        private: true,
      });
      
      console.log(chalk.green(`✅ Created repository in your personal account: ${data.owner.login}/${name}`));
      return `${data.owner.login}/${name}`;
    } catch (error: unknown) {
      // Check for name already exists error
      const gitHubError = error as GitHubErrorResponse;
      if (gitHubError.response && gitHubError.response.status === 422 && 
          gitHubError.response.data && gitHubError.response.data.errors && 
          gitHubError.response.data.errors.some(e => e.message && e.message.includes('already exists'))) {
        throw new Error(`Repository name '${name}' already exists in your account. Please choose a different name.`);
      }
      
      // Re-throw the original error
      throw error;
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create GitHub repository: ${error.message}`);
    }
    throw new Error('Failed to create GitHub repository due to an unknown error');
  }
}

/**
 * Generate project files from templates
 */
export async function generateProjectFiles(params: GenerateProjectFilesParams): Promise<void> {
  const { name, description, outputDir, templateDir, type } = params;
  
  try {
    // Check if template directory exists
    try {
      await fsPromises.access(templateDir);
    } catch (error) {
      // Create a basic template structure if not exists
      await fsPromises.mkdir(templateDir, { recursive: true });
      await createDefaultTemplates(templateDir, type);
    }

    // Read template directory
    const files = await fsPromises.readdir(templateDir, { withFileTypes: true });
    
    // Process each template file
    for (const file of files) {
      const srcPath = path.join(templateDir, file.name);
      const destPath = path.join(outputDir, file.name);
      
      if (file.isDirectory()) {
        // Create directory and process recursively
        await fsPromises.mkdir(destPath, { recursive: true });
        await generateProjectFiles({
          name,
          description,
          outputDir: destPath,
          templateDir: srcPath,
          type,
        });
      } else {
        // Read template file
        let content = await fsPromises.readFile(srcPath, 'utf8');
        
        // Replace template variables
        content = content
          .replace(/\{\{name\}\}/g, name)
          .replace(/\{\{description\}\}/g, description)
          .replace(/\{\{type\}\}/g, type);
          
        // Write file to destination
        await fsPromises.writeFile(destPath, content);
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate project files: ${error.message}`);
    }
    throw new Error('Failed to generate project files due to an unknown error');
  }
}

/**
 * Creates default templates if they don't exist
 */
async function createDefaultTemplates(templateDir: string, type: ProjectType | string): Promise<void> {
  // Create basic structure based on project type
  const files = type === 'app' ? getAppTemplateFiles() : getUtilityTemplateFiles();
  
  for (const [filename, content] of Object.entries(files)) {
    const filePath = path.join(templateDir, filename);
    const dirPath = path.dirname(filePath);
    
    // Create directories if needed
    await fsPromises.mkdir(dirPath, { recursive: true });
    
    // Write file
    await fsPromises.writeFile(filePath, content);
  }
}

/**
 * Get template files for app projects
 */
function getAppTemplateFiles(): Record<string, string> {
  return {
    'README.md': `# {{name}}

{{description}}

## Overview

This application is part of the Nettie Apps ecosystem.

## Getting Started

### Prerequisites

- Node.js (latest LTS version recommended)
- npm or yarn

### Installation

\`\`\`bash
npm install
# or
yarn install
\`\`\`

### Development

\`\`\`bash
npm run dev
# or
yarn dev
\`\`\`

## Project Structure

\`\`\`
src/           # Source code
├─ components/ # React components
├─ pages/      # Application pages/routes
├─ utils/      # Utility functions
└─ types/      # TypeScript type definitions
public/        # Static files
\`\`\`

## Configuration

[Describe any environment variables or configuration options here]

## License

This project is licensed under the MIT License.
`,
    'package.json': `{
  "name": "{{name}}",
  "version": "0.1.0",
  "description": "{{description}}",
  "main": "index.js",
  "scripts": {
    "dev": "echo 'Add your development script here'",
    "build": "echo 'Add your build script here'",
    "start": "echo 'Add your start script here'",
    "test": "echo 'Add your test script here'"
  },
  "keywords": [],
  "author": "",
  "license": "MIT"
}`,
    '.gitignore': `# Dependency directories
node_modules/
dist/
build/

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Debug logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Editor directories and files
.idea/
.vscode/
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
`
  };
}

/**
 * Get template files for utility projects
 */
function getUtilityTemplateFiles(): Record<string, string> {
  return {
    'README.md': `# {{name}}

{{description}}

## Overview

This utility is part of the Nettie Apps ecosystem.

## Installation

\`\`\`bash
npm install {{name}}
# or
yarn add {{name}}
\`\`\`

## Usage

\`\`\`typescript
import { someFunction } from '{{name}}';

// Example code
const result = someFunction();
console.log(result);
\`\`\`

## API Reference

### \`someFunction()\`

Description of what the function does...

**Parameters:**
- None

**Returns:**
- \`string\` - A greeting message

## Development

\`\`\`bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test
\`\`\`

## License

This project is licensed under the MIT License.
`,
    'package.json': `{
  "name": "{{name}}",
  "version": "0.1.0",
  "description": "{{description}}",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsc",
    "test": "echo 'Add your test script here'",
    "prepublishOnly": "npm run build"
  },
  "keywords": [],
  "author": "",
  "license": "MIT",
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "declaration": true,
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "**/*.test.ts"]
}`,
    'src/index.ts': `/**
 * {{name}} - {{description}}
 */

/**
 * Example function
 */
export function exampleFunction(): string {
  return 'Hello from {{name}}!';
}
`,
    '.gitignore': `# Dependency directories
node_modules/
dist/
build/

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Debug logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Editor directories and files
.idea/
.vscode/
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
`
  };
} 