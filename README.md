# Nettie Apps

This is the root repository for all Nettie applications.

## Repository Structure

- `apps/` - Directory containing all applications
  - `curated-db/` - Curated database application
  - `panel-app/` - Panel application
- `utilities/` - Directory containing utility services and libraries
  - `frontend/` - Frontend utilities
    - `franklin-id/` - Franklin ID authentication service
  - `backend/` - Backend utilities (planned)

## Developer Onboarding

### Prerequisites

- Node.js (latest LTS version recommended)
- Git
- Bun (used in some projects)

### Getting Started

1. Clone this repository:
   ```bash
   git clone https://github.com/tom-genoox/nettie-apps.git
   cd nettie-apps
   ```
   
   Or to clone with all submodules in one command:
   ```bash
   git clone --recurse-submodules https://github.com/tom-genoox/nettie-apps.git
   cd nettie-apps
   ```

2. Initialize all submodules:
   ```bash
   git submodule update --init --recursive
   ```

3. Set up each subproject as needed:
   ```bash
   # For curated-db
   cd apps/curated-db
   npm install
   
   # For panel-app
   cd ../panel-app
   npm install
   
   # For franklin-id
   cd ../../utilities/frontend/franklin-id
   npm install
   ```

4. Follow individual project READMEs for specific setup instructions and environment variables.

## Adding a New Repository

### Method 1: Git Submodules (Recommended)

1. Create your new repository on GitHub or your Git provider
2. Add it as a submodule to this repository in the appropriate directory:

   For a new application:
   ```bash
   git submodule add https://github.com/tom-genoox/new-app-name.git apps/new-app-name
   git commit -m "Add new-app-name as submodule"
   git push
   ```

   For a new frontend utility:
   ```bash
   git submodule add https://github.com/tom-genoox/new-utility.git utilities/frontend/new-utility
   git commit -m "Add new-utility as submodule"
   git push
   ```

   For a new backend utility:
   ```bash
   git submodule add https://github.com/tom-genoox/new-backend-util.git utilities/backend/new-backend-util
   git commit -m "Add new-backend-util as submodule"
   git push
   ```

### Method 2: Manual Addition

1. Create a new directory in the appropriate section of the repository:
   ```bash
   # For a new application
   mkdir -p apps/new-app-name
   cd apps/new-app-name
   
   # For a new frontend utility
   mkdir -p utilities/frontend/new-utility
   cd utilities/frontend/new-utility
   
   # For a new backend utility
   mkdir -p utilities/backend/new-backend-util
   cd utilities/backend/new-backend-util
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
   git commit -m "Add new project"
   git push
   ```

## Project Guidelines

- Each project should include its own README with setup instructions
- Follow consistent coding standards across projects
- Add a CONTRIBUTING.md file to each project for contribution guidelines
- See general-rules.mdc for additional project guidelines and standards

## Deployment

Each project should include its own deployment documentation in its README.
