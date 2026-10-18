import { Readable, Writable } from 'node:stream';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MemoryCredentialStore } from '../src/authentication/credential-store.js';
import { ConfigStore } from '../src/configuration/config-store.js';
import { executeCli } from '../src/program.js';

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

describe('CLI integration', () => {
  let stdout: Sink;
  let stderr: Sink;
  let calls: Array<{ init: RequestInit | undefined; url: string }>;
  const temporaryDirectories: string[] = [];

  beforeEach(() => {
    stdout = new Sink();
    stderr = new Sink();
    calls = [];
  });

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((path) => rm(path, { force: true, recursive: true })),
    );
  });

  function options(fetcher: typeof fetch) {
    return {
      configStore: new ConfigStore('/path/that/does/not/exist/config.json'),
      credentialStore: new MemoryCredentialStore(),
      environment: { GRAPHOPPER_TOKEN: 'automation-token' },
      fetcher,
      stderr,
      stdin: Readable.from([]),
      stdout,
    };
  }

  it('prints help and version without configuration or network access', async () => {
    const failFetch: typeof fetch = () => {
      throw new Error('network must not be used');
    };
    expect(await executeCli(['--help'], options(failFetch))).toBe(0);
    expect(stdout.value).toContain('Manage and inspect graph data');
    stdout.value = '';
    expect(await executeCli(['version'], options(failFetch))).toBe(0);
    expect(stdout.value).toBe('0.1.0\n');
  });

  it('creates a graph with clean JSON stdout and authenticated API metadata', async () => {
    const fetcher: typeof fetch = (input, init) => {
      calls.push({ init, url: requestUrl(input) });
      return Promise.resolve(Response.json({ id: 'g-1', name: 'Example' }));
    };
    const code = await executeCli(
      ['--output', 'json', 'graph', 'create', 'Example'],
      options(fetcher),
    );

    expect(code).toBe(0);
    expect(JSON.parse(stdout.value)).toEqual({ id: 'g-1', name: 'Example' });
    expect(stderr.value).toBe('');
    expect(calls[0]?.url).toBe('http://127.0.0.1:3000/v1/graphs');
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get('authorization')).toBe('Bearer automation-token');
    expect(headers.get('idempotency-key')).toBeTruthy();
  });

  it('does not send a destructive request without explicit non-interactive consent', async () => {
    const fetcher: typeof fetch = (input, init) => {
      calls.push({ init, url: requestUrl(input) });
      return Promise.resolve(new Response(null, { status: 204 }));
    };
    expect(await executeCli(['graph', 'delete', 'g-1'], options(fetcher))).toBe(
      2,
    );
    expect(calls).toHaveLength(0);
    expect(stderr.value).toContain('CONFIRMATION_REQUIRED');

    stdout.value = '';
    stderr.value = '';
    expect(
      await executeCli(['--yes', 'graph', 'delete', 'g-1'], options(fetcher)),
    ).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.init?.method).toBe('DELETE');
  });

  it('fetches all cursor pages while preserving one JSON result', async () => {
    const fetcher: typeof fetch = (input, init) => {
      const url = requestUrl(input);
      calls.push({ init, url });
      return Promise.resolve(
        Response.json(
          url.includes('cursor=next')
            ? { items: [{ id: 'g-2' }], page: { hasMore: false } }
            : {
                items: [{ id: 'g-1' }],
                page: { hasMore: true, nextCursor: 'next' },
              },
        ),
      );
    };
    expect(
      await executeCli(
        ['--output', 'json', 'graph', 'list', '--all'],
        options(fetcher),
      ),
    ).toBe(0);
    expect(JSON.parse(stdout.value)).toEqual({
      items: [{ id: 'g-1' }, { id: 'g-2' }],
      page: { hasMore: false, nextCursor: null },
    });
    expect(calls).toHaveLength(2);
  });

  it('emits stable JSON errors on stderr with the documented exit category', async () => {
    const fetcher: typeof fetch = () =>
      Promise.resolve(
        Response.json(
          { error: { code: 'GRAPH_NOT_FOUND', message: 'Not found.' } },
          { status: 404 },
        ),
      );
    expect(
      await executeCli(
        ['--json-errors', 'graph', 'show', 'missing'],
        options(fetcher),
      ),
    ).toBe(4);
    expect(JSON.parse(stderr.value)).toEqual({
      error: {
        category: 'access',
        code: 'GRAPH_NOT_FOUND',
        message: 'Not found.',
      },
    });
    expect(stdout.value).toBe('');
  });

  it('streams a file through authorization and finalization before node creation', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'graphopper-upload-'));
    temporaryDirectories.push(directory);
    const path = join(directory, 'photo.png');
    await writeFile(path, Buffer.from('png-content'));
    const fetcher: typeof fetch = (input, init) => {
      const url = requestUrl(input);
      calls.push({ init, url });
      if (url.endsWith('/template'))
        return Promise.resolve(
          Response.json({ fields: [{ id: 'field-1', key: 'photo' }] }),
        );
      if (url.endsWith('/files') && init?.method === 'POST')
        return Promise.resolve(
          Response.json({
            headers: { 'content-type': 'image/png' },
            id: 'file-1',
            uploadUrl: 'https://storage.example.com/signed?token=secret',
          }),
        );
      if (url.startsWith('https://storage.example.com/'))
        return Promise.resolve(new Response(null, { status: 200 }));
      if (url.endsWith('/files/file-1/complete'))
        return Promise.resolve(Response.json({ id: 'file-1', state: 'ready' }));
      return Promise.resolve(
        Response.json({ id: 'node-1', values: { 'field-1': 'file-1' } }),
      );
    };

    expect(
      await executeCli(
        [
          '--output',
          'json',
          'node',
          'create',
          '--graph',
          'g-1',
          '--file',
          `photo=${path}`,
        ],
        options(fetcher),
      ),
    ).toBe(0);
    expect(calls.map((call) => call.init?.method ?? 'GET')).toEqual([
      'GET',
      'POST',
      'PUT',
      'POST',
      'POST',
    ]);
    expect(calls[4]?.init?.body).toBe(
      JSON.stringify({ values: { 'field-1': 'file-1' } }),
    );
    expect(stderr.value).not.toContain('storage.example.com');
    expect(stderr.value).not.toContain('secret');
  });
});

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}
