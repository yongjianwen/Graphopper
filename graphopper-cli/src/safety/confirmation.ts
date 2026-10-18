import { createInterface } from 'node:readline/promises';
import type { Readable, Writable } from 'node:stream';

import { CliError } from '../core/errors.js';

export interface ConfirmationOptions {
  readonly action: string;
  readonly effects: string;
  readonly interactive: boolean;
  readonly stdin?: Readable;
  readonly stderr?: Writable;
  readonly target: string;
  readonly yes: boolean;
}

export async function confirmDestructive(
  options: ConfirmationOptions,
): Promise<void> {
  if (options.yes) return;
  if (!options.interactive)
    throw new CliError(
      'This destructive command requires --yes in non-interactive mode.',
      { category: 'usage', code: 'CONFIRMATION_REQUIRED' },
    );
  const input = options.stdin ?? process.stdin;
  const output = options.stderr ?? process.stderr;
  const readline = createInterface({ input, output });
  try {
    const answer = await readline.question(
      `${options.action} ${options.target}? ${options.effects} This is irreversible. Type 'yes' to continue: `,
    );
    if (answer.trim().toLowerCase() !== 'yes')
      throw new CliError(
        'The operation was cancelled before any mutation was sent.',
        { category: 'cancelled', code: 'CONFIRMATION_REJECTED' },
      );
  } finally {
    readline.close();
  }
}
