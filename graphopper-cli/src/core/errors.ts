export const exitCodes = {
  success: 0,
  usage: 2,
  authentication: 3,
  access: 4,
  validation: 5,
  conflict: 6,
  network: 7,
  partial: 8,
  internal: 70,
  cancelled: 130,
} as const;

export type ExitCategory = keyof typeof exitCodes;

export interface CliErrorOptions {
  readonly category: ExitCategory;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;
  readonly cause?: unknown;
}

export class CliError extends Error {
  readonly category: ExitCategory;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | undefined;
  override readonly cause: unknown;

  constructor(message: string, options: CliErrorOptions) {
    super(message);
    this.name = 'CliError';
    this.category = options.category;
    this.code = options.code;
    this.details = options.details;
    this.requestId = options.requestId;
    this.cause = options.cause;
  }
}

export function toCliError(error: unknown): CliError {
  if (error instanceof CliError) return error;
  if (error instanceof Error && error.name === 'AbortError') {
    return new CliError('The operation was cancelled.', {
      category: 'cancelled',
      code: 'CANCELLED',
      cause: error,
    });
  }
  return new CliError('An unexpected client error occurred.', {
    category: 'internal',
    code: 'INTERNAL_ERROR',
    cause: error,
  });
}
