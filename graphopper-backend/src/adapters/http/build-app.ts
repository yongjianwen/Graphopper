import Fastify, {
  type FastifyInstance,
  type FastifySchemaValidationError,
} from 'fastify';

import type { RuntimeConfig } from '../../configuration/runtime-config.js';
import {
  MemoryBackendStore,
  type BackendStore,
} from '../../application/backend-store.js';
import { ApiError } from '../../modules/api/api-error.js';
import {
  createErrorEnvelope,
  type ErrorDetail,
} from '../../modules/api/error-envelope.js';
import {
  OidcAuthenticator,
  StaticAuthenticator,
  type Authenticator,
} from '../../modules/authentication/authenticator.js';
import { registerRoutes } from './register-routes.js';

export interface BuildAppOptions {
  readonly config: RuntimeConfig;
  readonly authenticator?: Authenticator;
  readonly logger?: boolean;
  readonly store?: BackendStore;
}

export function buildApp({
  config,
  authenticator = defaultAuthenticator(config),
  logger = config.environment !== 'test',
  store,
}: BuildAppOptions): FastifyInstance {
  const selectedStore = store ?? defaultStore(config);
  const app = Fastify({
    ajv: {
      customOptions: {
        allErrors: false,
        coerceTypes: false,
        removeAdditional: false,
      },
    },
    bodyLimit: config.bodyLimitBytes,
    logger:
      logger && config.logLevel !== 'silent'
        ? {
            level: config.logLevel,
            redact: ['req.headers.authorization', 'req.headers.cookie'],
          }
        : false,
    requestIdHeader: 'x-request-id',
  });

  app.addContentTypeParser(
    [
      'application/octet-stream',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ],
    { parseAs: 'buffer' },
    (_request, body, done) => done(null, body),
  );

  app.addHook('onSend', async (_request, reply, payload) => {
    void reply.header('x-graphopper-api-version', 'v1');
    return payload;
  });

  app.setNotFoundHandler((request, reply) => {
    void reply
      .code(404)
      .type('application/json')
      .send(
        createErrorEnvelope(
          request.id,
          'RESOURCE_NOT_FOUND',
          'The requested resource was not found.',
        ),
      );
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      void reply
        .code(error.status)
        .type('application/json')
        .send(
          createErrorEnvelope(
            request.id,
            error.code,
            error.message,
            error.details,
          ),
        );
      return;
    }
    if (hasStatusCode(error, 415)) {
      void reply
        .code(415)
        .type('application/json')
        .send(
          createErrorEnvelope(
            request.id,
            'CONTENT_TYPE_UNSUPPORTED',
            'The request content type is not supported.',
          ),
        );
      return;
    }
    if (hasStatusCode(error, 413)) {
      void reply
        .code(413)
        .type('application/json')
        .send(
          createErrorEnvelope(
            request.id,
            'VALIDATION_FAILED',
            'The request body exceeds the configured size limit.',
          ),
        );
      return;
    }
    if (isValidationError(error)) {
      const details: ErrorDetail[] = error.validation.map((issue) => ({
        path: issue.instancePath || issue.schemaPath,
        reason: issue.message ?? 'The request is invalid.',
      }));

      void reply
        .code(400)
        .type('application/json')
        .send(
          createErrorEnvelope(
            request.id,
            'VALIDATION_FAILED',
            'The request is invalid.',
            details,
          ),
        );
      return;
    }

    request.log.error({ err: error }, 'Unhandled request error');
    void reply
      .code(500)
      .type('application/json')
      .send(
        createErrorEnvelope(
          request.id,
          'INTERNAL_ERROR',
          'An unexpected error occurred.',
        ),
      );
  });

  registerRoutes({ app, authenticator, config, store: selectedStore });

  return app;
}

function defaultStore(config: RuntimeConfig): BackendStore {
  if (config.environment === 'production')
    throw new Error(
      'Production requires an explicitly configured durable BackendStore.',
    );
  return new MemoryBackendStore();
}

function defaultAuthenticator(config: RuntimeConfig): Authenticator {
  if (config.oidcIssuer && config.oidcAudience && config.oidcJwksUrl)
    return new OidcAuthenticator(
      config.oidcIssuer,
      config.oidcAudience,
      config.oidcJwksUrl,
      config.requiredScope,
    );
  return new StaticAuthenticator({});
}

function isValidationError(
  error: unknown,
): error is Error & { validation: FastifySchemaValidationError[] } {
  return (
    error instanceof Error &&
    'validation' in error &&
    Array.isArray((error as { validation?: unknown }).validation)
  );
}

function hasStatusCode(
  error: unknown,
  expectedStatusCode: number,
): error is { statusCode: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    error.statusCode === expectedStatusCode
  );
}
