# Nettie CLI Tools

A collection of CLI tools to improve the developer experience for Nettie apps development.

## Features

- **nettie create**: Generate new Nettie standalone apps and utilities
  - Creates new standalone applications in the `apps/` directory
  - Creates new utilities in the `utilities/frontend/` or `utilities/backend/` directories
  - Optionally creates GitHub repositories for new projects (using the genoox-nettie organization)
  - Automatically pushes the initial commit to GitHub repositories
  - Registers new projects as Git submodules in the main repository
- **nettie update**: Update the CLI tool to the latest version
  - Pulls the latest changes from the repository
  - Reinstalls dependencies
  - Relinks the CLI commands
- **nettie setup**: (Coming soon) Setup your development environment with common tools and configurations

## Installation

### Local Installation

From the repository root, run:

```bash
cd utilities/cli
bun install
bun link
```

This will make the CLI tool available globally on your system as `nettie` and `nettie-create`.

### Shell Completions

#### Zsh

The CLI includes Zsh completions for a better command-line experience. The completions are automatically installed during `bun install` to `~/.zsh/completion/_nettie`.

To enable the completions, add the following to your `~/.zshrc`:

```bash
# Add custom completion scripts
fpath=(~/.zsh/completion $fpath)

# Initialize completions
autoload -U compinit
compinit
```

After adding these lines:
1. Restart your shell or run `source ~/.zshrc`
2. Try typing `nettie` and press TAB to see the available commands
3. After typing `nettie create` and pressing TAB, you'll see the available project types

## Usage

### Main CLI

The main entry point for all Nettie tools:

```bash
nettie
```

Without arguments, this will show the help information listing all available commands.

### Create Command

To create a new project:

```bash
nettie create
```

Or you can use the legacy command:

```bash
nettie-create init
```

This will prompt you for:

1. Project type (App, Frontend Utility, or Backend Utility)
2. Project name (in kebab-case)
3. Project description
4. GitHub repository name (defaults to genoox-nettie/your-project-name)

The tool will:

1. Create the appropriate directory structure
2. Generate project files from templates
3. Initialize a Git repository 
4. Create a GitHub repository (if requested)
5. Push the initial commit to GitHub
6. Try to add the project as a submodule to the main repository

### Update Command

To update the CLI to the latest version:

```bash
nettie update
```

This will:
1. Pull the latest changes from the repository
2. Reinstall dependencies
3. Relink the CLI commands

Note: This command must be run from within the nettie-apps repository.

### GitHub Repository Creation

By default, all repositories are created in the `genoox-nettie` organization. If you don't have permission to create repositories in this organization, the tool will fall back to creating them in your personal GitHub account instead.

### Pushing Initial Commit

The tool will attempt to push the initial commit to the GitHub repository using either the `main` or `master` branch. This ensures that when the repository is added as a submodule, it has a valid commit to reference.

### Submodule Handling

The tool attempts to add the new project as a Git submodule to the main repository. For this to work correctly:

1. You must run the tool from within a Git repository
2. The detected Git repository must be the same as your nettie-apps repository
3. The GitHub repository must have at least one commit (which is now ensured by the automatic push)

If the tool cannot add the submodule automatically (e.g., if it can't find a valid Git repository), it will provide you with the exact commands needed to manually add the submodule later.

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
