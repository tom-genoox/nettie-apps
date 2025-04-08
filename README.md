# Nettie Apps

This is the root repository for all Nettie applications.

## Repository Structure

- `curated-db/` - Curated database application
- `franklin-id/` - Franklin ID authentication service

## Developer Onboarding

### Prerequisites

- Node.js (latest LTS version recommended)
- Git
- Bun (used in some projects)

### Getting Started

1. Clone this repository:
   ```bash
   git clone https://github.com/genoox/nettie-apps.git
   cd nettie-apps
   ```
   
   Or to clone with all submodules in one command:
   ```bash
   git clone --recurse-submodules https://github.com/genoox/nettie-apps.git
   cd nettie-apps
   ```

2. Initialize all submodules:
   ```bash
   git submodule update --init --recursive
   ```

3. Set up each subproject as needed:
   ```bash
   # For curated-db
   cd curated-db
   npm install
   
   # For franklin-id
   cd ../franklin-id
   npm install
   ```

4. Follow individual project READMEs for specific setup instructions and environment variables.

## Adding a New Repository

### Method 1: Git Submodules (Recommended)

1. Create your new repository on GitHub or your Git provider
2. Add it as a submodule to this repository:
   ```bash
   git submodule add https://github.com/genoox/new-app-name.git
   git commit -m "Add new-app-name as submodule"
   git push
   ```

### Method 2: Manual Addition

1. Create a new directory in the root repository:
   ```bash
   mkdir new-app-name
   cd new-app-name
   ```

2. Initialize a new project:
   ```bash
   # For a new React project using Vite
   npm create vite@latest . -- --template react-ts
   
   # For other project types, use the appropriate initialization
   ```

3. Commit your changes:
   ```bash
   git add .
   git commit -m "Add new-app-name"
   git push
   ```

## Project Guidelines

- Each project should include its own README with setup instructions
- Follow consistent coding standards across projects
- Add a CONTRIBUTING.md file to each project for contribution guidelines

## Deployment

Each project should include its own deployment documentation in its README.