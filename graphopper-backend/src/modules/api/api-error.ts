import type { ErrorCode, ErrorDetail } from './error-envelope.js';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: readonly ErrorDetail[],
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ApiError';
  }
}
