import type { Command } from 'commander';

import type { Runtime } from '../runtime.js';
import { confirmDestructive } from '../safety/confirmation.js';
import { encode, fetchAll, inputObject, invocation } from './common.js';

export function registerGraphCommands(
  program: Command,
  runtime: Runtime,
): void {
  const graph = program
    .command('graph')
    .description('Create, inspect, update, and delete graphs.');

  graph
    .command('create')
    .description('Create a graph, optionally with initial template fields.')
    .argument('[name]', 'Graph name')
    .option('-d, --description <text>', 'Description')
    .option('-i, --input <path>', 'Structured JSON input file or - for stdin')
    .option('--id-only', 'Output only the created identifier')
    .action(
      async (
        name: string | undefined,
        options: { description?: string; idOnly?: boolean; input?: string },
        command: Command,
      ) => {
        const context = await invocation(runtime, command);
        const body = await inputObject(
          options.input,
          { name, description: options.description },
          ['name', 'description', 'templateFields'],
          context,
        );
        const response = await context.backend.request<unknown>('graphs', {
          body,
          idempotent: true,
          method: 'POST',
          signal: context.signal,
        });
        context.presenter.result(
          response.data,
          options.idOnly ? 'id' : context.format,
        );
      },
    );

  graph
    .command('list')
    .description('List owned graphs with cursor pagination.')
    .option('--cursor <cursor>', 'Opaque continuation cursor')
    .option('--limit <number>', 'Page size')
    .option('--sort <field>', 'Supported sort field')
    .option('--all', 'Fetch all pages up to the client safety limit')
    .action(
      async (
        options: {
          all?: boolean;
          cursor?: string;
          limit?: string;
          sort?: string;
        },
        command: Command,
      ) => {
        const context = await invocation(runtime, command);
        const query = {
          cursor: options.cursor,
          limit: options.limit,
          sort: options.sort,
        };
        const data = options.all
          ? await fetchAll(context.backend, 'graphs', {
              query,
              signal: context.signal,
            })
          : (
              await context.backend.request<unknown>('graphs', {
                query,
                signal: context.signal,
              })
            ).data;
        context.presenter.result(
          data,
          context.format === 'detail' ? 'table' : context.format,
        );
      },
    );

  graph
    .command('show <graphId>')
    .description('Show graph metadata and template summary.')
    .action(async (graphId: string, _options, command: Command) => {
      const context = await invocation(runtime, command);
      context.presenter.result(
        (
          await context.backend.request<unknown>(`graphs/${encode(graphId)}`, {
            signal: context.signal,
          })
        ).data,
        context.format,
      );
    });

  graph
    .command('data <graphId>')
    .description(
      'Retrieve bounded graph data and preserve truncation metadata.',
    )
    .option('--cursor <cursor>')
    .action(
      async (
        graphId: string,
        options: { cursor?: string },
        command: Command,
      ) => {
        const context = await invocation(runtime, command);
        const data = (
          await context.backend.request<unknown>(
            `graphs/${encode(graphId)}/data`,
            { query: { cursor: options.cursor }, signal: context.signal },
          )
        ).data;
        context.presenter.result(data, context.format);
      },
    );

  graph
    .command('update <graphId>')
    .description('Patch explicitly supplied graph metadata.')
    .option('-n, --name <name>')
    .option('-d, --description <text>')
    .option('--clear-description')
    .option('--version <etag>', 'Known ETag/version for If-Match')
    .option('-i, --input <path>')
    .action(
      async (
        graphId: string,
        options: {
          clearDescription?: boolean;
          description?: string;
          input?: string;
          name?: string;
          version?: string;
        },
        command: Command,
      ) => {
        const context = await invocation(runtime, command);
        const body = await inputObject(
          options.input,
          {
            name: options.name,
            description: options.clearDescription ? null : options.description,
          },
          ['name', 'description'],
          context,
        );
        const response = await context.backend.request<unknown>(
          `graphs/${encode(graphId)}`,
          {
            body,
            method: 'PATCH',
            signal: context.signal,
            version: options.version,
          },
        );
        context.presenter.result(response.data, context.format);
      },
    );

  graph
    .command('delete <graphId>')
    .description('Permanently delete a graph and all graph-owned data.')
    .option('--name <name>', 'Known graph name for confirmation')
    .action(
      async (graphId: string, options: { name?: string }, command: Command) => {
        const context = await invocation(runtime, command);
        await confirmDestructive({
          action: 'Delete graph',
          target: `${options.name ?? ''} [${graphId}]`.trim(),
          effects:
            'Its template, fields, nodes, relationships, values, and managed file references will be removed.',
          interactive: context.interactive,
          stdin: context.stdin,
          stderr: context.stderr,
          yes: context.global.yes === true,
        });
        await context.backend.request(`graphs/${encode(graphId)}`, {
          method: 'DELETE',
          signal: context.signal,
        });
        context.presenter.result(
          { deleted: true, id: graphId },
          context.format,
        );
      },
    );
}
