import type { Writable } from 'node:stream';

import { CliError } from '../core/errors.js';
import { redact } from '../core/redaction.js';
import type { OutputFormat } from '../configuration/types.js';

export interface PresenterOptions {
  readonly stderr?: Writable;
  readonly stdout?: Writable;
  readonly quiet?: boolean | undefined;
  readonly verbose?: boolean | undefined;
}

export class Presenter {
  readonly stderr: Writable;
  readonly stdout: Writable;
  readonly quiet: boolean;
  readonly verbose: boolean;

  constructor(options: PresenterOptions = {}) {
    this.stdout = options.stdout ?? process.stdout;
    this.stderr = options.stderr ?? process.stderr;
    this.quiet = options.quiet ?? false;
    this.verbose = options.verbose ?? false;
  }

  result(value: unknown, format: OutputFormat): void {
    if (format === 'json') {
      this.stdout.write(`${JSON.stringify(value)}\n`);
      return;
    }
    if (format === 'id') {
      const id = extractId(value);
      this.stdout.write(`${id}\n`);
      return;
    }
    if (format === 'table' || Array.isArray(value)) {
      this.stdout.write(renderTable(value));
      return;
    }
    this.stdout.write(renderDetail(value));
  }

  error(error: CliError, json = false): void {
    if (json) {
      this.stderr.write(
        `${JSON.stringify({ error: { category: error.category, code: error.code, message: redact(error.message), ...(error.details === undefined ? {} : { details: error.details }), ...(error.requestId === undefined ? {} : { requestId: error.requestId }) } })}\n`,
      );
      return;
    }
    const request = error.requestId ? ` (request ${error.requestId})` : '';
    this.stderr.write(`${redact(error.message)} [${error.code}]${request}\n`);
  }

  info(message: string): void {
    if (!this.quiet) this.stderr.write(`${redact(message)}\n`);
  }

  diagnostic(message: string): void {
    if (this.verbose) this.stderr.write(`debug: ${redact(message)}\n`);
  }
}

function extractId(value: unknown): string {
  if (isRecord(value) && typeof value.id === 'string') return value.id;
  throw new CliError(
    'Identifier-only output requires a result containing one identifier.',
    { category: 'internal', code: 'IDENTIFIER_OUTPUT_UNAVAILABLE' },
  );
}

function renderDetail(value: unknown): string {
  if (!isRecord(value)) return `${formatCell(value)}\n`;
  const width = Math.max(1, ...Object.keys(value).map((key) => key.length));
  return `${Object.entries(value)
    .map(([key, entry]) => `${key.padEnd(width)}  ${formatCell(entry)}`)
    .join('\n')}\n`;
}

function renderTable(value: unknown): string {
  const items = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.items)
      ? value.items
      : [];
  if (items.length === 0) return 'No results.\n';
  const rows = items.filter(isRecord);
  if (rows.length === 0) return `${items.map(formatCell).join('\n')}\n`;
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(
    0,
    8,
  );
  const widths = keys.map((key) =>
    Math.min(
      40,
      Math.max(key.length, ...rows.map((row) => formatCell(row[key]).length)),
    ),
  );
  const line = (row: Record<string, unknown>) =>
    keys
      .map((key, index) =>
        truncate(formatCell(row[key]), widths[index] ?? 10).padEnd(
          widths[index] ?? 10,
        ),
      )
      .join('  ')
      .trimEnd();
  return `${keys
    .map((key, index) => key.padEnd(widths[index] ?? 10))
    .join('  ')
    .trimEnd()}\n${widths.map((width) => '-'.repeat(width)).join('  ')}\n${rows.map(line).join('\n')}\n`;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return JSON.stringify(value);
}

function truncate(value: string, width: number): string {
  return value.length <= width
    ? value
    : `${value.slice(0, Math.max(0, width - 1))}…`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
