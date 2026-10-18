import { describe, expect, it } from 'vitest';

import { loadRuntimeConfig } from '../../src/configuration/runtime-config.js';

describe('loadRuntimeConfig', () => {
  it('provides safe local defaults without requiring secrets', () => {
    expect(loadRuntimeConfig({})).toEqual({
      bodyLimitBytes: 1_048_576,
      cursorSecret: 'development-only-cursor-secret',
      databaseUrl: undefined,
      environment: 'development',
      host: '127.0.0.1',
      jitProvisioning: true,
      logLevel: 'info',
      maxPageSize: 200,
      maxTemplateMigrationNodes: 10_000,
      maxUploadBytes: 25 * 1024 * 1024,
      oidcAudience: undefined,
      oidcIssuer: undefined,
      oidcJwksUrl: undefined,
      port: 3000,
      requiredScope: undefined,
    });
  });

  it('rejects invalid port and database values', () => {
    expect(() => loadRuntimeConfig({ PORT: '0' })).toThrow(/PORT/);
    expect(() =>
      loadRuntimeConfig({ DATABASE_URL: 'https://database.example' }),
    ).toThrow(/DATABASE_URL/);
  });
});
