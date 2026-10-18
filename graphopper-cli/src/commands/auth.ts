import type { Command } from 'commander';

import { CliError } from '../core/errors.js';
import type { Runtime } from '../runtime.js';
import { invocation } from './common.js';

export function registerAuthCommands(program: Command, runtime: Runtime): void {
  const auth = program
    .command('auth')
    .description('Authenticate and manage the local credential.');

  auth
    .command('login')
    .description(
      'Authenticate with OIDC device authorization or a protected standard-input token.',
    )
    .option('--no-browser', 'Do not launch a browser')
    .option('--token-stdin', 'Read an external token from standard input')
    .option(
      '--store-external',
      'Persist the standard-input token in the OS credential store',
    )
    .action(
      async (
        options: {
          browser: boolean;
          storeExternal?: boolean;
          tokenStdin?: boolean;
        },
        command: Command,
      ) => {
        const context = await invocation(runtime, command);
        if (options.tokenStdin) {
          const token = await readAll(context.stdin);
          if (options.storeExternal)
            await context.auth.storeExternalToken(token);
          else
            throw new CliError(
              'A process-only token should be supplied through GRAPHOPPER_TOKEN; use --store-external to persist standard input.',
              { category: 'usage', code: 'EXTERNAL_TOKEN_NOT_STORED' },
            );
          context.presenter.result(
            { authenticated: true, stored: true },
            context.format,
          );
          return;
        }
        if (!context.interactive)
          throw new CliError(
            'Interactive login requires a terminal; automation should use GRAPHOPPER_TOKEN.',
            { category: 'authentication', code: 'INTERACTIVE_LOGIN_REQUIRED' },
          );
        await context.auth.login({
          browser: options.browser,
          signal: context.signal,
        });
        context.presenter.result(
          { authenticated: true, profile: context.config.profileName },
          context.format,
        );
      },
    );

  auth
    .command('status')
    .description(
      'Show the current backend identity without exposing credentials.',
    )
    .action(async (_options, command: Command) => {
      const context = await invocation(runtime, command);
      context.presenter.result(
        {
          profile: context.config.profileName,
          user: await context.auth.status(context.backend),
        },
        context.format,
      );
    });

  auth
    .command('logout')
    .description(
      'Remove the local credential and optionally revoke it remotely.',
    )
    .option('--revoke', 'Request provider revocation when supported')
    .action(async (options: { revoke?: boolean }, command: Command) => {
      const context = await invocation(runtime, command);
      context.presenter.result(
        await context.auth.logout(options.revoke === true),
        context.format,
      );
    });
}

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  return Buffer.concat(chunks).toString('utf8').trim();
}
