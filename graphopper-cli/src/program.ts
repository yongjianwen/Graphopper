import { Command, CommanderError, InvalidArgumentError } from 'commander';

import { registerAuthCommands } from './commands/auth.js';
import { registerCompletionCommand } from './commands/completion.js';
import { registerConfigCommands } from './commands/config.js';
import { registerGraphCommands } from './commands/graph.js';
import { registerNodeCommands } from './commands/node.js';
import { registerRelationshipCommands } from './commands/relationship.js';
import { registerTemplateCommands } from './commands/template.js';
import { registerTraversalCommand } from './commands/traverse.js';
import { CliError, exitCodes, toCliError } from './core/errors.js';
import { Presenter } from './presentation/presenter.js';
import { Runtime, type RuntimeOptions } from './runtime.js';
import { cliVersion } from './version.js';

export function createProgram(runtime: Runtime): Command {
  const program = new Command();
  program
    .name('graphopper')
    .description('Manage and inspect graph data through graphopper-backend.')
    .version(cliVersion, '-V, --version', 'Print the CLI version.')
    .showHelpAfterError()
    .showSuggestionAfterError()
    .exitOverride()
    .configureOutput({
      writeOut: (value) => runtime.stdout.write(value),
      writeErr: (value) => runtime.stderr.write(value),
    });
  program
    .option('--profile <name>', 'Select a configuration profile')
    .option('--server <url>', 'Override the backend URL for this command')
    .option('--output <format>', 'detail, table, json, or id')
    .option('--timeout <milliseconds>', 'Request timeout')
    .option('--no-color', 'Disable ANSI color')
    .option('--quiet', 'Suppress non-result informational output')
    .option('--verbose', 'Write safe diagnostics to standard error')
    .option('--yes', 'Bypass destructive confirmation explicitly')
    .option('--non-interactive', 'Prohibit prompts and browser assumptions')
    .option(
      '--json-errors',
      'Write a stable JSON error envelope to standard error',
    );
  registerAuthCommands(program, runtime);
  registerConfigCommands(program, runtime);
  registerGraphCommands(program, runtime);
  registerTemplateCommands(program, runtime);
  registerNodeCommands(program, runtime);
  registerRelationshipCommands(program, runtime);
  registerTraversalCommand(program, runtime);
  registerCompletionCommand(program, runtime);
  program
    .command('version')
    .description('Print the CLI version without network access.')
    .action(() => {
      runtime.stdout.write(`${cliVersion}\n`);
    });
  return program;
}

export async function executeCli(
  argv: readonly string[],
  options: RuntimeOptions = {},
): Promise<number> {
  const runtime = new Runtime(options);
  const program = createProgram(runtime);
  try {
    await program.parseAsync([...argv], { from: 'user' });
    return exitCodes.success;
  } catch (error: unknown) {
    if (error instanceof CommanderError) {
      if (error.exitCode === 0) return 0;
      const cliError = new CliError(error.message.replace(/^error:\s*/u, ''), {
        category: 'usage',
        code: 'USAGE_ERROR',
        cause: error,
      });
      new Presenter({ stdout: runtime.stdout, stderr: runtime.stderr }).error(
        cliError,
        program.opts<{ jsonErrors?: boolean }>().jsonErrors === true,
      );
      return exitCodes.usage;
    }
    if (error instanceof InvalidArgumentError) return exitCodes.usage;
    const cliError = toCliError(error);
    const opts = program.opts<{
      jsonErrors?: boolean;
      quiet?: boolean;
      verbose?: boolean;
    }>();
    new Presenter({
      stdout: runtime.stdout,
      stderr: runtime.stderr,
      quiet: opts.quiet,
      verbose: opts.verbose,
    }).error(cliError, opts.jsonErrors === true);
    return exitCodes[cliError.category];
  }
}
