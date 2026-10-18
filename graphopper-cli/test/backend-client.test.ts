import { describe, expect, it } from 'vitest';

import { BackendClient } from '../src/backend/backend-client.js';
import type { EffectiveConfig } from '../src/configuration/types.js';
import type { CliError } from '../src/core/errors.js';

const config: EffectiveConfig = {
  defaultGraph: undefined,
  expectedApiVersion: 'v1',
  oidcClientId: undefined,
  oidcIssuer: undefined,
  oidcScopes: [],
  output: 'json',
  profileName: 'default',
  server: 'https://api.example.com',
  sources: {},
  timeoutMs: 1_000,
};

describe('BackendClient', () => {
  it('adds API versioning, credentials, request IDs, concurrency, and idempotency', async () => {
    let observedUrl = '';
    let observedInit: RequestInit | undefined;
    const fetcher: typeof fetch = (input, init) => {
      observedUrl = requestUrl(input);
      observedInit = init;
      return Promise.resolve(
        Response.json({ id: 'graph-α' }, { headers: { etag: '"v2"' } }),
      );
    };
    const client = new BackendClient(
      config,
      () => Promise.resolve('secret'),
      fetcher,
    );

    const response = await client.request<{ id: string }>('graphs', {
      body: { name: 'Unicode ✓' },
      idempotent: true,
      method: 'POST',
      query: { label: ['one', 'two'] },
      version: '"v1"',
    });

    const headers = new Headers(observedInit?.headers);
    expect(observedUrl).toBe(
      'https://api.example.com/v1/graphs?label=one&label=two',
    );
    expect(headers.get('authorization')).toBe('Bearer secret');
    expect(headers.get('if-match')).toBe('"v1"');
    expect(headers.get('idempotency-key')).toBeTruthy();
    expect(headers.get('x-request-id')).toBeTruthy();
    expect(response).toMatchObject({ data: { id: 'graph-α' }, etag: '"v2"' });
  });

  it('preserves backend error codes, validation details, and request IDs', async () => {
    const fetcher: typeof fetch = () =>
      Promise.resolve(
        Response.json(
          {
            error: {
              code: 'NODE_VALUE_INVALID',
              details: { field: 'age' },
              message: 'Age is invalid.',
              requestId: 'req-123',
            },
          },
          { status: 422 },
        ),
      );
    const client = new BackendClient(
      config,
      () => Promise.resolve(undefined),
      fetcher,
    );

    await expect(client.request('nodes')).rejects.toMatchObject({
      category: 'validation',
      code: 'NODE_VALUE_INVALID',
      details: { field: 'age' },
      requestId: 'req-123',
    } satisfies Partial<CliError>);
  });

  it('refuses redirects so credentials cannot cross origins', async () => {
    const fetcher: typeof fetch = () =>
      Promise.resolve(new Response(null, { status: 302 }));
    const client = new BackendClient(
      config,
      () => Promise.resolve('secret'),
      fetcher,
    );

    await expect(client.request('graphs')).rejects.toMatchObject({
      code: 'REDIRECT_REFUSED',
    });
  });
});

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}
