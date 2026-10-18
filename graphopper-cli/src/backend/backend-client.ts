import { randomUUID } from 'node:crypto';

import { CliError } from '../core/errors.js';
import type { EffectiveConfig } from '../configuration/types.js';

export type FetchPort = typeof fetch;
export type CredentialProvider = () => Promise<string | undefined>;
export type UploadBody = NonNullable<RequestInit['body']>;

export interface ApiRequest {
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  readonly idempotent?: boolean;
  readonly method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
  readonly query?: Readonly<
    Record<string, boolean | number | string | readonly string[] | undefined>
  >;
  readonly signal?: AbortSignal | undefined;
  readonly version?: string | undefined;
}

export interface ApiResponse<T> {
  readonly data: T;
  readonly etag: string | undefined;
  readonly requestId: string | undefined;
  readonly status: number;
}

export interface BackendPort {
  request<T>(path: string, request?: ApiRequest): Promise<ApiResponse<T>>;
  upload(
    url: string,
    body: UploadBody,
    headers?: Readonly<Record<string, string>>,
    signal?: AbortSignal,
  ): Promise<void>;
}

export class BackendClient implements BackendPort {
  constructor(
    private readonly config: EffectiveConfig,
    private readonly credentialProvider: CredentialProvider,
    private readonly fetcher: FetchPort = fetch,
  ) {}

  async request<T>(
    path: string,
    request: ApiRequest = {},
  ): Promise<ApiResponse<T>> {
    const method = request.method ?? 'GET';
    const url = this.url(path, request.query);
    const requestId = randomUUID();
    const token = await this.credentialProvider();
    const headers: Record<string, string> = {
      accept: 'application/json',
      'user-agent': `graphopper-cli/0.1.0`,
      'x-request-id': requestId,
      ...request.headers,
    };
    if (token) headers.authorization = `Bearer ${token}`;
    if (request.version) headers['if-match'] = request.version;
    if (request.idempotent) headers['idempotency-key'] = randomUUID();
    let body: string | undefined;
    if (request.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(request.body);
    }

    const retryable = method === 'GET' || request.idempotent === true;
    for (let attempt = 0; attempt < (retryable ? 3 : 1); attempt += 1) {
      try {
        const timeoutSignal = AbortSignal.timeout(this.config.timeoutMs);
        const signal = request.signal
          ? AbortSignal.any([request.signal, timeoutSignal])
          : timeoutSignal;
        const response = await this.fetcher(url, {
          ...(body === undefined ? {} : { body }),
          headers,
          method,
          redirect: 'manual',
          signal,
        });
        if (response.status >= 300 && response.status < 400)
          throw new CliError(
            'The backend returned a redirect, which was refused to protect credentials.',
            { category: 'network', code: 'REDIRECT_REFUSED' },
          );
        if (!response.ok) {
          if (
            (response.status === 429 || response.status >= 500) &&
            retryable &&
            attempt < 2
          ) {
            await delay(retryDelay(response, attempt), request.signal);
            continue;
          }
          throw await mapBackendError(response);
        }
        const responseApiVersion = response.headers.get(
          'x-graphopper-api-version',
        );
        if (
          responseApiVersion !== null &&
          responseApiVersion !== this.config.expectedApiVersion
        )
          throw new CliError(
            `Backend API ${responseApiVersion} is incompatible with expected ${this.config.expectedApiVersion}.`,
            { category: 'validation', code: 'API_VERSION_INCOMPATIBLE' },
          );
        const data =
          response.status === 204 ? undefined : await response.json();
        return {
          data: data as T,
          etag: response.headers.get('etag') ?? undefined,
          requestId: response.headers.get('x-request-id') ?? undefined,
          status: response.status,
        };
      } catch (error: unknown) {
        if (error instanceof CliError) throw error;
        if (request.signal?.aborted)
          throw new CliError('The operation was cancelled.', {
            category: 'cancelled',
            code: 'CANCELLED',
            cause: error,
          });
        if (retryable && attempt < 2) {
          await delay(100 * 2 ** attempt, request.signal);
          continue;
        }
        if (method !== 'GET')
          throw new CliError(
            'The mutation outcome is indeterminate. Inspect the resource before retrying.',
            {
              category: 'partial',
              code: 'MUTATION_OUTCOME_INDETERMINATE',
              cause: error,
            },
          );
        throw new CliError(
          `Cannot reach graphopper-backend at ${this.config.server}.`,
          { category: 'network', code: 'BACKEND_UNAVAILABLE', cause: error },
        );
      }
    }
    throw new CliError('Retry limit exceeded.', {
      category: 'network',
      code: 'RETRY_LIMIT_EXCEEDED',
    });
  }

