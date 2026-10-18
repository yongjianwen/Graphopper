import { CliError } from '../core/errors.js';
import type {
  ConfigFile,
  EffectiveConfig,
  GlobalConfigOverrides,
  OutputFormat,
} from './types.js';

const defaults = {
  expectedApiVersion: 'v1',
  oidcScopes: ['openid', 'profile', 'email', 'offline_access'],
  output: 'detail' as OutputFormat,
  server: 'http://127.0.0.1:3000',
  timeoutMs: 30_000,
};

export function resolveConfig(
  file: ConfigFile,
  overrides: GlobalConfigOverrides,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): EffectiveConfig {
  const profileName =
    overrides.profile ?? environment.GRAPHOPPER_PROFILE ?? file.activeProfile;
  const profile = file.profiles[profileName];
  if (profile === undefined)
    throw new CliError(`Profile '${profileName}' does not exist.`, {
      category: 'usage',
      code: 'PROFILE_NOT_FOUND',
    });

  const sources: Record<
    string,
    'command' | 'default' | 'environment' | 'profile'
  > = {};
  const server = select(
    'server',
    overrides.server,
    environment.GRAPHOPPER_SERVER,
    profile.server,
    defaults.server,
    sources,
  );
  validateServer(server);
  const output = parseOutput(
    select(
      'output',
      overrides.output,
      environment.GRAPHOPPER_OUTPUT,
      profile.output,
      defaults.output,
      sources,
    ),
  );
  const timeoutRaw = select<string | number>(
    'timeoutMs',
    overrides.timeout,
    environment.GRAPHOPPER_TIMEOUT_MS,
    profile.timeoutMs,
    defaults.timeoutMs,
    sources,
  );
  const timeoutMs = Number(timeoutRaw);
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 100 ||
    timeoutMs > 300_000
  )
    throw new CliError('Timeout must be between 100 and 300000 milliseconds.', {
      category: 'usage',
      code: 'TIMEOUT_INVALID',
    });

  return {
    defaultGraph: profile.defaultGraph,
    expectedApiVersion:
      profile.expectedApiVersion ?? defaults.expectedApiVersion,
    oidcClientId: profile.oidcClientId,
    oidcIssuer: profile.oidcIssuer,
    oidcScopes: profile.oidcScopes ?? defaults.oidcScopes,
    output,
    profileName,
    server,
    sources,
    timeoutMs,
  };
}

function select<T>(
  name: string,
  command: T | undefined,
  environment: T | undefined,
  profile: T | undefined,
  fallback: T,
  sources: Record<string, 'command' | 'default' | 'environment' | 'profile'>,
): T {
  if (command !== undefined) {
    sources[name] = 'command';
    return command;
  }
  if (environment !== undefined) {
    sources[name] = 'environment';
    return environment;
  }
  if (profile !== undefined) {
    sources[name] = 'profile';
    return profile;
  }
  sources[name] = 'default';
  return fallback;
}

function parseOutput(value: string): OutputFormat {
  if (
    value === 'detail' ||
    value === 'id' ||
    value === 'json' ||
    value === 'table'
  )
    return value;
  throw new CliError('Output must be detail, table, json, or id.', {
    category: 'usage',
    code: 'OUTPUT_INVALID',
  });
}

export function validateServer(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error: unknown) {
    throw new CliError('The backend URL is invalid.', {
      category: 'usage',
      code: 'SERVER_URL_INVALID',
      cause: error,
    });
  }
  const loopback =
    url.hostname === '127.0.0.1' ||
    url.hostname === 'localhost' ||
    url.hostname === '::1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
    throw new CliError(
      'The backend URL must use HTTPS, except for loopback development.',
      { category: 'usage', code: 'SERVER_URL_INSECURE' },
    );
  if (url.username || url.password)
    throw new CliError('The backend URL must not contain credentials.', {
      category: 'usage',
      code: 'SERVER_URL_INVALID',
    });
}
