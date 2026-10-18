import type { Command } from 'commander';

import type { Runtime } from '../runtime.js';
import { confirmDestructive } from '../safety/confirmation.js';
import { encode, fetchAll, inputObject, invocation } from './common.js';

export function registerRelationshipCommands(
  program: Command,
  runtime: Runtime,
): void {
  const relationship = program
    .command('relationship')
    .description('Manage directed graph relationships.');
  relationship
    .command('create')
    .requiredOption('--graph <id>')
    .requiredOption('--source <nodeId>')
    .requiredOption('--target <nodeId>')
    .requiredOption('--type <type>')
    .option('--label <label>')
    .option('--id-only')
    .action(
      async (
        options: RelationshipOptions & { idOnly?: boolean },
        command: Command,
      ) => {
        const context = await invocation(runtime, command);
        const body = {
          sourceNodeId: options.source,
          targetNodeId: options.target,
          type: options.type,
          label: options.label,
        };
        const data = (
          await context.backend.request<unknown>(
            `graphs/${encode(options.graph)}/relationships`,
            { body, idempotent: true, method: 'POST', signal: context.signal },
          )
        ).data;
        context.presenter.result(data, options.idOnly ? 'id' : context.format);
      },
    );
  relationship
    .command('list')
    .requiredOption('--graph <id>')
    .option('--source <nodeId>')
    .option('--target <nodeId>')
    .option('--type <type>')
    .option('--cursor <cursor>')
    .option('--limit <number>')
    .option('--all')
    .action(
      async (
        options: RelationshipOptions & {
          all?: boolean;
          cursor?: string;
          limit?: string;
        },
        command: Command,
      ) => {
        const context = await invocation(runtime, command);
        const path = `graphs/${encode(options.graph)}/relationships`;
        const query = {
          sourceNodeId: options.source,
          targetNodeId: options.target,
          type: options.type,
          cursor: options.cursor,
          limit: options.limit,
        };
        const data = options.all
          ? await fetchAll(context.backend, path, {
              query,
              signal: context.signal,
            })
          : (
              await context.backend.request<unknown>(path, {
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
  relationship
    .command('show <relationshipId>')
    .requiredOption('--graph <id>')
    .action(
      async (id: string, options: { graph: string }, command: Command) => {
        const context = await invocation(runtime, command);
        context.presenter.result(
          (
            await context.backend.request<unknown>(
              `graphs/${encode(options.graph)}/relationships/${encode(id)}`,
              { signal: context.signal },
            )
          ).data,
          context.format,
        );
      },
    );
  relationship
    .command('update <relationshipId>')
    .requiredOption('--graph <id>')
    .option('--type <type>')
    .option('--label <label>')
    .option('--clear-label')
    .option('--version <etag>')
    .option('-i, --input <path>')
    .action(
      async (
        id: string,
        options: RelationshipOptions & {
          clearLabel?: boolean;
          input?: string;
          version?: string;
        },
        command: Command,
      ) => {
        const context = await invocation(runtime, command);
        const body = await inputObject(
          options.input,
          {
            type: options.type,
            label: options.clearLabel ? null : options.label,
          },
          ['type', 'label'],
          context,
        );
        const data = (
          await context.backend.request<unknown>(
            `graphs/${encode(options.graph)}/relationships/${encode(id)}`,
            {
              body,
              method: 'PATCH',
              signal: context.signal,
              version: options.version,
            },
          )
        ).data;
        context.presenter.result(data, context.format);
      },
    );
  relationship
    .command('delete <relationshipId>')
    .requiredOption('--graph <id>')
    .option('--source <nodeId>')
    .option('--target <nodeId>')
    .option('--type <type>')
    .action(
      async (id: string, options: RelationshipOptions, command: Command) => {
        const context = await invocation(runtime, command);
        const edge =
          options.source && options.target
            ? `${options.source} --${options.type ?? 'RELATIONSHIP'}--> ${options.target}`
            : `[${id}]`;
        await confirmDestructive({
          action: 'Delete relationship',
          target: edge,
          effects: 'The directed edge will be permanently removed.',
          interactive: context.interactive,
          stdin: context.stdin,
          stderr: context.stderr,
          yes: context.global.yes === true,
        });
        await context.backend.request(
          `graphs/${encode(options.graph)}/relationships/${encode(id)}`,
          { method: 'DELETE', signal: context.signal },
        );
        context.presenter.result({ deleted: true, id }, context.format);
      },
    );
}
interface RelationshipOptions {
  readonly graph: string;
  readonly label?: string;
  readonly source?: string;
  readonly target?: string;
  readonly type?: string;
}
