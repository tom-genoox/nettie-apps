import { execSync } from 'child_process';
import chalk from 'chalk';

interface ToolCheck {
  name: string;
  command: string;
  versionCommand: string;
  versionCheck?: (version: string) => boolean;
  installGuide: string;
}

const tools: ToolCheck[] = [
  {
    name: 'Supabase CLI',
    command: 'supabase',
    versionCommand: 'supabase --version',
    installGuide: 'Install Supabase CLI using: brew install supabase/tap/supabase'
  },
  {
    name: 'Bun',
    command: 'bun',
    versionCommand: 'bun --version',
    installGuide: 'Install Bun using: curl -fsSL https://bun.sh/install | bash'
  },
  {
    name: 'Zsh',
    command: 'zsh',
    versionCommand: 'zsh --version',
    installGuide: 'Zsh should be installed by default on macOS. If not, install using: brew install zsh'
  },
  {
    name: 'Node.js',
    command: 'node',
    versionCommand: 'node --version',
    versionCheck: (version: string) => {
      const majorVersion = parseInt(version.slice(1).split('.')[0]);
      return majorVersion >= 20;
    },
    installGuide: 'Install Node.js (v20 or later) using: brew install node@20'
  },
  {
    name: 'Docker',
    command: 'docker',
    versionCommand: 'docker --version',
    versionCheck: (version: string) => {
      // Example version string: "Docker version 24.0.7, build afdd53b"
      const match = version.match(/Docker version (\d+)\.(\d+)\./);
      if (!match) return false;
      const [, major, minor] = match;
      // Require Docker version 20.10 or higher
      return parseInt(major) > 20 || (parseInt(major) === 20 && parseInt(minor) >= 10);
    },
    installGuide: 'Install Docker Desktop from https://www.docker.com/products/docker-desktop'
  }
];

function checkCommand(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getVersion(command: string): string {
  try {
    return execSync(command).toString().trim();
  } catch {
    return '';
  }
}

function checkZshCompletions(): boolean {
  try {
    const zshrc = execSync('cat ~/.zshrc').toString();
    const hasCompletionPath = zshrc.includes('fpath=(~/.zsh/completion ${fpath[@]})') ||
                             zshrc.includes('fpath=(~/.zsh/completion $fpath)');
    
    if (hasCompletionPath) return true;
    
    if (zshrc.includes('compinit')) {
      try {
        execSync('test -f ~/.zsh/completion/_nettie', { stdio: 'ignore' });
        return true;
      } catch {
        try {
          execSync('test -f /usr/local/share/zsh/site-functions/_nettie', { stdio: 'ignore' });
          return true;
        } catch {
          return false;
        }
      }
    }
    
    return false;
  } catch {
    return false;
  }
}

export async function doctorCommand() {
  console.log(chalk.blue('\nChecking required tools...\n'));
  let allPassed = true;

  for (const tool of tools) {
    process.stdout.write(`Checking ${tool.name}... `);
    
    const isInstalled = checkCommand(tool.command);
    if (!isInstalled) {
      console.log(chalk.red('❌ Not installed'));
      console.log(chalk.yellow(`Installation guide: ${tool.installGuide}\n`));
      allPassed = false;
      continue;
    }

    const version = getVersion(tool.versionCommand);
    
    if (tool.versionCheck && !tool.versionCheck(version)) {
      console.log(chalk.red(`❌ Version requirement not met (current: ${version})`));
      console.log(chalk.yellow(`Please upgrade using: ${tool.installGuide}\n`));
      allPassed = false;
      continue;
    }

    console.log(chalk.green(`✅ Found ${version}`));

    // Additional check for Zsh completions
    if (tool.name === 'Zsh') {
      process.stdout.write('Checking Zsh completions... ');
      const hasCompletions = checkZshCompletions();
      if (hasCompletions) {
        console.log(chalk.green('✅ Configured'));
      } else {
        console.log(chalk.red('❌ Not configured'));
        console.log(chalk.yellow('Add the following to your ~/.zshrc:\nfpath=($fpath "/usr/local/share/zsh/site-functions")\nautoload -Uz compinit && compinit\n'));
        allPassed = false;
      }
    }
  }

  if (allPassed) {
    console.log(chalk.green('\n✨ All tools are properly installed and configured!\n'));
  } else {
    console.log(chalk.yellow('\n⚠️  Some tools need attention. Please follow the installation guides above.\n'));
    process.exit(1);
  }
} 