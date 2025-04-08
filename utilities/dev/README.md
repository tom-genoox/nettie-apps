# Nettie App Generator

A CLI tool to generate new Nettie standalone apps and utilities, create GitHub repositories, and register them as submodules in the main repository.

## Features

- Creates new standalone applications in the `apps/` directory
- Creates new utilities in the `utilities/frontend/` or `utilities/backend/` directories
- Optionally creates GitHub repositories for new projects
- Registers new projects as Git submodules in the main repository
- Generates project templates with common files and configurations
- Smart GitHub authentication with browser support and token saving

## Installation

### Local Installation

From the repository root, run:

```bash
cd utilities/dev
bun install
bun link
```

This will make the CLI tool available globally on your system as `nettie-create`.

## Usage

To create a new project:

```bash
nettie-create init
```

This will prompt you for:

1. Project type (App, Frontend Utility, or Backend Utility)
2. Project name (in kebab-case)
3. Project description
4. GitHub repository name (usually organization/repo-name)
5. Whether to create a GitHub repository automatically

The tool will:

1. Create the appropriate directory structure
2. Generate project files from templates
3. Initialize a Git repository 
4. Create a GitHub repository (if requested)
5. Add the project as a submodule to the main repository

### GitHub Authentication

The tool provides several convenient ways to authenticate with GitHub:

1. **Environment Variables**: Set `GITHUB_TOKEN` or `GH_TOKEN` in your environment
2. **Saved Tokens**: The tool can securely save tokens for future use
3. **Browser Authentication**: Opens GitHub token creation page in your browser
4. **Manual Entry**: You can still manually paste a token if preferred

When the tool needs a GitHub token, it will:

1. Check for a token in environment variables
2. Look for a previously saved token
3. If no token is found, or if you choose not to use a saved token, it will offer:
   - Opening the GitHub token creation page in your browser
   - Manual token entry

After successful authentication, you'll have the option to save the token securely for future use.

## Development

### Requirements

- Bun 1.0.0 or higher
- Git
- GitHub personal access token (for creating repositories)

### Commands

```bash
# Run the CLI locally during development
bun run src/index.ts init

# Build the package
bun run build
```

## Project Templates

The CLI generates projects based on templates in the `templates/` directory:

- `templates/app/` - Templates for standalone applications
- `templates/utility/` - Templates for utility projects

If these directories are empty, the CLI will generate default templates.

## License

MIT
