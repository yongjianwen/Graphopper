import { buildApp } from './adapters/http/build-app.js';
import { loadRuntimeConfig } from './configuration/runtime-config.js';

const config = loadRuntimeConfig();
const app = buildApp({ config });

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error: unknown) {
  app.log.fatal({ err: error }, 'Application failed to start');
  process.exitCode = 1;
}
