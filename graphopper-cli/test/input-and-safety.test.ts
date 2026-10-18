import { Readable, Writable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import {
  parseAssignments,
  readStructuredInput,
} from '../src/input/structured-input.js';
import { confirmDestructive } from '../src/safety/confirmation.js';

class Sink extends Writable {
  value = '';
  override _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.value += chunk.toString();
    callback();
  }
}

describe('input and destructive safety', () => {
  it('reads one JSON object from standard input', async () => {
    await expect(
      readStructuredInput('-', Readable.from(['{"name":"✓"}'])),
    ).resolves.toEqual({ name: '✓' });
    await expect(
      readStructuredInput('-', Readable.from(['[1,2]'])),
    ).rejects.toMatchObject({ code: 'INPUT_SHAPE_INVALID' });
  });

  it('parses scalar assignments and rejects conflicting clears', () => {
    expect(parseAssignments(['age=42', 'enabled=true', 'name=Ada'])).toEqual({
      age: 42,
      enabled: true,
      name: 'Ada',
    });
    expect(() => parseAssignments(['name=Ada'], ['name'])).toThrowError(
      /set and cleared/u,
    );
  });

  it('requires explicit --yes in non-interactive execution', async () => {
    await expect(
      confirmDestructive({
        action: 'Delete graph',
        effects: 'All data will be removed.',
        interactive: false,
        target: 'Example [g-1]',
        yes: false,
      }),
    ).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
  });

  it('identifies the target and effects before accepting an interactive delete', async () => {
    const stderr = new Sink();
    await confirmDestructive({
      action: 'Delete graph',
      effects: 'All data will be removed.',
      interactive: true,
      stdin: Readable.from(['yes\n']),
      stderr,
      target: 'Example [g-1]',
      yes: false,
    });
    expect(stderr.value).toContain('Example [g-1]');
    expect(stderr.value).toContain('All data will be removed.');
  });
});
