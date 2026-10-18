import { createRemoteJWKSet, jwtVerify } from 'jose';

import type { IdentityClaims } from '../../application/backend-store.js';
import { ApiError } from '../api/api-error.js';

export interface Authenticator {
  authenticate(token: string): Promise<IdentityClaims>;
}

export class OidcAuthenticator implements Authenticator {
  private readonly keys;

  constructor(
    private readonly issuer: string,
    private readonly audience: string,
    jwksUrl: string,
    private readonly requiredScope?: string,
  ) {
    this.keys = createRemoteJWKSet(new URL(jwksUrl));
  }

  async authenticate(token: string): Promise<IdentityClaims> {
    try {
      const { payload, protectedHeader } = await jwtVerify(token, this.keys, {
        audience: this.audience,
        issuer: this.issuer,
        requiredClaims: ['sub'],
      });
      if (protectedHeader.typ && protectedHeader.typ.toLowerCase() !== 'at+jwt')
        throw new Error('Unexpected token type.');
      if (
        this.requiredScope &&
        (typeof payload.scope !== 'string' ||
          !payload.scope.split(' ').includes(this.requiredScope))
      )
        throw new Error('Required scope is absent.');
      return {
        issuer: String(payload.iss),
        subject: String(payload.sub),
        ...(typeof payload.name === 'string'
          ? { displayName: payload.name }
          : {}),
        ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
      };
    } catch (cause: unknown) {
      throw new ApiError(
        401,
        'TOKEN_INVALID',
        'The bearer token is invalid or expired.',
        undefined,
        { cause },
      );
    }
  }
}

export class StaticAuthenticator implements Authenticator {
  constructor(
    private readonly identities: Readonly<Record<string, IdentityClaims>>,
  ) {}

  authenticate(token: string): Promise<IdentityClaims> {
    const claims = this.identities[token];
    if (!claims)
      return Promise.reject(
        new ApiError(
          401,
          'TOKEN_INVALID',
          'The bearer token is invalid or expired.',
        ),
      );
    return Promise.resolve(claims);
  }
}
