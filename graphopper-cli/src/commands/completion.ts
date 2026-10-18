import type { Command } from 'commander';

import { CliError } from '../core/errors.js';
import type { Runtime } from '../runtime.js';
import { invocation } from './common.js';

const commands =
  'auth config graph template node relationship traverse completion version';

export function registerCompletionCommand(
  program: Command,
  runtime: Runtime,
): void {
  program
    .command('completion <shell>')
    .description('Generate a static completion script for bash, zsh, or fish.')
    .action(async (shell: string, _options, command: Command) => {
      const context = await invocation(runtime, command);
      const script = completion(shell);
      context.stdout.write(script);
    });
}

function completion(shell: string): string {
  if (shell === 'bash')
    return `# graphopper bash completion\n_graphopper() { COMPREPLY=( $(compgen -W "${commands}" -- "\${COMP_WORDS[1]}") ); }\ncomplete -F _graphopper graphopper\n`;
  if (shell === 'zsh')
    return `#compdef graphopper\n_arguments '1:command:(${commands})' '*::arg:->args'\n`;
  if (shell === 'fish')
    return (
      commands
        .split(' ')
        .map(
          (command) =>
            `complete -c graphopper -f -n '__fish_use_subcommand' -a '${command}'`,
        )
        .join('\n') + '\n'
    );
  throw new CliError(
    `Unsupported shell '${shell}'; expected bash, zsh, or fish.`,
    { category: 'usage', code: 'SHELL_UNSUPPORTED' },
  );
}
