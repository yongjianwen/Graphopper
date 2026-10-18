import open from 'open';

import type { BackendPort, FetchPort } from '../backend/backend-client.js';
import type { EffectiveConfig } from '../configuration/types.js';
import { CliError } from '../core/errors.js';
import type { Presenter } from '../presentation/presenter.js';
import type {
  CredentialStorePort,
  StoredCredential,
} from './credential-store.js';

interface DiscoveryDocument {
  readonly device_authorization_endpoint?: string;
  readonly revocation_endpoint?: string;
  readonly token_endpoint: string;
}

interface TokenResponse {
  readonly access_token: string;
  readonly expires_in?: number;
  readonly refresh_token?: string;
}

export class AuthService {
  constructor(
    private readonly config: EffectiveConfig,
    private readonly store: CredentialStorePort,
    private readonly presenter: Presenter,
    private readonly fetcher: FetchPort = fetch,
    private readonly environment: Readonly<
      Record<string, string | undefined>
    > = process.env,
  ) {}

  async token(): Promise<string | undefined> {
    if (this.environment.GRAPHOPPER_TOKEN)
      return this.environment.GRAPHOPPER_TOKEN;
    const stored = await this.store.get(this.config);
    if (!stored) return undefined;
    if (
      stored.expiresAt === undefined ||
      stored.expiresAt > Date.now() + 30_000
    )
      return stored.accessToken;
    if (!stored.refreshToken || !stored.tokenEndpoint || !stored.clientId)
      return stored.accessToken;
    return this.refresh(stored);
  }

  async login(options: {
    browser: boolean;
    signal?: AbortSignal | undefined;
  }): Promise<void> {
    if (!this.config.oidcIssuer || !this.config.oidcClientId)
      throw new CliError(
        'The active profile requires oidcIssuer and oidcClientId for interactive login.',
        { category: 'usage', code: 'OIDC_CONFIGURATION_REQUIRED' },
      );
    const discovery = await this.discovery();
    if (!discovery.device_authorization_endpoint)
      throw new CliError(
        'The identity provider does not advertise device authorization.',
        { category: 'authentication', code: 'DEVICE_FLOW_UNAVAILABLE' },
      );
    const response = await this.postForm(
      discovery.device_authorization_endpoint,
      {
        client_id: this.config.oidcClientId,
        scope: this.config.oidcScopes.join(' '),
      },
      options.signal,
    );
    const device = requireRecord(response, [
      'device_code',
      'user_code',
      'verification_uri',
      'expires_in',
    ]);
    const verificationUri = String(
      device.verification_uri_complete ?? device.verification_uri,
    );
    this.presenter.info(
      `Open ${verificationUri} and enter code ${String(device.user_code)}.`,
    );
    if (options.browser)
      await open(verificationUri).catch(() =>
        this.presenter.info('Browser launch failed; open the URL manually.'),
      );
    const expiresAt = Date.now() + Number(device.expires_in) * 1000;
    const interval = Math.max(1, Number(device.interval ?? 5)) * 1000;
    while (Date.now() < expiresAt) {
      await wait(interval, options.signal);
      const tokenResult = await this.postFormRaw(
        discovery.token_endpoint,
        {
          client_id: this.config.oidcClientId,
          device_code: String(device.device_code),
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        },
        options.signal,
      );
      if (!tokenResult.ok) {
        const error = await safeJson(tokenResult);
        const code = recordString(error, 'error');
        if (code === 'authorization_pending' || code === 'slow_down') continue;
        throw new CliError('Device authorization failed.', {
          category: 'authentication',
          code: code ?? 'LOGIN_FAILED',
        });
      }
      const token = parseToken(await tokenResult.json());
      await this.store.set(
        this.config,
        storedCredential(
          token,
          discovery.token_endpoint,
          this.config.oidcClientId,
        ),
      );
      this.presenter.info(
        'Login completed and the credential was stored securely.',
      );
      return;
    }
    throw new CliError('Device authorization expired before completion.', {
      category: 'authentication',
      code: 'LOGIN_EXPIRED',
    });
  }

  async storeExternalToken(token: string): Promise<void> {
    if (!token.trim())
      throw new CliError('No token was supplied.', {
        category: 'usage',
        code: 'TOKEN_REQUIRED',
      });
    await this.store.set(this.config, { accessToken: token.trim() });
  }

  async status(backend: BackendPort): Promise<unknown> {
    return (await backend.request<unknown>('me')).data;
  }

  async logout(
    revoke: boolean,
  ): Promise<{ localRemoved: boolean; remoteRevoked: boolean }> {
    const credential = await this.store.get(this.config);
    let remoteRevoked = false;
    if (
      revoke &&
      credential &&
      this.config.oidcClientId &&
      this.config.oidcIssuer
    ) {
      const discovery = await this.discovery();
      if (discovery.revocation_endpoint) {
        const response = await this.postFormRaw(
          discovery.revocation_endpoint,
          {
            client_id: this.config.oidcClientId,
            token: credential.refreshToken ?? credential.accessToken,
          },
          undefined,
        );
        remoteRevoked = response.ok;
      }
    }
    const localRemoved = await this.store.delete(this.config);
    return { localRemoved, remoteRevoked };
  }

