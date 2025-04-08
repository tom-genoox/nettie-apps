import { Octokit } from 'octokit';
import fs from 'fs/promises';
import path from 'path';
import type { ProjectType } from '../types/index.ts';

interface CreateRepoParams {
  name: string;
  description: string;
  token: string;
  org: string;
}

interface GenerateProjectFilesParams {
  name: string;
  description: string;
  outputDir: string;
  templateDir: string;
  type: ProjectType | string;
}

/**
 * Creates a new GitHub repository
 */
export async function createGitHubRepository(params: CreateRepoParams): Promise<void> {
  const { name, description, token, org } = params;
  
  try {
    const octokit = new Octokit({
      auth: token
    });

    // Check if organization exists
    try {
      await octokit.rest.orgs.get({ org });
    } catch (error) {
      throw new Error(`Organization ${org} does not exist or you don't have access to it`);
    }

    // Create repository in the organization
    await octokit.rest.repos.createInOrg({
      org,
      name,
      description,
      auto_init: false,
      private: false,
    });
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
      await fs.access(templateDir);
    } catch (error) {
      // Create a basic template structure if not exists
      await fs.mkdir(templateDir, { recursive: true });
      await createDefaultTemplates(templateDir, type);
    }

    // Read template directory
    const files = await fs.readdir(templateDir, { withFileTypes: true });
    
    // Process each template file
    for (const file of files) {
      const srcPath = path.join(templateDir, file.name);
      const destPath = path.join(outputDir, file.name);
      
      if (file.isDirectory()) {
        // Create directory and process recursively
        await fs.mkdir(destPath, { recursive: true });
        await generateProjectFiles({
          name,
          description,
          outputDir: destPath,
          templateDir: srcPath,
          type,
        });
      } else {
        // Read template file
        let content = await fs.readFile(srcPath, 'utf8');
        
        // Replace template variables
        content = content
          .replace(/\{\{name\}\}/g, name)
          .replace(/\{\{description\}\}/g, description)
          .replace(/\{\{type\}\}/g, type);
          
        // Write file to destination
        await fs.writeFile(destPath, content);
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
    await fs.mkdir(dirPath, { recursive: true });
    
    // Write file
    await fs.writeFile(filePath, content);
  }
}

/**
 * Get template files for app projects
 */
function getAppTemplateFiles(): Record<string, string> {
  return {
    'README.md': `# {{name}}

{{description}}

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

## Installation

\`\`\`bash
npm install {{name}}
# or
yarn add {{name}}
\`\`\`

## Usage

\`\`\`typescript
import { someFunction } from '{{name}}';

// Use the utility here
\`\`\`

## API

### someFunction()

Description of what the function does...

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