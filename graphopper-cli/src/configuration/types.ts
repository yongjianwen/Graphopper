export type OutputFormat = 'detail' | 'id' | 'json' | 'table';

export interface Profile {
  readonly defaultGraph?: string;
  readonly expectedApiVersion?: string;
  readonly oidcClientId?: string;
  readonly oidcIssuer?: string;
  readonly oidcScopes?: readonly string[];
  readonly output?: OutputFormat;
  readonly server?: string;
  readonly timeoutMs?: number;
}

export interface ConfigFile {
  readonly activeProfile: string;
  readonly profiles: Readonly<Record<string, Profile>>;
  readonly version: 1;
}

export interface EffectiveConfig {
  readonly defaultGraph: string | undefined;
  readonly expectedApiVersion: string;
  readonly oidcClientId: string | undefined;
  readonly oidcIssuer: string | undefined;
  readonly oidcScopes: readonly string[];
  readonly output: OutputFormat;
  readonly profileName: string;
  readonly server: string;
  readonly sources: Readonly<
    Record<string, 'command' | 'default' | 'environment' | 'profile'>
  >;
  readonly timeoutMs: number;
}

export interface GlobalConfigOverrides {
  readonly output?: string;
  readonly profile?: string;
  readonly server?: string;
  readonly timeout?: string;
}
