# Nettie App Generator

A CLI tool to generate new Nettie standalone apps and utilities, create GitHub repositories, and register them as submodules in the main repository.

## Features

- Creates new standalone applications in the `apps/` directory
- Creates new utilities in the `utilities/frontend/` or `utilities/backend/` directories
- Optionally creates GitHub repositories for new projects
- Registers new projects as Git submodules in the main repository
- Generates project templates with common files and configurations

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
6. GitHub token (if creating a repository)

The tool will:

1. Create the appropriate directory structure
2. Generate project files from templates
3. Initialize a Git repository 
4. Create a GitHub repository (if requested)
5. Add the project as a submodule to the main repository

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
