export const errorCodes = [
  'AUTHENTICATION_REQUIRED',
  'TOKEN_INVALID',
  'RESOURCE_NOT_FOUND',
  'VALIDATION_FAILED',
  'NODE_VALUE_INVALID',
  'TEMPLATE_CONFLICT',
  'TEMPLATE_MIGRATION_TOO_LARGE',
  'RESOURCE_VERSION_MISMATCH',
  'QUERY_LIMIT_EXCEEDED',
  'FILE_NOT_READY',
  'RATE_LIMITED',
  'IDEMPOTENCY_KEY_REUSED',
  'CONTENT_TYPE_UNSUPPORTED',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof errorCodes)[number];

export interface ErrorDetail {
  readonly fieldId?: string;
  readonly path?: string;
  readonly reason: string;
}

export interface ErrorEnvelope {
  readonly error: {
    readonly code: ErrorCode;
    readonly details?: readonly ErrorDetail[];
    readonly message: string;
    readonly requestId: string;
  };
}

export function createErrorEnvelope(
  requestId: string,
  code: ErrorCode,
  message: string,
  details?: readonly ErrorDetail[],
): ErrorEnvelope {
  return {
    error: {
      code,
      ...(details === undefined ? {} : { details }),
      message,
      requestId,
    },
  };
}
