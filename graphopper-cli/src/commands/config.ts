import type { Command } from 'commander';

import { CliError } from '../core/errors.js';
import type { Profile } from '../configuration/types.js';
import type { Runtime } from '../runtime.js';
import { globalOptions, invocation } from './common.js';

export function registerConfigCommands(
  program: Command,
  runtime: Runtime,
): void {
  const config = program
    .command('config')
    .description('Manage non-secret configuration profiles.');

  config
    .command('get')
    .description('Show effective non-secret configuration and value sources.')
    .action(async (_options, command: Command) => {
      const context = await invocation(runtime, command);
      context.presenter.result(
        {
          profile: context.config.profileName,
          server: context.config.server,
          expectedApiVersion: context.config.expectedApiVersion,
          output: context.config.output,
          timeoutMs: context.config.timeoutMs,
          defaultGraph: context.config.defaultGraph ?? null,
          oidcIssuer: context.config.oidcIssuer ?? null,
          oidcClientId: context.config.oidcClientId ?? null,
          oidcScopes: context.config.oidcScopes,
          sources: context.config.sources,
        },
        context.format,
      );
    });

  config
    .command('set <key> <value>')
    .description('Set one value in a named profile.')
    .option('--profile <name>', 'Profile to update')
    .action(
      async (
        key: string,
        value: string,
        options: { profile?: string },
        command: Command,
      ) => {
        const file = await runtime.configStore.load();
        const name =
          options.profile ??
          globalOptions(command).profile ??
          file.activeProfile;
        const patch = configPatch(key, value);
        await runtime.configStore.setProfile(name, patch);
        const context = await invocation(runtime, command);
        context.presenter.result(
          { profile: name, updated: key },
          context.format,
        );
      },
    );

  config
    .command('list-profiles')
    .description('List configuration profiles.')
    .action(async (_options, command: Command) => {
      const file = await runtime.configStore.load();
      const context = await invocation(runtime, command);
      context.presenter.result(
        Object.keys(file.profiles)
          .sort()
          .map((name) => ({ name, active: name === file.activeProfile })),
        context.format === 'detail' ? 'table' : context.format,
      );
    });

  config
    .command('use-profile <name>')
    .description('Select the default profile.')
    .action(async (name: string, _options, command: Command) => {
      await runtime.configStore.useProfile(name);
      const context = await invocation(runtime, command);
      context.presenter.result({ profile: name, active: true }, context.format);
    });

  config
    .command('check')
    .description(
      'Check configuration, connectivity, API compatibility, and authentication separately.',
    )
    .action(async (_options, command: Command) => {
      const context = await invocation(runtime, command);
      const result: Record<string, unknown> = {
        configuration: 'ok',
        server: context.config.server,
        expectedApiVersion: context.config.expectedApiVersion,
      };
      try {
        const me = await context.backend.request<unknown>('me', {
          signal: context.signal,
        });
        result.connectivity = 'ok';
        result.compatibility = 'ok';
        result.authentication = 'ok';
        result.user = me.data;
      } catch (error: unknown) {
        if (error instanceof CliError && error.category === 'authentication') {
          result.connectivity = 'ok';
          result.compatibility = 'ok';
          result.authentication = 'required';
        } else throw error;
      }
      context.presenter.result(result, context.format);
    });
}

function configPatch(key: string, value: string): Partial<Profile> {
  switch (key) {
    case 'server':
      return { server: value };
    case 'expectedApiVersion':
      return { expectedApiVersion: value };
    case 'output':
      if (
        value !== 'detail' &&
        value !== 'table' &&
        value !== 'json' &&
        value !== 'id'
      )
        break;
      else return { output: value };
    case 'timeoutMs': {
      const timeoutMs = Number(value);
      if (Number.isSafeInteger(timeoutMs)) return { timeoutMs };
      break;
    }
    case 'defaultGraph':
      return { defaultGraph: value };
    case 'oidcIssuer':
      return { oidcIssuer: value };
    case 'oidcClientId':
      return { oidcClientId: value };
    case 'oidcScopes':
      return { oidcScopes: value.split(/[ ,]+/u).filter(Boolean) };
  }
  throw new CliError(`Unsupported or invalid configuration key '${key}'.`, {
    category: 'usage',
    code: 'CONFIGURATION_VALUE_INVALID',
  });
}
