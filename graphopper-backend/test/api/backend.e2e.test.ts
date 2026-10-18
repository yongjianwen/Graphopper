import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/adapters/http/build-app.js';
import { MemoryBackendStore } from '../../src/application/backend-store.js';
import { loadRuntimeConfig } from '../../src/configuration/runtime-config.js';
import { StaticAuthenticator } from '../../src/modules/authentication/authenticator.js';

describe('backend API workflow', () => {
  const authenticator = new StaticAuthenticator({
    alice: {
      issuer: 'https://identity.test',
      subject: 'alice',
      displayName: 'Alice',
      email: 'alice@example.test',
    },
    bob: {
      issuer: 'https://identity.test',
      subject: 'bob',
      displayName: 'Bob',
    },
  });
  let store: MemoryBackendStore;
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    store = new MemoryBackendStore();
    app = buildApp({
      authenticator,
      config: loadRuntimeConfig({ NODE_ENV: 'test' }),
      store,
    });
    await app.ready();
  });
  afterEach(async () => app.close());

  it('requires authentication and provisions the current local user', async () => {
    const missing = await app.inject({ method: 'GET', url: '/v1/me' });
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toMatchObject({
      error: { code: 'AUTHENTICATION_REQUIRED' },
    });

    const current = await api('alice', 'GET', '/v1/me');
    expect(current.statusCode).toBe(200);
    expect(current.json()).toMatchObject({
      displayName: 'Alice',
      email: 'alice@example.test',
      status: 'active',
    });
    expect(current.body).not.toContain('subject');
    expect(current.body).not.toContain('issuer');
  });

  it('runs the graph, template, node, relationship, traversal, file, and deletion lifecycle', async () => {
    const created = await api('alice', 'POST', '/v1/graphs', {
      headers: { 'idempotency-key': 'create-family' },
      payload: {
        name: 'Family',
        templateFields: [
          { key: 'name', label: 'Name', dataType: 'text', required: true },
          { key: 'photo', label: 'Photo', dataType: 'file' },
        ],
      },
    });
    expect(created.statusCode).toBe(201);
    const graph = created.json<{ id: string }>();

    const exactRetry = await api('alice', 'POST', '/v1/graphs', {
      headers: { 'idempotency-key': 'create-family' },
      payload: {
        name: 'Family',
        templateFields: [
          { key: 'name', label: 'Name', dataType: 'text', required: true },
          { key: 'photo', label: 'Photo', dataType: 'file' },
        ],
      },
    });
    expect(exactRetry.json<{ id: string }>().id).toBe(graph.id);

    const templateResponse = await api(
      'alice',
      'GET',
      `/v1/graphs/${graph.id}/template`,
    );
    const template = templateResponse.json<{
      fields: Array<{ id: string; key: string }>;
    }>();
    const nameField = template.fields.find((field) => field.key === 'name')!;
    const photoField = template.fields.find((field) => field.key === 'photo')!;

    const first = await createNode(graph.id, nameField.id, 'Ada');
    const second = await createNode(graph.id, nameField.id, 'Grace');

    const relationshipResponse = await api(
      'alice',
      'POST',
      `/v1/graphs/${graph.id}/relationships`,
      {
        payload: {
          sourceNodeId: first.id,
          targetNodeId: second.id,
          type: 'KNOWS',
        },
      },
    );
    expect(relationshipResponse.statusCode).toBe(201);

    const traversal = await api(
      'alice',
      'GET',
      `/v1/graphs/${graph.id}/traversals?startNodeId=${first.id}&direction=outgoing&maxDepth=2`,
    );
    const traversalBody = traversal.json<{
      nodes: Array<{ id: string; depth: number }>;
      relationships: Array<{ type: string }>;
      truncated: boolean;
    }>();
    expect(
      traversalBody.nodes.find((node) => node.id === first.id)?.depth,
    ).toBe(0);
    expect(
      traversalBody.nodes.find((node) => node.id === second.id)?.depth,
    ).toBe(1);
    expect(traversalBody.relationships[0]?.type).toBe('KNOWS');
    expect(traversalBody.truncated).toBe(false);

    const pageOne = await api(
      'alice',
      'GET',
      `/v1/graphs/${graph.id}/nodes?limit=1`,
    );
    const page = pageOne.json<{
      items: unknown[];
      page: { hasMore: boolean; nextCursor: string };
    }>();
    expect(page.items).toHaveLength(1);
    expect(page.page.hasMore).toBe(true);
    const pageTwo = await api(
      'alice',
      'GET',
      `/v1/graphs/${graph.id}/nodes?limit=1&cursor=${encodeURIComponent(page.page.nextCursor)}`,
    );
    expect(pageTwo.json<{ items: unknown[] }>().items).toHaveLength(1);

    const authorization = await api(
      'alice',
      'POST',
      `/v1/graphs/${graph.id}/files`,
      {
        payload: {
          originalName: 'portrait.png',
          mediaType: 'image/png',
          sizeBytes: 3,
        },
      },
    );
    const upload = authorization.json<{ id: string; uploadUrl: string }>();
    const uploaded = await app.inject({
      method: 'PUT',
      url: new URL(upload.uploadUrl).pathname,
      headers: { 'content-type': 'image/png' },
      payload: Buffer.from('png'),
    });
    expect(uploaded.statusCode).toBe(204);
    expect(
      (
        await api(
          'alice',
          'POST',
          `/v1/graphs/${graph.id}/files/${upload.id}/complete`,
        )
      ).statusCode,
    ).toBe(200);

    const updatedNode = await api(
      'alice',
      'PATCH',
      `/v1/graphs/${graph.id}/nodes/${first.id}`,
      {
        headers: { 'if-match': '"1"' },
        payload: { values: { [photoField.id]: upload.id } },
      },
    );
    expect(updatedNode.statusCode).toBe(200);
    expect(updatedNode.json()).toMatchObject({
      values: { [nameField.id]: 'Ada', [photoField.id]: upload.id },
    });

    const download = await api(
      'alice',
      'GET',
      `/v1/graphs/${graph.id}/files/${upload.id}/download`,
    );
    const downloaded = await app.inject({
      method: 'GET',
      url: new URL(download.json<{ downloadUrl: string }>().downloadUrl)
        .pathname,
    });
    expect(downloaded.body).toBe('png');

    const stale = await api(
      'alice',
      'PATCH',
      `/v1/graphs/${graph.id}/nodes/${first.id}`,
      {
        headers: { 'if-match': '"1"' },
        payload: { values: { [nameField.id]: 'Changed' } },
      },
    );
    expect(stale.statusCode).toBe(412);
    expect(stale.json()).toMatchObject({
      error: { code: 'RESOURCE_VERSION_MISMATCH' },
    });

    const isolated = await api('bob', 'GET', `/v1/graphs/${graph.id}`);
    expect(isolated.statusCode).toBe(404);

    expect(
      (await api('alice', 'DELETE', `/v1/graphs/${graph.id}/nodes/${first.id}`))
        .statusCode,
    ).toBe(204);
    const relationships = await api(
      'alice',
      'GET',
      `/v1/graphs/${graph.id}/relationships`,
    );
    expect(relationships.json()).toMatchObject({ items: [] });

    expect(
      (await api('alice', 'DELETE', `/v1/graphs/${graph.id}`)).statusCode,
    ).toBe(204);
    expect(
      (await api('alice', 'DELETE', `/v1/graphs/${graph.id}`)).statusCode,
    ).toBe(204);
    expect(store.auditEvents().length).toBeGreaterThan(8);
  });

  it('rejects invalid node values, modified cursors, and idempotency-key reuse', async () => {
    const graph = (
      await api('alice', 'POST', '/v1/graphs', {
        headers: { 'idempotency-key': 'validation-graph' },
        payload: {
          name: 'Validation',
          templateFields: [
            {
              key: 'age',
              label: 'Age',
              dataType: 'integer',
              required: true,
              validationRules: { minimum: 0 },
            },
          ],
        },
      })
    ).json<{ id: string }>();
    const template = (
      await api('alice', 'GET', `/v1/graphs/${graph.id}/template`)
    ).json<{ fields: Array<{ id: string }> }>();
    const invalid = await api('alice', 'POST', `/v1/graphs/${graph.id}/nodes`, {
      payload: { values: { [template.fields[0]!.id]: -1 } },
    });
    expect(invalid.statusCode).toBe(422);
    expect(invalid.json()).toMatchObject({
      error: {
        code: 'NODE_VALUE_INVALID',
        details: [expect.objectContaining({ fieldId: template.fields[0]!.id })],
      },
    });

    const reused = await api('alice', 'POST', '/v1/graphs', {
      headers: { 'idempotency-key': 'validation-graph' },
      payload: { name: 'Different' },
    });
    expect(reused.statusCode).toBe(409);
    expect(reused.json()).toMatchObject({
      error: { code: 'IDEMPOTENCY_KEY_REUSED' },
    });

    const modified = await api(
      'alice',
      'GET',
      `/v1/graphs?cursor=${encodeURIComponent('tampered.cursor')}`,
    );
    expect(modified.statusCode).toBe(400);
  });

  it('requires the current graph version for template mutations', async () => {
    const graph = (
      await api('alice', 'POST', '/v1/graphs', {
        payload: { name: 'Versioned template' },
      })
    ).json<{ id: string }>();
    const payload = { key: 'name', label: 'Name', dataType: 'text' };

    const missing = await api(
      'alice',
      'POST',
      `/v1/graphs/${graph.id}/template/fields`,
      { payload },
    );
    expect(missing.statusCode).toBe(428);
    expect(missing.json()).toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });

    const accepted = await api(
      'alice',
      'POST',
      `/v1/graphs/${graph.id}/template/fields`,
      { headers: { 'if-match': '"1"' }, payload },
    );
    expect(accepted.statusCode).toBe(201);
  });

  async function createNode(graphId: string, fieldId: string, name: string) {
    const response = await api('alice', 'POST', `/v1/graphs/${graphId}/nodes`, {
      payload: { values: { [fieldId]: name } },
    });
    expect(response.statusCode).toBe(201);
    return response.json<{ id: string }>();
  }

  async function api(
    token: string,
    method: 'DELETE' | 'GET' | 'PATCH' | 'POST',
    url: string,
    options: {
      headers?: Record<string, string>;
      payload?: Record<string, unknown>;
    } = {},
  ) {
    return await app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${token}`, ...options.headers },
      ...(options.payload === undefined ? {} : { payload: options.payload }),
    });
  }
});
