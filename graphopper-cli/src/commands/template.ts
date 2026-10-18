import type { Command } from 'commander';

import type { Runtime } from '../runtime.js';
import { confirmDestructive } from '../safety/confirmation.js';
import { encode, graphId, inputObject, invocation } from './common.js';

export function registerTemplateCommands(
  program: Command,
  runtime: Runtime,
): void {
  const template = program
    .command('template')
    .description('Inspect and modify a graph node template.');
  template
    .command('show')
    .requiredOption('--graph <id>')
    .description('Show the complete ordered template.')
    .action(async (options: { graph: string }, command: Command) => {
      const context = await invocation(runtime, command);
      context.presenter.result(
        (
          await context.backend.request<unknown>(
            `graphs/${encode(options.graph)}/template`,
            { signal: context.signal },
          )
        ).data,
        context.format,
      );
    });
  const field = template
    .command('field')
    .description('Manage template fields.');
  field
    .command('add')
    .requiredOption('--graph <id>')
    .requiredOption('--key <key>')
    .requiredOption('--label <label>')
    .requiredOption('--type <type>')
    .option('--required')
    .option('--description <text>')
    .option('--default <json>')
    .option('--order <number>')
    .option('--rules <json>')
    .option('-i, --input <path>')
    .action(async (options: FieldOptions, command: Command) => {
      const context = await invocation(runtime, command);
      const body = await fieldBody(options, context);
      const response = await context.backend.request<unknown>(
        `graphs/${encode(graphId(options.graph, context))}/template/fields`,
        { body, idempotent: true, method: 'POST', signal: context.signal },
      );
      context.presenter.result(response.data, context.format);
    });
  field
    .command('update <fieldId>')
    .requiredOption('--graph <id>')
    .option('--key <key>')
    .option('--label <label>')
    .option('--type <type>')
    .option('--required <boolean>')
    .option('--description <text>')
    .option('--default <json>')
    .option('--order <number>')
    .option('--rules <json>')
    .option('--conversion <policy>')
    .option('--version <etag>')
    .option('-i, --input <path>')
    .description(
      'Update a field; type and required changes may migrate every node.',
    )
    .action(
      async (
        fieldId: string,
        options: FieldOptions & { conversion?: string; version?: string },
        command: Command,
      ) => {
        const context = await invocation(runtime, command);
        const body = {
          ...(await fieldBody(options, context)),
          ...(options.conversion
            ? { conversionPolicy: options.conversion }
            : {}),
        };
        context.presenter.info(
          'Impactful type or required-status changes may validate or migrate every node atomically.',
        );
        const response = await context.backend.request<unknown>(
          `graphs/${encode(graphId(options.graph, context))}/template/fields/${encode(fieldId)}`,
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
  field
    .command('delete <fieldId>')
    .requiredOption('--graph <id>')
    .option('--label <label>')
    .option('--key <key>')
    .option('--version <etag>')
    .description('Delete a field and its value from every node.')
    .action(
      async (
        fieldId: string,
        options: {
          graph: string;
          key?: string;
          label?: string;
          version?: string;
        },
        command: Command,
      ) => {
        const context = await invocation(runtime, command);
        await confirmDestructive({
          action: 'Delete template field',
          target:
            `${options.label ?? options.key ?? ''} [${fieldId}] in graph [${options.graph}]`.trim(),
          effects: 'This removes the field value from every node in the graph.',
          interactive: context.interactive,
          stdin: context.stdin,
          stderr: context.stderr,
          yes: context.global.yes === true,
        });
        await context.backend.request(
          `graphs/${encode(options.graph)}/template/fields/${encode(fieldId)}`,
          {
            body: { destructiveConfirmation: true },
            method: 'DELETE',
            signal: context.signal,
            version: options.version,
          },
        );
        context.presenter.result(
          { deleted: true, id: fieldId },
          context.format,
        );
      },
    );
}

interface FieldOptions {
  readonly default?: string;
  readonly description?: string;
  readonly graph?: string;
  readonly input?: string;
  readonly key?: string;
  readonly label?: string;
  readonly order?: string;
  readonly required?: boolean | string;
  readonly rules?: string;
  readonly type?: string;
}
async function fieldBody(
  options: FieldOptions,
  context: Awaited<ReturnType<typeof invocation>>,
): Promise<Record<string, unknown>> {
  return inputObject(
    options.input,
    {
      key: options.key,
      label: options.label,
      dataType: options.type,
      required:
        typeof options.required === 'string'
          ? options.required === 'true'
          : options.required,
      description: options.description,
      defaultValue: parseJson(options.default),
      displayOrder:
        options.order === undefined ? undefined : Number(options.order),
      validationRules: parseJson(options.rules),
    },
    [
      'key',
      'label',
      'dataType',
      'required',
      'description',
      'defaultValue',
      'displayOrder',
      'validationRules',
    ],
    context,
  );
}
function parseJson(value: string | undefined): unknown {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}
