#compdef nettie

_nettie_commands() {
  local -a commands
  commands=(
    'create:Generate new Nettie standalone apps and utilities'
    'update:Update Nettie CLI to the latest version'
    'fork:Fork a GitHub repository to your organization and add it as a submodule'
    'submodule:Manage Git submodules in the repository'
    'setup:Setup development environment (coming soon)'
  )
  _describe -t commands 'nettie commands' commands
}

_nettie_submodule_commands() {
  local -a subcommands
  subcommands=(
    'list:List all submodules in the repository'
    'update:Update all submodules or a specific submodule'
    'remove:Remove a submodule from the repository'
  )
  _describe -t subcommands 'submodule commands' subcommands
}

_nettie_project_types() {
  local -a types
  types=(
    'app:Standalone application'
    'frontend:Frontend utility'
    'backend:Backend utility'
  )
  _describe -t types 'project types' types
}

_nettie() {
  local curcontext="$curcontext" state line
  typeset -A opt_args

  _arguments -C \
    '1: :->command' \
    '*: :->args'

  case $state in
    command)
      _nettie_commands
      ;;
    args)
      case $line[1] in
        create)
          _nettie_project_types
          ;;
        fork)
          _arguments \
            '-u[GitHub repository URL]:url:' \
            '--url[GitHub repository URL]:url:' \
            '-t[Repository type]:type:->repo_type' \
            '--type[Repository type]:type:->repo_type'
          case $state in
            repo_type)
              _nettie_project_types
              ;;
          esac
          ;;
        submodule)
          _nettie_submodule_commands
          ;;
      esac
      ;;
  esac
}

_nettie "$@" 