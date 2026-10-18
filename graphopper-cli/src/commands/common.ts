import type { Command } from 'commander';

import type { ApiRequest, BackendPort } from '../backend/backend-client.js';
import { CliError } from '../core/errors.js';
import {
  readStructuredInput,
  rejectUnknown,
} from '../input/structured-input.js';
import type { GlobalOptions, Invocation, Runtime } from '../runtime.js';

export function globalOptions(command: Command): GlobalOptions {
  return command.optsWithGlobals<GlobalOptions>();
}

export async function invocation(
  runtime: Runtime,
  command: Command,
): Promise<Invocation> {
  return runtime.invocation(globalOptions(command));
}

export function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function graphId(
  option: string | undefined,
  context: Invocation,
): string {
  const value = option ?? context.config.defaultGraph;
  if (!value)
    throw new CliError(
      'A graph identifier is required; use --graph or configure defaultGraph.',
      { category: 'usage', code: 'GRAPH_ID_REQUIRED' },
    );
  return value;
}

export function encode(value: string): string {
  return encodeURIComponent(value);
}

export async function inputObject(
  path: string | undefined,
  base: Record<string, unknown>,
  allowed: readonly string[],
  context: Invocation,
): Promise<Record<string, unknown>> {
  const structured = path ? await readStructuredInput(path, context.stdin) : {};
  rejectUnknown(structured, allowed);
  return {
    ...structured,
    ...Object.fromEntries(
      Object.entries(base).filter(([, value]) => value !== undefined),
    ),
  };
}

export async function fetchAll(
  backend: BackendPort,
  path: string,
  request: ApiRequest,
  maximum = 10_000,
): Promise<{ items: unknown[]; page: { hasMore: boolean; nextCursor: null } }> {
  const items: unknown[] = [];
  let cursor: string | undefined;
  do {
    const response = await backend.request<unknown>(path, {
      ...request,
      query: { ...request.query, ...(cursor ? { cursor } : {}) },
    });
    const page = paged(response.data);
    items.push(...page.items);
    if (items.length > maximum)
      throw new CliError(
        `--all exceeded the ${maximum}-item client safety limit.`,
        {
          category: 'partial',
          code: 'FETCH_ALL_LIMIT_EXCEEDED',
          details: { returned: items.length },
        },
      );
    cursor = page.page.hasMore
      ? (page.page.nextCursor ?? undefined)
      : undefined;
  } while (cursor);
  return { items, page: { hasMore: false, nextCursor: null } };
}

function paged(value: unknown): {
  items: unknown[];
  page: { hasMore: boolean; nextCursor?: string | null };
} {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('items' in value) ||
    !Array.isArray(value.items)
  )
    throw new CliError(
      'The backend returned an incompatible paginated response.',
      { category: 'internal', code: 'BACKEND_PROTOCOL_ERROR' },
    );
  const page =
    'page' in value && typeof value.page === 'object' && value.page !== null
      ? (value.page as Record<string, unknown>)
      : {};
  return {
    items: value.items,
    page: {
      hasMore: page.hasMore === true,
      ...(typeof page.nextCursor === 'string' || page.nextCursor === null
        ? { nextCursor: page.nextCursor }
        : {}),
    },
  };
}
