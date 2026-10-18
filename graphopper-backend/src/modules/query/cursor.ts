import { createHmac, timingSafeEqual } from 'node:crypto';

import { ApiError } from '../api/api-error.js';

interface CursorPayload {
  offset: number;
  signature: string;
  version: 1;
}

export function page<T>(
  values: readonly T[],
  requestedLimit: unknown,
  cursor: unknown,
  signature: string,
  secret: string,
  maximum: number,
): { items: T[]; page: { hasMore: boolean; nextCursor: string | null } } {
  const limit = parseLimit(requestedLimit, maximum);
  const offset =
    cursor === undefined ? 0 : decodeCursor(cursor, signature, secret);
  const items = values.slice(offset, offset + limit);
  const hasMore = offset + items.length < values.length;
  return {
    items,
    page: {
      hasMore,
      nextCursor: hasMore
        ? encodeCursor(
            { offset: offset + items.length, signature, version: 1 },
            secret,
          )
        : null,
    },
  };
}

function parseLimit(value: unknown, maximum: number): number {
  if (value === undefined) return Math.min(50, maximum);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum)
    throw new ApiError(
      400,
      'QUERY_LIMIT_EXCEEDED',
      `limit must be between 1 and ${maximum}.`,
    );
  return parsed;
}

function encodeCursor(payload: CursorPayload, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data, secret)}`;
}

function decodeCursor(
  value: unknown,
  signature: string,
  secret: string,
): number {
  if (typeof value !== 'string' || value.length > 2_000) invalid();
  const [data, suppliedMac, extra] = value.split('.');
  if (!data || !suppliedMac || extra) invalid();
  const expectedMac = sign(data, secret);
  const left = Buffer.from(suppliedMac);
  const right = Buffer.from(expectedMac);
  if (left.length !== right.length || !timingSafeEqual(left, right)) invalid();
  try {
    const payload = JSON.parse(
      Buffer.from(data, 'base64url').toString('utf8'),
    ) as CursorPayload;
    if (
      payload.version !== 1 ||
      payload.signature !== signature ||
      !Number.isSafeInteger(payload.offset) ||
      payload.offset < 0
    )
      invalid();
    return payload.offset;
  } catch {
    invalid();
  }
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function invalid(): never {
  throw new ApiError(
    400,
    'VALIDATION_FAILED',
    'The pagination cursor is invalid or incompatible.',
  );
}
