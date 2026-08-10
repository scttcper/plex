import { createLocalJWKSet, exportJWK, generateKeyPair, importJWK, jwtVerify, SignJWT } from 'jose';
import { ofetch } from 'ofetch';
import { base64ToUint8Array, concatUint8Arrays, uint8ArrayToHex } from 'uint8array-extras';

import { BASE_HEADERS, TIMEOUT } from './config.ts';
import { BadRequest, Unauthorized } from './exceptions.ts';
import type {
  KnownPlexJwtScope,
  PlexJwtClaims,
  PlexJwtCredentials,
  PlexJwtPrivateKey,
  RefreshPlexJwtOptions,
  RegisterPlexJwtOptions,
  VerifyPlexJwtOptions,
} from './jwt.types.ts';

const AUTH_URL = 'https://clients.plex.tv/api/v2/auth';
const clientTokenLifetimeSeconds = 5 * 60;
const defaultRefreshWindowSeconds = 24 * 60 * 60;

export const PLEX_JWT_SCOPES = [
  'username',
  'email',
  'friendly_name',
  'restricted',
  'anonymous',
  'joinedAt',
] as const satisfies readonly KnownPlexJwtScope[];

interface PlexJwtNonceResponse {
  readonly nonce: string;
}

interface PlexJwtTokenResponse {
  readonly auth_token: string;
}

interface PlexJwtKeysResponse {
  readonly keys: PlexJwtPublicKey[];
}

interface PlexJwtPublicKey {
  readonly kty: 'OKP';
  readonly crv: 'Ed25519';
  readonly x: string;
  readonly use: 'sig';
  readonly alg: 'EdDSA';
  readonly kid: string;
}

type PlexJwtClient = Omit<PlexJwtCredentials, 'token'>;

function requestHeaders(clientIdentifier: string, token?: string): Headers {
  const headers = new Headers(BASE_HEADERS);
  headers.set('Accept', 'application/json');
  headers.set('Content-Type', 'application/json');
  headers.set('X-Plex-Client-Identifier', clientIdentifier);
  if (token) {
    headers.set('X-Plex-Token', token);
  }
  return headers;
}

async function keyId(privateKey: PlexJwtPrivateKey): Promise<string> {
  const keyMaterial = concatUint8Arrays([
    base64ToUint8Array(privateKey.d),
    base64ToUint8Array(privateKey.x),
  ]);
  const digest = await crypto.subtle.digest('SHA-256', keyMaterial);
  return uint8ArrayToHex(new Uint8Array(digest));
}

async function toPublicKey(privateKey: PlexJwtPrivateKey): Promise<PlexJwtPublicKey> {
  return {
    kty: privateKey.kty,
    crv: privateKey.crv,
    x: privateKey.x,
    use: 'sig',
    alg: 'EdDSA',
    kid: await keyId(privateKey),
  };
}

async function createPrivateKey(): Promise<PlexJwtPrivateKey> {
  const { privateKey } = await generateKeyPair('EdDSA', { extractable: true });
  const privateJwk = await exportJWK(privateKey);
  if (!privateJwk.d || !privateJwk.x) {
    throw new Error('Unable to export a complete Ed25519 private key.');
  }
  return {
    kty: 'OKP',
    crv: 'Ed25519',
    x: privateJwk.x,
    d: privateJwk.d,
  };
}

async function fetchNonce(clientIdentifier: string, timeout: number): Promise<string> {
  const response = await ofetch<PlexJwtNonceResponse>(`${AUTH_URL}/nonce`, {
    headers: requestHeaders(clientIdentifier),
    timeout,
    retry: 0,
  });
  return response.nonce;
}

async function clientJwt(client: PlexJwtClient, timeout: number): Promise<string> {
  const privateKey = await importJWK(client.privateKey, 'EdDSA');
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    nonce: await fetchNonce(client.clientIdentifier, timeout),
    scope: client.scopes.join(','),
  })
    .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT', kid: await keyId(client.privateKey) })
    .setAudience('plex.tv')
    .setIssuer(client.clientIdentifier)
    .setIssuedAt(now)
    .setExpirationTime(now + clientTokenLifetimeSeconds)
    .sign(privateKey);
}

