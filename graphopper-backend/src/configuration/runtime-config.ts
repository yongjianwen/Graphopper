const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;
const DEFAULT_BODY_LIMIT_BYTES = 1_048_576;

export type RuntimeEnvironment = 'development' | 'production' | 'test';

export interface RuntimeConfig {
  readonly bodyLimitBytes: number;
  readonly cursorSecret: string;
  readonly databaseUrl: string | undefined;
  readonly environment: RuntimeEnvironment;
  readonly host: string;
  readonly jitProvisioning: boolean;
  readonly logLevel:
    'debug' | 'error' | 'fatal' | 'info' | 'silent' | 'trace' | 'warn';
  readonly maxPageSize: number;
  readonly maxTemplateMigrationNodes: number;
  readonly maxUploadBytes: number;
  readonly oidcAudience: string | undefined;
  readonly oidcIssuer: string | undefined;
  readonly oidcJwksUrl: string | undefined;
  readonly port: number;
  readonly requiredScope: string | undefined;
}

export type RuntimeEnvironmentValues = Readonly<
  Record<string, string | undefined>
>;

export function loadRuntimeConfig(
  environmentValues: RuntimeEnvironmentValues = process.env,
): RuntimeConfig {
  const environment = parseEnvironment(environmentValues.NODE_ENV);
  const host = environmentValues.HOST?.trim() || DEFAULT_HOST;
  const port = parseInteger(
    'PORT',
    environmentValues.PORT,
    DEFAULT_PORT,
    1,
    65_535,
  );
  const bodyLimitBytes = parseInteger(
    'BODY_LIMIT_BYTES',
    environmentValues.BODY_LIMIT_BYTES,
    DEFAULT_BODY_LIMIT_BYTES,
    1,
    10_485_760,
  );
  const databaseUrl = parseDatabaseUrl(environmentValues.DATABASE_URL);
  const logLevel = parseLogLevel(environmentValues.LOG_LEVEL);
  const maxPageSize = parseInteger(
    'MAX_PAGE_SIZE',
    environmentValues.MAX_PAGE_SIZE,
    200,
    1,
    200,
  );
  const maxUploadBytes = parseInteger(
    'MAX_UPLOAD_BYTES',
    environmentValues.MAX_UPLOAD_BYTES,
    25 * 1024 * 1024,
    1,
    25 * 1024 * 1024,
  );
  const maxTemplateMigrationNodes = parseInteger(
    'MAX_TEMPLATE_MIGRATION_NODES',
    environmentValues.MAX_TEMPLATE_MIGRATION_NODES,
    10_000,
    1,
    10_000,
  );
  const cursorSecret =
    environmentValues.CURSOR_SECRET?.trim() || 'development-only-cursor-secret';
  const oidcAudience = environmentValues.OIDC_AUDIENCE?.trim() || undefined;
  const oidcIssuer = environmentValues.OIDC_ISSUER?.trim() || undefined;
  const oidcJwksUrl = environmentValues.OIDC_JWKS_URL?.trim() || undefined;
  if (
    environment === 'production' &&
    (!databaseUrl ||
      cursorSecret === 'development-only-cursor-secret' ||
      !oidcAudience ||
      !oidcIssuer ||
      !oidcJwksUrl)
  )
    throw new Error(
      'Production requires DATABASE_URL, CURSOR_SECRET, OIDC_ISSUER, OIDC_AUDIENCE, and OIDC_JWKS_URL.',
    );

  return {
    bodyLimitBytes,
    cursorSecret,
    databaseUrl,
    environment,
    host,
    jitProvisioning: parseBoolean(environmentValues.JIT_PROVISIONING, true),
    logLevel,
    maxPageSize,
    maxTemplateMigrationNodes,
    maxUploadBytes,
    oidcAudience,
    oidcIssuer,
    oidcJwksUrl,
    port,
    requiredScope: environmentValues.OIDC_REQUIRED_SCOPE?.trim() || undefined,
  };
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('Boolean configuration values must be true or false.');
}

function parseEnvironment(value: string | undefined): RuntimeEnvironment {
  const environment = value?.trim() || 'development';
  if (
    environment === 'development' ||
    environment === 'production' ||
    environment === 'test'
  ) {
    return environment;
  }

  throw new Error('NODE_ENV must be development, production, or test.');
}

function parseInteger(
  name: string,
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}.`,
    );
  }

  return parsed;
}

function parseDatabaseUrl(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const url = new URL(value);
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use the postgres or postgresql scheme.');
  }

  return value;
}

function parseLogLevel(value: string | undefined): RuntimeConfig['logLevel'] {
  const logLevel = value?.trim() || 'info';
  if (!isLogLevel(logLevel)) {
    const allowed = [
      'debug',
      'error',
      'fatal',
      'info',
      'silent',
      'trace',
      'warn',
    ];
    throw new Error(`LOG_LEVEL must be one of: ${allowed.join(', ')}.`);
  }

  return logLevel;
}

function isLogLevel(value: string): value is RuntimeConfig['logLevel'] {
  return [
    'debug',
    'error',
    'fatal',
    'info',
    'silent',
    'trace',
    'warn',
  ].includes(value);
}
