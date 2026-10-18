import SwaggerParser from '@apidevtools/swagger-parser';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildApp } from '../../src/adapters/http/build-app.js';
import { loadRuntimeConfig } from '../../src/configuration/runtime-config.js';
import type { ErrorEnvelope } from '../../src/modules/api/error-envelope.js';

describe('API foundation', () => {
  it('fails closed when production startup has no durable store', () => {
    const config = loadRuntimeConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://graphopper:secret@database/graphopper',
      CURSOR_SECRET: 'production-cursor-secret',
      OIDC_ISSUER: 'https://identity.example.test',
      OIDC_AUDIENCE: 'graphopper',
      OIDC_JWKS_URL: 'https://identity.example.test/.well-known/jwks.json',
    });

    expect(() => buildApp({ config })).toThrow(
      'Production requires an explicitly configured durable BackendStore.',
    );
  });

  it('ships a valid OpenAPI 3.1 contract rooted at /v1', async () => {
    const contractPath = resolve(
      import.meta.dirname,
      '../../openapi/openapi.yaml',
    );
    const contract = await SwaggerParser.validate(contractPath);

    expect('openapi' in contract && contract.openapi).toBe('3.1.0');
    expect('servers' in contract && contract.servers).toContainEqual(
      expect.objectContaining({ url: '/v1' }),
    );
    expect(
      'components' in contract && contract.components?.schemas,
    ).toHaveProperty('ErrorEnvelope');
  });

  it('uses the non-disclosing error envelope for unknown resources', async () => {
    const app = buildApp({ config: loadRuntimeConfig({ NODE_ENV: 'test' }) });
    const response = await app.inject({
      method: 'GET',
      url: '/v1/private-resource',
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/json');
    const body = response.json<ErrorEnvelope>();
    expect(body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(body.error.message).toBe('The requested resource was not found.');
    expect(body.error.requestId).toEqual(expect.any(String));

    await app.close();
  });

  it('rejects unknown request properties instead of silently stripping them', async () => {
    const app = buildApp({ config: loadRuntimeConfig({ NODE_ENV: 'test' }) });
    app.post(
      '/v1/contract-probe',
      {
        schema: {
          body: {
            type: 'object',
            additionalProperties: false,
            required: ['name'],
            properties: { name: { type: 'string' } },
          },
        },
      },
      () => ({ accepted: true }),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/v1/contract-probe',
      payload: { name: 'graph', unexpected: true },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<ErrorEnvelope>();
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details).toEqual(expect.any(Array));
    expect(body.error.message).toBe('The request is invalid.');
    expect(body.error.requestId).toEqual(expect.any(String));

    await app.close();
  });
});
