import { describe, expect, it } from 'vitest';

import { applicationModules } from '../../src/application/module-registry.js';

describe('application module registry', () => {
  it('declares every modular-monolith boundary once', () => {
    const names = applicationModules.map(({ name }) => name);

    expect(names).toEqual([
      'api',
      'authentication',
      'authorization',
      'users',
      'graphs',
      'templates',
      'nodes',
      'relationships',
      'query',
      'traversal',
      'files',
      'audit',
      'observability',
    ]);
    expect(new Set(names).size).toBe(names.length);
  });
});
