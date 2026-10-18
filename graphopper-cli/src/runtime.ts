import type { Readable, Writable } from 'node:stream';

import { AuthService } from './authentication/auth-service.js';
import {
  KeyringCredentialStore,
  type CredentialStorePort,
} from './authentication/credential-store.js';
import {
  BackendClient,
  type BackendPort,
  type FetchPort,
} from './backend/backend-client.js';
import { ConfigStore } from './configuration/config-store.js';
import { resolveConfig } from './configuration/resolve-config.js';
import type {
  EffectiveConfig,
  GlobalConfigOverrides,
  OutputFormat,
} from './configuration/types.js';
import { Presenter } from './presentation/presenter.js';
import { cliVersion } from './version.js';

export interface GlobalOptions extends GlobalConfigOverrides {
  readonly jsonErrors?: boolean;
  readonly noColor?: boolean;
  readonly nonInteractive?: boolean;
  readonly quiet?: boolean;
  readonly verbose?: boolean;
  readonly yes?: boolean;
}

export interface RuntimeOptions {
  readonly configStore?: ConfigStore;
  readonly credentialStore?: CredentialStorePort;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly fetcher?: FetchPort;
  readonly signal?: AbortSignal;
  readonly stderr?: Writable;
  readonly stdin?: Readable;
  readonly stdout?: Writable;
}

export interface Invocation {
  readonly auth: AuthService;
  readonly backend: BackendPort;
  readonly config: EffectiveConfig;
  readonly format: OutputFormat;
  readonly global: GlobalOptions;
  readonly interactive: boolean;
  readonly presenter: Presenter;
  readonly signal: AbortSignal | undefined;
  readonly stderr: Writable;
  readonly stdin: Readable;
  readonly stdout: Writable;
}

export class Runtime {
  readonly configStore: ConfigStore;
  readonly credentialStore: CredentialStorePort;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly fetcher: FetchPort;
  readonly signal: AbortSignal | undefined;
  readonly stderr: Writable;
  readonly stdin: Readable;
  readonly stdout: Writable;

  constructor(options: RuntimeOptions = {}) {
    this.configStore = options.configStore ?? new ConfigStore();
    this.credentialStore =
      options.credentialStore ?? new KeyringCredentialStore();
    this.environment = options.environment ?? process.env;
    this.fetcher = options.fetcher ?? fetch;
    this.signal = options.signal;
    this.stderr = options.stderr ?? process.stderr;
    this.stdin = options.stdin ?? process.stdin;
    this.stdout = options.stdout ?? process.stdout;
  }

  async invocation(global: GlobalOptions): Promise<Invocation> {
    const file = await this.configStore.load();
    const config = resolveConfig(file, global, this.environment);
    const presenter = new Presenter({
      stdout: this.stdout,
      stderr: this.stderr,
      quiet: global.quiet,
      verbose: global.verbose,
    });
    presenter.diagnostic(
      `graphopper-cli/${cliVersion} ${process.platform}/${process.arch} profile=${config.profileName} server=${new URL(config.server).origin} api=${config.expectedApiVersion}`,
    );
    const auth = new AuthService(
      config,
      this.credentialStore,
      presenter,
      this.fetcher,
      this.environment,
    );
    const backend = new BackendClient(config, () => auth.token(), this.fetcher);
    const inputTty = 'isTTY' in this.stdin && this.stdin.isTTY === true;
    const errorTty = 'isTTY' in this.stderr && this.stderr.isTTY === true;
    const interactive = global.nonInteractive !== true && inputTty && errorTty;
    return {
      auth,
      backend,
      config,
      format: config.output,
      global,
      interactive,
      presenter,
      signal: this.signal,
      stderr: this.stderr,
      stdin: this.stdin,
      stdout: this.stdout,
    };
  }
}
