import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  ConfigStore,
  configFilePath,
} from '../src/configuration/config-store.js';
import { resolveConfig } from '../src/configuration/resolve-config.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe('configuration', () => {
  it('resolves command, environment, profile, and default precedence', () => {
    const config = resolveConfig(
      {
        activeProfile: 'work',
        profiles: {
          work: {
            output: 'table',
            server: 'https://profile.example',
            timeoutMs: 20_000,
          },
        },
        version: 1,
      },
      { output: 'json', server: 'https://command.example' },
      {
        GRAPHOPPER_OUTPUT: 'detail',
        GRAPHOPPER_SERVER: 'https://environment.example',
      },
    );

    expect(config.server).toBe('https://command.example');
    expect(config.output).toBe('json');
    expect(config.timeoutMs).toBe(20_000);
    expect(config.expectedApiVersion).toBe('v1');
    expect(config.sources).toMatchObject({
      output: 'command',
      server: 'command',
      timeoutMs: 'profile',
    });
  });

  it('permits HTTP only for loopback development servers', () => {
    expect(() =>
      resolveConfig(
        { activeProfile: 'default', profiles: { default: {} }, version: 1 },
        { server: 'http://example.com' },
        {},
      ),
    ).toThrowError(/HTTPS/u);
    expect(
      resolveConfig(
        { activeProfile: 'default', profiles: { default: {} }, version: 1 },
        { server: 'http://localhost:3000' },
        {},
      ).server,
    ).toBe('http://localhost:3000');
  });

  it('writes validated configuration atomically with user-only permissions', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'graphopper-config-'));
    temporaryDirectories.push(directory);
    const path = join(directory, 'nested', 'config.json');
    const store = new ConfigStore(path);
    await store.setProfile('production', {
      server: 'https://api.example.com',
    });
    await store.useProfile('production');

    expect(await store.load()).toMatchObject({
      activeProfile: 'production',
      profiles: { production: { server: 'https://api.example.com' } },
    });
    expect(JSON.parse(await readFile(path, 'utf8'))).toBeTruthy();
    if (process.platform !== 'win32')
      expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it('uses platform configuration conventions', () => {
    expect(
      configFilePath({ APPDATA: 'C:\\Users\\me\\AppData' }, 'win32'),
    ).toContain('Graphopper');
    expect(configFilePath({ XDG_CONFIG_HOME: '/config' }, 'linux')).toBe(
      '/config/graphopper/config.json',
    );
  });
});
