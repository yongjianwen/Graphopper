import { readFile, stat } from 'node:fs/promises';
import type { Readable } from 'node:stream';

import { CliError } from '../core/errors.js';

export async function readStructuredInput(
  path: string,
  stdin: Readable = process.stdin,
): Promise<Record<string, unknown>> {
  const text =
    path === '-' ? await readStream(stdin) : await readFile(path, 'utf8');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error: unknown) {
    throw new CliError('Structured input must be valid UTF-8 JSON.', {
      category: 'usage',
      code: 'INPUT_JSON_INVALID',
      cause: error,
    });
  }
  if (!isRecord(value))
    throw new CliError('Structured input must contain one JSON object.', {
      category: 'usage',
      code: 'INPUT_SHAPE_INVALID',
    });
  return value;
}

export function rejectUnknown(
  value: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length)
    throw new CliError(`Unknown input properties: ${unknown.join(', ')}.`, {
      category: 'usage',
      code: 'INPUT_PROPERTY_UNKNOWN',
      details: unknown,
    });
}

export function parseAssignments(
  assignments: readonly string[] = [],
  clears: readonly string[] = [],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const assignment of assignments) {
    const separator = assignment.indexOf('=');
    if (separator <= 0)
      throw new CliError(
        `Invalid field assignment '${assignment}'; expected field=value.`,
        { category: 'usage', code: 'FIELD_ASSIGNMENT_INVALID' },
      );
    const key = assignment.slice(0, separator);
    if (key in result)
      throw new CliError(`Field '${key}' was assigned more than once.`, {
        category: 'usage',
        code: 'FIELD_ASSIGNMENT_DUPLICATE',
      });
    result[key] = parseScalar(assignment.slice(separator + 1));
  }
  for (const key of clears) {
    if (key in result)
      throw new CliError(`Field '${key}' cannot be set and cleared together.`, {
        category: 'usage',
        code: 'FIELD_ASSIGNMENT_DUPLICATE',
      });
    result[key] = null;
  }
  return result;
}

export async function validateLocalFile(
  path: string,
  maximumBytes = 25 * 1024 * 1024,
): Promise<number> {
  const info = await stat(path).catch((error: unknown) => {
    throw new CliError(`Cannot read local file '${path}'.`, {
      category: 'usage',
      code: 'FILE_UNREADABLE',
      cause: error,
    });
  });
  if (!info.isFile())
    throw new CliError(`'${path}' is not a regular file.`, {
      category: 'usage',
      code: 'FILE_NOT_REGULAR',
    });
  if (info.size > maximumBytes)
    throw new CliError(
      `'${path}' exceeds the ${maximumBytes}-byte upload limit.`,
      { category: 'validation', code: 'FILE_TOO_LARGE' },
    );
  return info.size;
}

function parseScalar(value: string): unknown {
  if (value === '') return '';
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? value : parsed;
  } catch {
    return value;
  }
}

async function readStream(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  return Buffer.concat(chunks).toString('utf8');
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
