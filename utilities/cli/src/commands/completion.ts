import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { execSync } from 'child_process';

/**
 * Generate shell completion script for the CLI
 */
export async function generateCompletion(): Promise<void> {
  try {
    console.log(chalk.blue('Generating shell completion script...'));

    // Create completions directory if it doesn't exist
    const completionsDir = path.join(os.homedir(), '.zsh/completion');
    await fs.mkdir(completionsDir, { recursive: true });

    // Generate the completion script content
    const completionScript = `#compdef nettie

_nettie() {
  local -a commands submodule_commands
  
  commands=(
    'create:Create a new Nettie app or utility'
    'update:Update Nettie CLI to the latest version'
    'fork:Fork a GitHub repository to your organization and add it as a submodule'
    'submodule:Manage Git submodules in the repository'
    'completion:Generate shell completion script'
    'clone:Clone a repository and add it as a submodule'
    'doctor:Check if all required tools are installed and properly configured'
  )

  submodule_commands=(
    'list:List all submodules in the repository with their repository URLs'
    'update:Update all submodules or a specific submodule'
    'remove:Remove a submodule from the repository'
  )

  local curcontext="$curcontext" state line
  typeset -A opt_args

  # Function to get git root directory
  function _git_root() {
    local git_root
    git_root=\$(git rev-parse --show-toplevel 2>/dev/null)
    echo \$git_root
  }

  # Function to get submodules from root
  function _get_submodules() {
    local git_root=\$(_git_root)
    if [[ -n "\$git_root" ]]; then
      cd "\$git_root"
      # Parse nettie submodule list output to get just the paths (after "📁 " prefix)
      nettie submodule list 2>/dev/null | grep "^📁" | sed 's/^📁 //'
      cd - >/dev/null
    fi
  }

  _arguments -C \\
    "1: :{_describe 'nettie command' commands}" \\
    "*::arg:->args"

  case $state in
    args)
      case $line[1] in
        submodule)
          if (( CURRENT == 2 )); then
            _describe 'submodule command' submodule_commands
          elif (( CURRENT == 3 )); then
            case $line[2] in
              remove|update)
                local -a submodules
                submodules=(\$(_get_submodules))
                _describe 'submodule path' submodules
                ;;
            esac
          fi
          ;;
        fork)
          _arguments \\
            '-u[GitHub repository URL]:url' \\
            '--url[GitHub repository URL]:url' \\
            '-t[Repository type]:type:(app frontend backend)' \\
            '--type[Repository type]:type:(app frontend backend)'
          ;;
        clone)
          _arguments "1:GitHub repository URL"
          ;;
      esac
      ;;
  esac
}

compdef _nettie nettie`;

    // Write the completion script
    const completionFile = path.join(completionsDir, '_nettie');
    await fs.writeFile(completionFile, completionScript);
    console.log(chalk.green('✅ Generated completion script'));

    // Read current .zshrc content
    const zshrcPath = path.join(os.homedir(), '.zshrc');
    let zshrcContent = '';
    try {
      zshrcContent = await fs.readFile(zshrcPath, 'utf8');
    } catch {
      // File doesn't exist, will create it
    }

    // Add completion configuration if not already present
    const completionConfig = `
# Nettie CLI completions
fpath=(~/.zsh/completion \${fpath[@]})
`;

    if (!zshrcContent.includes('Nettie CLI completions')) {
      await fs.appendFile(zshrcPath, completionConfig);
      console.log(chalk.blue('Added Zsh completion configuration to ~/.zshrc'));
    }

    // Create a temporary script to reload completions
    const reloadScript = `
#!/usr/bin/env zsh
autoload -Uz compinit
compinit -u
unfunction _nettie 2>/dev/null || true
autoload -Uz _nettie
`;
    const tempScriptPath = path.join(os.tmpdir(), 'reload_nettie_completions.zsh');
    await fs.writeFile(tempScriptPath, reloadScript, { mode: 0o755 });

    // Execute the reload script in Zsh
    try {
      execSync(`zsh "${tempScriptPath}"`, { stdio: 'inherit' });
    } catch (error) {
      console.log(chalk.yellow('Note: Could not reload completions automatically. Please run:\n  source ~/.zshrc\n  compinit -u'));
    } finally {
      // Clean up temp script
      await fs.unlink(tempScriptPath).catch(() => {});
    }

    console.log(chalk.green.bold('\n✅ Shell completion installed successfully!'));
    console.log(chalk.yellow('\nPlease run the following commands to enable completions:'));
    console.log(chalk.yellow('  source ~/.zshrc'));
    console.log(chalk.yellow('  compinit -u\n'));
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to generate completion script: ${error instanceof Error ? error.message : 'unknown error'}`));
    process.exit(1);
  }
} 