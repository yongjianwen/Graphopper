import type { EffectiveConfig } from '../configuration/types.js';
import { CliError } from '../core/errors.js';

export interface StoredCredential {
  readonly accessToken: string;
  readonly clientId?: string;
  readonly expiresAt?: number;
  readonly refreshToken?: string;
  readonly tokenEndpoint?: string;
}

export interface CredentialStorePort {
  delete(config: EffectiveConfig): Promise<boolean>;
  get(config: EffectiveConfig): Promise<StoredCredential | undefined>;
  set(config: EffectiveConfig, credential: StoredCredential): Promise<void>;
}

export class KeyringCredentialStore implements CredentialStorePort {
  async get(config: EffectiveConfig): Promise<StoredCredential | undefined> {
    try {
      const entry = await this.entry(config);
      const value = entry.getPassword();
      return value ? parseCredential(value) : undefined;
    } catch (error: unknown) {
      if (isMissingCredential(error)) return undefined;
      throw unavailable(error);
    }
  }

  async set(
    config: EffectiveConfig,
    credential: StoredCredential,
  ): Promise<void> {
    try {
      const entry = await this.entry(config);
      entry.setPassword(JSON.stringify(credential));
    } catch (error: unknown) {
      throw unavailable(error);
    }
  }

  async delete(config: EffectiveConfig): Promise<boolean> {
    try {
      const entry = await this.entry(config);
      return entry.deletePassword();
    } catch (error: unknown) {
      if (isMissingCredential(error)) return false;
      throw unavailable(error);
    }
  }

  private async entry(config: EffectiveConfig) {
    const { Entry } = await import('@napi-rs/keyring');
    return new Entry(
      'graphopper-cli',
      `${config.profileName}@${new URL(config.server).origin}`,
    );
  }
}

export class MemoryCredentialStore implements CredentialStorePort {
  private credential: StoredCredential | undefined;
  get(): Promise<StoredCredential | undefined> {
    return Promise.resolve(this.credential);
  }
  set(_config: EffectiveConfig, credential: StoredCredential): Promise<void> {
    this.credential = credential;
    return Promise.resolve();
  }
  delete(): Promise<boolean> {
    const existed = this.credential !== undefined;
    this.credential = undefined;
    return Promise.resolve(existed);
  }
}

function parseCredential(value: string): StoredCredential {
  const parsed: unknown = JSON.parse(value);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('accessToken' in parsed) ||
    typeof parsed.accessToken !== 'string'
  )
    throw new Error('Stored credential is invalid.');
  return parsed as StoredCredential;
}

function unavailable(cause: unknown): CliError {
  return new CliError(
    'The operating-system credential store is unavailable. Use GRAPHOPPER_TOKEN for this process.',
    { category: 'authentication', code: 'CREDENTIAL_STORE_UNAVAILABLE', cause },
  );
}

function isMissingCredential(error: unknown): boolean {
  return (
    error instanceof Error &&
    /not found|no entry|platform failure/i.test(error.message)
  );
}
