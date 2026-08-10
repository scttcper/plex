import type { LiteralUnion } from 'type-fest';

export type KnownPlexJwtScope =
  | 'username'
  | 'email'
  | 'friendly_name'
  | 'restricted'
  | 'anonymous'
  | 'joinedAt';

/** Known Plex JWT scopes, with support for scopes added by Plex later. */
export type PlexJwtScope = LiteralUnion<KnownPlexJwtScope, string>;

/** An Ed25519 private JWK used to refresh a Plex JWT. */
export interface PlexJwtPrivateKey {
  readonly kty: 'OKP';
  readonly crv: 'Ed25519';
  readonly x: string;
  readonly d: string;
}

/** Persist this secret object to refresh a Plex JWT without another account login. */
export interface PlexJwtCredentials {
  readonly clientIdentifier: string;
  readonly privateKey: PlexJwtPrivateKey;
  readonly scopes: readonly PlexJwtScope[];
  readonly token: string;
}

export interface PlexJwtUserClaims {
  readonly id: number;
  readonly uuid: string;
  readonly username?: string;
  readonly email?: string;
  readonly friendly_name?: string | null;
  readonly restricted?: boolean;
  readonly anonymous?: boolean;
  readonly joinedAt?: number;
}

/** Verified claims returned by Plex's JWT exchange endpoint. */
export interface PlexJwtClaims {
  readonly nonce: string;
  readonly thumbprint: string;
  readonly iss: 'plex.tv';
  readonly aud: readonly string[];
  readonly iat: number;
  readonly exp: number;
  readonly user: PlexJwtUserClaims;
}

export interface RegisterPlexJwtOptions {
  /** A Plex token issued for the same client identifier. */
  readonly token: string;
  readonly clientIdentifier: string;
  readonly scopes?: readonly PlexJwtScope[];
  /** Supply a persisted private JWK to reuse it; otherwise a new key is generated. */
  readonly privateKey?: PlexJwtPrivateKey;
  /** Request timeout in milliseconds. */
  readonly timeout?: number;
}

export interface RefreshPlexJwtOptions {
  readonly credentials: PlexJwtCredentials;
  readonly scopes?: readonly PlexJwtScope[];
  /** Request timeout in milliseconds. */
  readonly timeout?: number;
}

export interface VerifyPlexJwtOptions {
  readonly credentials: PlexJwtCredentials;
  /** Treat the JWT as invalid this many seconds before its expiration. Defaults to one day. */
  readonly refreshWithinSeconds?: number;
  /** Request timeout in milliseconds. */
  readonly timeout?: number;
}
