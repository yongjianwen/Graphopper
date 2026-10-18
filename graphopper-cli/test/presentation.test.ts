import { Writable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { CliError } from '../src/core/errors.js';
import { redact } from '../src/core/redaction.js';
import { Presenter } from '../src/presentation/presenter.js';

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

describe('presentation and redaction', () => {
  it('redacts authorization values and signed query credentials', () => {
    const value = redact(
      'Authorization: Bearer abc.def and https://storage/x?token=signed-secret&part=1',
    );
    expect(value).not.toContain('abc.def');
    expect(value).not.toContain('signed-secret');
    expect(value).toContain('[REDACTED]');
  });

  it('keeps JSON errors on stderr and preserves safe backend metadata', () => {
    const stdout = new Sink();
    const stderr = new Sink();
    const presenter = new Presenter({ stderr, stdout });
    presenter.error(
      new CliError('Bearer secret-token was rejected.', {
        category: 'authentication',
        code: 'TOKEN_REJECTED',
        details: { reason: 'expired' },
        requestId: 'req-1',
      }),
      true,
    );
    expect(stdout.value).toBe('');
    expect(JSON.parse(stderr.value)).toEqual({
      error: {
        category: 'authentication',
        code: 'TOKEN_REJECTED',
        details: { reason: 'expired' },
        message: '[REDACTED] was rejected.',
        requestId: 'req-1',
      },
    });
  });

  it('suppresses informational and diagnostic output according to flags', () => {
    const quiet = new Sink();
    const presenter = new Presenter({ quiet: true, stderr: quiet });
    presenter.info('progress');
    presenter.diagnostic('metadata');
    expect(quiet.value).toBe('');

    const verbose = new Sink();
    new Presenter({ stderr: verbose, verbose: true }).diagnostic('metadata');
    expect(verbose.value).toBe('debug: metadata\n');
  });
});
