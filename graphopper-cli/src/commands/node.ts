import { createReadStream } from 'node:fs';
import { basename, extname } from 'node:path';
import { createInterface } from 'node:readline/promises';
import type { Command } from 'commander';

import { CliError } from '../core/errors.js';
import {
  parseAssignments,
  validateLocalFile,
} from '../input/structured-input.js';
import type { Invocation, Runtime } from '../runtime.js';
import { confirmDestructive } from '../safety/confirmation.js';
import {
  collect,
  encode,
  fetchAll,
  graphId,
  inputObject,
  invocation,
} from './common.js';

export function registerNodeCommands(program: Command, runtime: Runtime): void {
  const node = program
    .command('node')
    .description('Create and manage template-conforming nodes.');

  addValueOptions(
    node
      .command('create')
      .requiredOption('--graph <id>')
      .description(
        'Create a node from assignments, structured JSON, or interactive template prompts.',
      ),
  )
    .option('--id-only')
    .action(
      async (
        options: NodeInputOptions & { idOnly?: boolean },
        command: Command,
      ) => {
        const context = await invocation(runtime, command);
        const graph = graphId(options.graph, context);
        const values = await nodeValues(graph, options, context, true);
        const response = await context.backend.request<unknown>(
          `graphs/${encode(graph)}/nodes`,
          {
            body: { values },
            idempotent: true,
            method: 'POST',
            signal: context.signal,
          },
        );
        context.presenter.result(
          response.data,
          options.idOnly ? 'id' : context.format,
        );
      },
    );

  node
    .command('list')
    .requiredOption('--graph <id>')
    .option('--cursor <cursor>')
    .option('--limit <number>')
    .option('--sort <field>')
    .option(
      '--filter <filter>',
      'Backend-supported structured filter',
      collect,
      [],
    )
    .option('--search <text>')
    .option('--all')
    .description('List, filter, search, and sort nodes.')
    .action(async (options: ListOptions, command: Command) => {
      const context = await invocation(runtime, command);
      const path = `graphs/${encode(options.graph)}/nodes`;
      const query = {
        cursor: options.cursor,
        limit: options.limit,
        sort: options.sort,
        filter: options.filter,
        search: options.search,
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
    });

  node
    .command('show <nodeId>')
    .requiredOption('--graph <id>')
    .description('Show one node and its template-defined values.')
    .action(
      async (nodeId: string, options: { graph: string }, command: Command) => {
        const context = await invocation(runtime, command);
        context.presenter.result(
          (
            await context.backend.request<unknown>(
              `graphs/${encode(options.graph)}/nodes/${encode(nodeId)}`,
              { signal: context.signal },
            )
          ).data,
          context.format,
        );
      },
    );

  addValueOptions(
    node
      .command('update <nodeId>')
      .requiredOption('--graph <id>')
      .option('--version <etag>')
      .description(
        'Patch explicitly supplied values; --clear removes an optional value.',
      ),
  ).action(
    async (
      nodeId: string,
      options: NodeInputOptions & { version?: string },
      command: Command,
    ) => {
      const context = await invocation(runtime, command);
      const values = await nodeValues(options.graph!, options, context, false);
      const response = await context.backend.request<unknown>(
        `graphs/${encode(options.graph!)}/nodes/${encode(nodeId)}`,
        {
          body: { values },
          method: 'PATCH',
          signal: context.signal,
          version: options.version,
        },
      );
      context.presenter.result(response.data, context.format);
    },
  );

  node
    .command('delete <nodeId>')
    .requiredOption('--graph <id>')
    .option('--name <value>')
    .description('Delete a node and all connected relationships.')
    .action(
      async (
        nodeId: string,
        options: { graph: string; name?: string },
        command: Command,
      ) => {
        const context = await invocation(runtime, command);
        await confirmDestructive({
          action: 'Delete node',
          target: `${options.name ?? ''} [${nodeId}]`.trim(),
          effects:
            'Every incoming and outgoing relationship will also be deleted.',
          interactive: context.interactive,
          stdin: context.stdin,
          stderr: context.stderr,
          yes: context.global.yes === true,
        });
        await context.backend.request(
          `graphs/${encode(options.graph)}/nodes/${encode(nodeId)}`,
          { method: 'DELETE', signal: context.signal },
        );
        context.presenter.result({ deleted: true, id: nodeId }, context.format);
      },
    );
}

interface NodeInputOptions {
  readonly clear?: string[];
  readonly file?: string[];
  readonly graph?: string;
  readonly input?: string;
  readonly value?: string[];
}
interface ListOptions {
  readonly all?: boolean;
  readonly cursor?: string;
  readonly filter?: string[];
  readonly graph: string;
  readonly limit?: string;
  readonly search?: string;
  readonly sort?: string;
}
function addValueOptions(command: Command): Command {
  return command
    .option(
      '--value <field=value>',
      'Set one field value; JSON scalars are accepted',
      collect,
      [],
    )
    .option('--clear <field>', 'Remove one optional value', collect, [])
    .option(
      '--file <field=path>',
      'Upload a local file and assign its finalized ID',
      collect,
      [],
    )
    .option('-i, --input <path>', 'Structured JSON input file or - for stdin');
}

async function nodeValues(
  graph: string,
  options: NodeInputOptions,
  context: Invocation,
  allowPrompt: boolean,
): Promise<Record<string, unknown>> {
  const structured = await inputObject(options.input, {}, ['values'], context);
  const base =
    typeof structured.values === 'object' &&
    structured.values !== null &&
    !Array.isArray(structured.values)
      ? (structured.values as Record<string, unknown>)
      : {};
  const assigned = parseAssignments(options.value, options.clear);
  const template = await loadTemplate(graph, context);
  let values = resolveKeys({ ...base, ...assigned }, template.fields);
  if (allowPrompt && context.interactive && Object.keys(values).length === 0)
    values = await promptValues(template.fields, context);
  const fileValues = await uploadFiles(
    graph,
    options.file ?? [],
    template.fields,
    context,
  );
  return { ...values, ...fileValues };
}

interface Field {
  readonly id: string;
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly defaultValue?: unknown;
  readonly dataType?: string;
}
async function loadTemplate(
  graph: string,
  context: Invocation,
): Promise<{ fields: Field[] }> {
  const data = (
    await context.backend.request<unknown>(`graphs/${encode(graph)}/template`, {
      signal: context.signal,
    })
  ).data;
  if (
    typeof data !== 'object' ||
    data === null ||
    !('fields' in data) ||
    !Array.isArray(data.fields)
  )
    throw new CliError('The backend returned an incompatible template.', {
      category: 'internal',
      code: 'BACKEND_PROTOCOL_ERROR',
    });
  const fields: Field[] = data.fields.filter(
    (field): field is Field =>
      typeof field === 'object' &&
      field !== null &&
      'id' in field &&
      typeof (field as Record<string, unknown>).id === 'string' &&
      'key' in field &&
      typeof (field as Record<string, unknown>).key === 'string',
  );
  return { fields };
}
function resolveKeys(
  values: Record<string, unknown>,
  fields: Field[],
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    const matches = fields.filter(
      (field) => field.id === key || field.key === key,
    );
    if (matches.length !== 1)
      throw new CliError(
        `Field '${key}' does not resolve to exactly one template field.`,
        { category: 'validation', code: 'FIELD_UNKNOWN' },
      );
    output[matches[0]!.id] = value;
  }
  return output;
}
async function promptValues(
  fields: Field[],
  context: Invocation,
): Promise<Record<string, unknown>> {
  const rl = createInterface({ input: context.stdin, output: context.stderr });
  const values: Record<string, unknown> = {};
  try {
    for (const field of fields) {
      const hint = `${field.label ?? field.key} (${field.dataType ?? 'value'}${field.required ? ', required' : ''})${field.defaultValue === undefined ? '' : ` [default ${JSON.stringify(field.defaultValue)}]`}: `;
      const answer = await rl.question(hint);
      if (answer !== '')
        values[field.id] = parseAssignments([`${field.id}=${answer}`])[
          field.id
        ];
    }
  } finally {
    rl.close();
  }
  return values;
}
async function uploadFiles(
  graph: string,
  assignments: string[],
  fields: Field[],
  context: Invocation,
): Promise<Record<string, unknown>> {
  const output: Record<string, unknown> = {};
  for (const assignment of assignments) {
    const split = assignment.indexOf('=');
    if (split <= 0)
      throw new CliError(`Invalid file assignment '${assignment}'.`, {
        category: 'usage',
        code: 'FILE_ASSIGNMENT_INVALID',
      });
    const fieldKey = assignment.slice(0, split);
    const path = assignment.slice(split + 1);
    const field = fields.find(
      (candidate) => candidate.id === fieldKey || candidate.key === fieldKey,
    );
    if (!field)
      throw new CliError(`File field '${fieldKey}' is not in the template.`, {
        category: 'validation',
        code: 'FIELD_UNKNOWN',
      });
    const size = await validateLocalFile(path);
    const mediaType = mediaTypeFor(path);
    const authorization = (
      await context.backend.request<unknown>(`graphs/${encode(graph)}/files`, {
        body: { originalName: basename(path), mediaType, sizeBytes: size },
        idempotent: true,
        method: 'POST',
        signal: context.signal,
      })
    ).data;
    if (!isUploadAuthorization(authorization))
      throw new CliError(
        'The backend returned an incompatible upload authorization.',
        { category: 'partial', code: 'UPLOAD_AUTHORIZATION_INVALID' },
      );
    if (context.interactive)
      context.presenter.info(`Uploading ${basename(path)}…`);
    await context.backend.upload(
      authorization.uploadUrl,
      createReadStream(path),
      authorization.headers,
      context.signal,
    );
    await context.backend.request(
      `graphs/${encode(graph)}/files/${encode(authorization.id)}/complete`,
      { method: 'POST', signal: context.signal },
    );
    output[field.id] = authorization.id;
  }
  return output;
}
function isUploadAuthorization(value: unknown): value is {
  headers?: Record<string, string>;
  id: string;
  uploadUrl: string;
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'uploadUrl' in value &&
    typeof value.uploadUrl === 'string' &&
    (!('headers' in value) ||
      (typeof value.headers === 'object' && value.headers !== null))
  );
}
function mediaTypeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}