  async upload(
    url: string,
    body: UploadBody,
    headers: Readonly<Record<string, string>> = {},
    signal?: AbortSignal,
  ): Promise<void> {
    const target = new URL(url);
    if (
      target.protocol !== 'https:' &&
      !(target.protocol === 'http:' && isLoopback(target.hostname))
    )
      throw new CliError('A signed upload URL must use HTTPS.', {
        category: 'validation',
        code: 'UPLOAD_URL_INSECURE',
      });
    const response = await this.fetcher(target, {
      body,
      headers,
      method: 'PUT',
      redirect: 'error',
      ...(signal === undefined ? {} : { signal }),
      duplex: 'half',
    });
    if (!response.ok)
      throw new CliError(
        'The object upload failed before backend finalization.',
        { category: 'partial', code: 'UPLOAD_TRANSFER_FAILED' },
      );
  }

  private url(path: string, query: ApiRequest['query']): URL {
    const base = new URL(
      this.config.server.endsWith('/')
        ? this.config.server
        : `${this.config.server}/`,
    );
    const cleanPath = path.replace(/^\//, '');
    const url = new URL(
      `${this.config.expectedApiVersion.replace(/^\//, '')}/${cleanPath}`,
      base,
    );
    for (const [key, raw] of Object.entries(query ?? {})) {
      if (raw === undefined) continue;
      for (const value of Array.isArray(raw) ? raw : [raw])
        url.searchParams.append(key, String(value));
    }
    return url;
  }
}

async function mapBackendError(response: Response): Promise<CliError> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    value = undefined;
  }
  const payload = extractBackendError(value);
  const responseRequestId =
    payload?.requestId ?? response.headers.get('x-request-id') ?? undefined;
  const category =
    response.status === 401
      ? 'authentication'
      : response.status === 403 || response.status === 404
        ? 'access'
        : response.status === 409 || response.status === 412
          ? 'conflict'
          : response.status === 400 || response.status === 422
            ? 'validation'
            : response.status === 429 || response.status >= 500
              ? 'network'
              : 'internal';
  const baseMessage =
    payload?.message ?? `Backend request failed with HTTP ${response.status}.`;
  const message =
    payload?.code === 'RESOURCE_VERSION_MISMATCH'
      ? `${baseMessage} Retrieve the current resource and retry your change.`
      : baseMessage;
  return new CliError(message, {
    category,
    code: payload?.code ?? `HTTP_${response.status}`,
    ...(payload?.details === undefined ? {} : { details: payload.details }),
    ...(responseRequestId === undefined
      ? {}
      : { requestId: responseRequestId }),
  });
}

function extractBackendError(
  value: unknown,
):
  | { code: string; details?: unknown; message: string; requestId?: string }
  | undefined {
  if (typeof value !== 'object' || value === null || !('error' in value))
    return undefined;
  const { error } = value;
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    !('message' in error) ||
    typeof error.code !== 'string' ||
    typeof error.message !== 'string'
  )
    return undefined;
  return {
    code: error.code,
    message: error.message,
    ...('details' in error ? { details: error.details } : {}),
    ...('requestId' in error && typeof error.requestId === 'string'
      ? { requestId: error.requestId }
      : {}),
  };
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get('retry-after'));
  return Number.isFinite(retryAfter) && retryAfter >= 0
    ? Math.min(retryAfter * 1000, 5_000)
    : 100 * 2 ** attempt + Math.floor(Math.random() * 50);
}

async function delay(
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
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

function isLoopback(hostname: string): boolean {
  return (
    hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1'
  );
}
