import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { CliError } from '../core/errors.js';
import type { ConfigFile, Profile } from './types.js';

const defaultFile: ConfigFile = {
  activeProfile: 'default',
  profiles: { default: {} },
  version: 1,
};

export class ConfigStore {
  readonly path: string;

  constructor(path = configFilePath()) {
    this.path = path;
  }

  async load(): Promise<ConfigFile> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.path, 'utf8'));
      return validateConfigFile(parsed);
    } catch (error: unknown) {
      if (isMissingFile(error)) return defaultFile;
      if (error instanceof CliError) throw error;
      throw new CliError(`Cannot read configuration at ${this.path}.`, {
        category: 'usage',
        code: 'CONFIGURATION_INVALID',
        cause: error,
      });
    }
  }

  async save(config: ConfigFile): Promise<void> {
    const validated = validateConfigFile(config);
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.path}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
    await chmod(temporaryPath, 0o600).catch(() => undefined);
    await rename(temporaryPath, this.path);
  }

  async setProfile(name: string, patch: Partial<Profile>): Promise<ConfigFile> {
    validateProfileName(name);
    const current = await this.load();
    const next: ConfigFile = {
      ...current,
      profiles: {
        ...current.profiles,
        [name]: { ...current.profiles[name], ...patch },
      },
    };
    await this.save(next);
    return next;
  }

  async useProfile(name: string): Promise<ConfigFile> {
    validateProfileName(name);
    const current = await this.load();
    if (!(name in current.profiles)) {
      throw new CliError(`Profile '${name}' does not exist.`, {
        category: 'usage',
        code: 'PROFILE_NOT_FOUND',
      });
    }
    const next = { ...current, activeProfile: name };
    await this.save(next);
    return next;
  }
}

export function configFilePath(
  environment = process.env,
  platform = process.platform,
): string {
  if (environment.GRAPHOPPER_CONFIG_DIR)
    return join(environment.GRAPHOPPER_CONFIG_DIR, 'config.json');
  if (platform === 'win32') {
    return join(
      environment.APPDATA || join(homedir(), 'AppData', 'Roaming'),
      'Graphopper',
      'config.json',
    );
  }
  if (platform === 'darwin')
    return join(
      homedir(),
      'Library',
      'Application Support',
      'Graphopper',
      'config.json',
    );
  return join(
    environment.XDG_CONFIG_HOME || join(homedir(), '.config'),
    'graphopper',
    'config.json',
  );
}

export function validateProfileName(name: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(name)) {
    throw new CliError(
      'Profile names may contain letters, digits, underscores, and hyphens only.',
      {
        category: 'usage',
        code: 'PROFILE_NAME_INVALID',
      },
    );
  }
}

function validateConfigFile(value: unknown): ConfigFile {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.activeProfile !== 'string' ||
    !isRecord(value.profiles)
  ) {
    throw new CliError('The configuration file has an unsupported shape.', {
      category: 'usage',
      code: 'CONFIGURATION_INVALID',
    });
  }
  const profiles: Record<string, Profile> = {};
  for (const [name, profile] of Object.entries(value.profiles)) {
    validateProfileName(name);
    if (!isRecord(profile))
      throw new CliError(`Profile '${name}' is invalid.`, {
        category: 'usage',
        code: 'CONFIGURATION_INVALID',
      });
    profiles[name] = profile;
  }
  if (!(value.activeProfile in profiles))
    throw new CliError('The active profile does not exist.', {
      category: 'usage',
      code: 'CONFIGURATION_INVALID',
    });
  return { activeProfile: value.activeProfile, profiles, version: 1 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