async function exchange(client: PlexJwtClient, timeout: number): Promise<string> {
  const response = await ofetch<PlexJwtTokenResponse>(`${AUTH_URL}/token`, {
    method: 'POST',
    headers: requestHeaders(client.clientIdentifier),
    body: { jwt: await clientJwt(client, timeout) },
    timeout,
    retry: 0,
  });
  return response.auth_token;
}

/** Register an Ed25519 key and exchange it for an initial, verified Plex JWT. */
export async function registerPlexJwt({
  token,
  clientIdentifier,
  scopes = PLEX_JWT_SCOPES,
  privateKey: suppliedPrivateKey,
  timeout = TIMEOUT,
}: RegisterPlexJwtOptions): Promise<PlexJwtCredentials> {
  const privateKey = suppliedPrivateKey ?? (await createPrivateKey());
  await ofetch(`${AUTH_URL}/jwk`, {
    method: 'POST',
    headers: requestHeaders(clientIdentifier, token),
    body: { jwk: await toPublicKey(privateKey) },
    timeout,
    retry: 0,
  });
  const client: PlexJwtClient = { clientIdentifier, privateKey, scopes: [...scopes] };
  const credentials: PlexJwtCredentials = { ...client, token: await exchange(client, timeout) };
  await verifyPlexJwt({ credentials, refreshWithinSeconds: 0, timeout });
  return credentials;
}

/** Exchange persisted Plex JWT credentials for a fresh, verified token. */
export async function refreshPlexJwt({
  credentials,
  scopes = credentials.scopes,
  timeout = TIMEOUT,
}: RefreshPlexJwtOptions): Promise<PlexJwtCredentials> {
  const client: PlexJwtClient = {
    clientIdentifier: credentials.clientIdentifier,
    privateKey: credentials.privateKey,
    scopes: [...scopes],
  };
  const refreshedCredentials: PlexJwtCredentials = {
    ...client,
    token: await exchange(client, timeout),
  };
  await verifyPlexJwt({ credentials: refreshedCredentials, refreshWithinSeconds: 0, timeout });
  return refreshedCredentials;
}

/** Verify the Plex signature, identity claims, key thumbprint, audience, and expiration. */
export async function verifyPlexJwt({
  credentials,
  refreshWithinSeconds = defaultRefreshWindowSeconds,
  timeout = TIMEOUT,
}: VerifyPlexJwtOptions): Promise<PlexJwtClaims> {
  if (!Number.isFinite(refreshWithinSeconds) || refreshWithinSeconds < 0) {
    throw new BadRequest('refreshWithinSeconds must be a non-negative number.');
  }

  const keyResponse = await ofetch<PlexJwtKeysResponse>(`${AUTH_URL}/keys`, {
    headers: requestHeaders(credentials.clientIdentifier),
    timeout,
    retry: 0,
  });
  let claims: PlexJwtClaims;
  try {
    const verified = await jwtVerify<PlexJwtClaims>(
      credentials.token,
      createLocalJWKSet(keyResponse),
      {
        algorithms: ['EdDSA'],
        audience: credentials.clientIdentifier,
        issuer: 'plex.tv',
        requiredClaims: ['exp', 'iat', 'nonce', 'thumbprint', 'user'],
      },
    );
    claims = verified.payload;
  } catch {
    throw new Unauthorized('Plex JWT signature or claims are invalid.');
  }
  if (claims.thumbprint !== (await keyId(credentials.privateKey))) {
    throw new Unauthorized('Plex JWT was issued for a different key pair.');
  }
  if (!claims.aud.includes('plex.tv')) {
    throw new Unauthorized('Plex JWT audience does not include Plex and this client.');
  }
  const now = Math.floor(Date.now() / 1000);
  if (claims.iat > now + 60 || claims.exp <= claims.iat) {
    throw new Unauthorized('Plex JWT timestamps are invalid.');
  }
  const expiresAfter = now + refreshWithinSeconds;
  if (claims.exp <= expiresAfter) {
    throw new Unauthorized(`Plex JWT expires within ${refreshWithinSeconds} seconds.`);
  }
  return claims;
}