  private async refresh(stored: StoredCredential): Promise<string> {
    const response = await this.postFormRaw(
      stored.tokenEndpoint!,
      {
        client_id: stored.clientId!,
        grant_type: 'refresh_token',
        refresh_token: stored.refreshToken!,
      },
      undefined,
    );
    if (!response.ok) {
      const body = await safeJson(response);
      if (recordString(body, 'error') === 'invalid_grant')
        await this.store.delete(this.config);
      throw new CliError('Stored authentication could not be refreshed.', {
        category: 'authentication',
        code: 'TOKEN_REFRESH_FAILED',
      });
    }
    const token = parseToken(await response.json());
    const updated = storedCredential(
      token,
      stored.tokenEndpoint!,
      stored.clientId!,
      stored.refreshToken,
    );
    await this.store.set(this.config, updated);
    return updated.accessToken;
  }

  private async discovery(): Promise<DiscoveryDocument> {
    const issuer = new URL(this.config.oidcIssuer!);
    const response = await this.fetcher(
      new URL(
        '.well-known/openid-configuration',
        issuer.href.endsWith('/') ? issuer : `${issuer.href}/`,
      ),
      { headers: { accept: 'application/json' }, redirect: 'error' },
    );
    if (!response.ok)
      throw new CliError('OIDC discovery failed.', {
        category: 'authentication',
        code: 'OIDC_DISCOVERY_FAILED',
      });
    const value = await response.json();
    if (
      typeof value !== 'object' ||
      value === null ||
      !('token_endpoint' in value) ||
      typeof value.token_endpoint !== 'string'
    )
      throw new CliError('OIDC discovery returned an incompatible document.', {
        category: 'authentication',
        code: 'OIDC_PROTOCOL_ERROR',
      });
    return value as DiscoveryDocument;
  }

  private async postForm(
    url: string,
    values: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const response = await this.postFormRaw(url, values, signal);
    if (!response.ok)
      throw new CliError('The identity provider rejected the request.', {
        category: 'authentication',
        code: 'OIDC_REQUEST_FAILED',
      });
    return response.json();
  }

  private postFormRaw(
    url: string,
    values: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<Response> {
    return this.fetcher(url, {
      body: new URLSearchParams(values),
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
      redirect: 'error',
      ...(signal === undefined ? {} : { signal }),
    });
  }
}

function parseToken(value: unknown): TokenResponse {
  const record = requireRecord(value, ['access_token']);
  if (
    typeof record.access_token !== 'string' ||
    (record.refresh_token !== undefined &&
      typeof record.refresh_token !== 'string') ||
    (record.expires_in !== undefined && typeof record.expires_in !== 'number')
  )
    throw new CliError('The identity provider returned invalid token fields.', {
      category: 'authentication',
      code: 'OIDC_PROTOCOL_ERROR',
    });
  return {
    access_token: record.access_token,
    ...(record.expires_in === undefined
      ? {}
      : { expires_in: Number(record.expires_in) }),
    ...(record.refresh_token === undefined
      ? {}
      : { refresh_token: record.refresh_token }),
  };
}

function storedCredential(
  token: TokenResponse,
  endpoint: string,
  clientId: string,
  existingRefresh?: string,
): StoredCredential {
  const refreshToken = token.refresh_token ?? existingRefresh;
  return {
    accessToken: token.access_token,
    clientId,
    tokenEndpoint: endpoint,
    ...(token.expires_in === undefined
      ? {}
      : { expiresAt: Date.now() + token.expires_in * 1000 }),
    ...(refreshToken === undefined ? {} : { refreshToken }),
  };
}

function requireRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new CliError(
      'The identity provider returned an incompatible response.',
      { category: 'authentication', code: 'OIDC_PROTOCOL_ERROR' },
    );
  const record = value as Record<string, unknown>;
  if (keys.some((key) => record[key] === undefined))
    throw new CliError(
      'The identity provider response is missing required fields.',
      { category: 'authentication', code: 'OIDC_PROTOCOL_ERROR' },
    );
  return record;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
function recordString(value: unknown, key: string): string | undefined {
  return typeof value === 'object' &&
    value !== null &&
    key in value &&
    typeof (value as Record<string, unknown>)[key] === 'string'
    ? String((value as Record<string, unknown>)[key])
    : undefined;
}
async function wait(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(
          signal.reason instanceof Error
            ? signal.reason
            : new Error('The operation was cancelled.'),
        );
      },
      { once: true },
    );
  });
}
