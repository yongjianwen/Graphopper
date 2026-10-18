import type { Command } from 'commander';

import type { Runtime } from '../runtime.js';
import { collect, encode, invocation } from './common.js';

export function registerTraversalCommand(
  program: Command,
  runtime: Runtime,
): void {
  program
    .command('traverse')
    .description('Retrieve and render a bounded connected subgraph.')
    .requiredOption('--graph <id>')
    .requiredOption('--start <nodeId>')
    .option('--direction <direction>', 'incoming, outgoing, or both', 'both')
    .option('--type <type>', 'Relationship type filter', collect, [])
    .option('--depth <number>', 'Requested depth', '3')
    .option('--node-limit <number>', 'Maximum nodes', '1000')
    .option('--relationship-limit <number>', 'Maximum relationships', '2000')
    .action(
      async (
        options: {
          depth: string;
          direction: string;
          graph: string;
          nodeLimit: string;
          relationshipLimit: string;
          start: string;
          type: string[];
        },
        command: Command,
      ) => {
        const context = await invocation(runtime, command);
        const data = (
          await context.backend.request<unknown>(
            `graphs/${encode(options.graph)}/traversals`,
            {
              query: {
                startNodeId: options.start,
                direction: options.direction,
                relationshipType: options.type,
                maxDepth: options.depth,
                maxNodes: options.nodeLimit,
                maxRelationships: options.relationshipLimit,
              },
              signal: context.signal,
            },
          )
        ).data;
        if (context.format === 'json') {
          context.presenter.result(data, 'json');
          return;
        }
        const lines = traversalLines(data, 2_000);
        context.stdout.write(`${lines.join('\n')}\n`);
        if (isTruncated(data))
          context.presenter.info(
            'Traversal was truncated by a configured backend or terminal limit.',
          );
      },
    );
}

function traversalLines(value: unknown, maximum: number): string[] {
  if (typeof value !== 'object' || value === null)
    return ['No traversal results.'];
  const record = value as Record<string, unknown>;
  const nodes: unknown[] = Array.isArray(record.nodes) ? record.nodes : [];
  const relationships: unknown[] = Array.isArray(record.relationships)
    ? record.relationships
    : [];
  const names = new Map<string, string>();
  for (const node of nodes)
    if (
      typeof node === 'object' &&
      node !== null &&
      'id' in node &&
      typeof (node as Record<string, unknown>).id === 'string'
    )
      names.set(
        (node as Record<string, unknown>).id as string,
        displayNode(node),
      );
  const lines: string[] = [];
  for (const relationship of relationships) {
    if (lines.length >= maximum) break;
    if (typeof relationship !== 'object' || relationship === null) continue;
    const relationshipRecord = relationship as Record<string, unknown>;
    const source =
      stringProperty(relationshipRecord, 'sourceNodeId') ??
      stringProperty(relationshipRecord, 'source');
    const target =
      stringProperty(relationshipRecord, 'targetNodeId') ??
      stringProperty(relationshipRecord, 'target');
    const type = stringProperty(relationshipRecord, 'type') ?? 'RELATED_TO';
    if (source && target)
      lines.push(
        `${names.get(source) ?? `[${source}]`} --${type}--> ${names.get(target) ?? `[${target}]`}`,
      );
  }
  if (!lines.length)
    lines.push(...nodes.slice(0, maximum).map((node) => displayNode(node)));
  if (relationships.length > maximum)
    lines.push(`… terminal limit reached after ${maximum} relationships`);
  return lines;
}
function displayNode(value: unknown): string {
  if (typeof value !== 'object' || value === null) return String(value);
  const id = stringProperty(value, 'id') ?? 'unknown';
  const label = stringProperty(value, 'label') ?? stringProperty(value, 'name');
  return label ? `${label} [${id}]` : `[${id}]`;
}
function stringProperty(value: object, key: string): string | undefined {
  return key in value &&
    typeof (value as Record<string, unknown>)[key] === 'string'
    ? String((value as Record<string, unknown>)[key])
    : undefined;
}
function isTruncated(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'truncated' in value &&
    value.truncated === true
  );
}
