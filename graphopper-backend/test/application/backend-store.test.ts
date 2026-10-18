import { describe, expect, it } from 'vitest';

import { MemoryBackendStore } from '../../src/application/backend-store.js';

describe('MemoryBackendStore transaction semantics', () => {
  it('versions nodes rewritten by template migrations', () => {
    const store = new MemoryBackendStore();
    const user = store.resolveUser(
      { issuer: 'https://identity.test', subject: 'alice' },
      true,
    );
    const graph = store.createGraph(
      user.id,
      { name: 'People' },
      'create-graph',
    );
    const node = store.createNode(user.id, graph.id, {}, 'create-node');

    const field = store.addField(
      user.id,
      graph.id,
      {
        key: 'name',
        label: 'Name',
        dataType: 'text',
        required: true,
        defaultValue: 'Unknown',
      },
      graph.version,
      'add-required-field',
      100,
    );

    expect(store.findNode(user.id, graph.id, node.id)).toMatchObject({
      templateVersion: 1,
      values: { [field.id]: 'Unknown' },
      version: 2,
    });
  });

  it('validates a changed field default even when the graph is empty', () => {
    const store = new MemoryBackendStore();
    const user = store.resolveUser(
      { issuer: 'https://identity.test', subject: 'alice' },
      true,
    );
    const graph = store.createGraph(
      user.id,
      {
        name: 'People',
        templateFields: [{ key: 'age', label: 'Age', dataType: 'integer' }],
      },
      'create-graph',
    );

    expect(() =>
      store.updateField(
        user.id,
        graph.id,
        graph.fields[0]!.id,
        { defaultValue: 'not-an-integer' },
        graph.version,
        'invalid-default',
        100,
      ),
    ).toThrow();
    expect(
      store.findGraph(user.id, graph.id)?.fields[0]?.defaultValue,
    ).toBeUndefined();
  });

  it('does not partially update a node when file authorization fails', () => {
    const store = new MemoryBackendStore();
    const user = store.resolveUser(
      { issuer: 'https://identity.test', subject: 'alice' },
      true,
    );
    const graph = store.createGraph(
      user.id,
      {
        name: 'Files',
        templateFields: [{ key: 'photo', label: 'Photo', dataType: 'file' }],
      },
      'create-graph',
    );
    const field = graph.fields[0]!;
    const file = readyFile(store, user.id, graph.id, 'first.png');
    const node = store.createNode(
      user.id,
      graph.id,
      { [field.id]: file.id },
      'create-node',
    );

    expect(() =>
      store.updateNode(
        user.id,
        graph.id,
        node.id,
        { [field.id]: '018f3d7e-67f2-7aa1-b8ad-5d72b13a4101' },
        node.version,
        'invalid-update',
      ),
    ).toThrow();

    expect(store.findNode(user.id, graph.id, node.id)?.values).toEqual({
      [field.id]: file.id,
    });
    expect(() =>
      store.deleteFile(user.id, graph.id, file.id, 'delete-referenced'),
    ).toThrow();
  });

  it('only schedules files orphaned by the current mutation', () => {
    const store = new MemoryBackendStore();
    const user = store.resolveUser(
      { issuer: 'https://identity.test', subject: 'alice' },
      true,
    );
    const graph = store.createGraph(
      user.id,
      {
        name: 'Files',
        templateFields: [{ key: 'photo', label: 'Photo', dataType: 'file' }],
      },
      'create-graph',
    );
    const field = graph.fields[0]!;
    const referenced = readyFile(store, user.id, graph.id, 'used.png');
    const unrelated = readyFile(store, user.id, graph.id, 'unused.png');
    const node = store.createNode(
      user.id,
      graph.id,
      { [field.id]: referenced.id },
      'create-node',
    );

    const updated = store.updateNode(
      user.id,
      graph.id,
      node.id,
      { [field.id]: null },
      node.version,
      'remove-file',
    );

    expect(updated.values).toEqual({});
    expect(store.findFile(user.id, graph.id, referenced.id)?.state).toBe(
      'deletion_pending',
    );
    expect(store.findFile(user.id, graph.id, unrelated.id)?.state).toBe(
      'ready',
    );
  });

  it('rejects uploaded bytes whose checksum differs from the authorization', () => {
    const store = new MemoryBackendStore();
    const user = store.resolveUser(
      { issuer: 'https://identity.test', subject: 'alice' },
      true,
    );
    const graph = store.createGraph(user.id, { name: 'Files' }, 'create-graph');
    const file = store.createFile(
      user.id,
      graph.id,
      {
        originalName: 'file.png',
        mediaType: 'image/png',
        sizeBytes: 3,
        checksum: 'not-the-real-sha256',
      },
      'authorize-file',
      1024,
    );

    expect(() =>
      store.uploadFile(file.uploadToken, Buffer.from('png'), 'image/png'),
    ).toThrow();
    expect(store.findFile(user.id, graph.id, file.id)?.state).toBe('rejected');
  });
});

function readyFile(
  store: MemoryBackendStore,
  userId: string,
  graphId: string,
  name: string,
) {
  const file = store.createFile(
    userId,
    graphId,
    { originalName: name, mediaType: 'image/png', sizeBytes: 3 },
    `authorize-${name}`,
    1024,
  );
  store.uploadFile(file.uploadToken, Buffer.from('png'), 'image/png');
  return store.completeFile(userId, graphId, file.id, `complete-${name}`);
}
