import { Writable } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../src/authentication/auth-service.js';
import { MemoryCredentialStore } from '../src/authentication/credential-store.js';
import type { EffectiveConfig } from '../src/configuration/types.js';
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

const config: EffectiveConfig = {
  defaultGraph: undefined,
  expectedApiVersion: 'v1',
  oidcClientId: 'graphopper-cli',
  oidcIssuer: 'https://identity.example.com',
  oidcScopes: ['openid', 'offline_access'],
  output: 'json',
  profileName: 'default',
  server: 'https://api.example.com',
  sources: {},
  timeoutMs: 1_000,
};

afterEach(() => vi.useRealTimers());

describe('authentication', () => {
  it('completes device authorization and stores refreshable credentials', async () => {
    vi.useFakeTimers();
    const store = new MemoryCredentialStore();
    const stderr = new Sink();
    const fetcher: typeof fetch = (input) => {
      const url = requestUrl(input);
      if (url.endsWith('.well-known/openid-configuration'))
        return Promise.resolve(
          Response.json({
            device_authorization_endpoint:
              'https://identity.example.com/device',
            token_endpoint: 'https://identity.example.com/token',
          }),
        );
      if (url.endsWith('/device'))
        return Promise.resolve(
          Response.json({
            device_code: 'device-secret',
            expires_in: 60,
            interval: 1,
            user_code: 'ABCD-EFGH',
            verification_uri: 'https://identity.example.com/activate',
          }),
        );
      return Promise.resolve(
        Response.json({
          access_token: 'access-secret',
          expires_in: 3600,
          refresh_token: 'refresh-secret',
        }),
      );
    };
    const service = new AuthService(
      config,
      store,
      new Presenter({ stderr, stdout: new Sink() }),
      fetcher,
      {},
    );

    const login = service.login({ browser: false });
    await vi.advanceTimersByTimeAsync(1_000);
    await login;

    expect(await service.token()).toBe('access-secret');
    expect(stderr.value).not.toContain('access-secret');
    expect(stderr.value).not.toContain('refresh-secret');
  });

  it('gives a process token precedence and never overwrites storage', async () => {
    const store = new MemoryCredentialStore();
    await store.set(config, { accessToken: 'stored-token' });
    const service = new AuthService(
      config,
      store,
      new Presenter({ stderr: new Sink(), stdout: new Sink() }),
      fetch,
      { GRAPHOPPER_TOKEN: 'process-token' },
    );

    expect(await service.token()).toBe('process-token');
    expect((await store.get())?.accessToken).toBe('stored-token');
  });

  it('removes a definitively invalid refresh credential', async () => {
    const store = new MemoryCredentialStore();
    await store.set(config, {
      accessToken: 'expired',
      clientId: 'graphopper-cli',
      expiresAt: 0,
      refreshToken: 'invalid',
      tokenEndpoint: 'https://identity.example.com/token',
    });
    const fetcher: typeof fetch = () =>
      Promise.resolve(
        Response.json({ error: 'invalid_grant' }, { status: 400 }),
      );
    const service = new AuthService(
      config,
      store,
      new Presenter({ stderr: new Sink(), stdout: new Sink() }),
      fetcher,
      {},
    );

    await expect(service.token()).rejects.toMatchObject({
      code: 'TOKEN_REFRESH_FAILED',
    });
    expect(await store.get()).toBeUndefined();
  });
});

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}
