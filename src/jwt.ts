import { ofetch } from 'ofetch';

import { decodeBase64Url, encodeBase64Url } from './base64.ts';
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
const encoder = new TextEncoder();
const decoder = new TextDecoder();
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

interface PlexJwtHeader {
  readonly alg: 'EdDSA';
  readonly kid: string;
  readonly typ?: 'JWT';
}

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
  const privateBytes = decodeBase64Url(privateKey.d);
  const publicBytes = decodeBase64Url(privateKey.x);
  const keyMaterial = new Uint8Array(privateBytes.length + publicBytes.length);
  keyMaterial.set(privateBytes);
  keyMaterial.set(publicBytes, privateBytes.length);
  const digest = await crypto.subtle.digest('SHA-256', keyMaterial);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
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
  const generated = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  if (!('privateKey' in generated)) {
    throw new BadRequest('Unable to generate an Ed25519 key pair.');
  }
  const privateJwk = await crypto.subtle.exportKey('jwk', generated.privateKey);
  if (!privateJwk.d || !privateJwk.x) {
    throw new Error('Web Crypto returned an incomplete Ed25519 private key.');
  }
  return {
    kty: 'OKP',
    crv: 'Ed25519',
    x: privateJwk.x,
    d: privateJwk.d,
  };
}

function decodeJson<T>(encoded: string, name: string): T {
  try {
    return JSON.parse(decoder.decode(decodeBase64Url(encoded))) as T;
  } catch {
    throw new Unauthorized(`Plex JWT ${name} is not valid base64url JSON.`);
  }
}

function parseHeader(encoded: string): PlexJwtHeader {
  const header = decodeJson<PlexJwtHeader>(encoded, 'header');
  if (
    header.alg !== 'EdDSA' ||
    typeof header.kid !== 'string' ||
    (header.typ !== undefined && header.typ !== 'JWT')
  ) {
    throw new Unauthorized('Plex JWT header is invalid.');
  }
  return header;
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
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    { ...client.privateKey, ext: true, key_ops: ['sign'] },
    'Ed25519',
    false,
    ['sign'],
  );
  const now = Math.floor(Date.now() / 1000);
  const header: PlexJwtHeader = {
    alg: 'EdDSA',
    typ: 'JWT',
    kid: await keyId(client.privateKey),
  };
  const payload = {
    nonce: await fetchNonce(client.clientIdentifier, timeout),
    scope: client.scopes.join(','),
    aud: 'plex.tv',
    iss: client.clientIdentifier,
    iat: now,
    exp: now + clientTokenLifetimeSeconds,
  };
  const signingInput = `${encodeBase64Url(encoder.encode(JSON.stringify(header)))}.${encodeBase64Url(encoder.encode(JSON.stringify(payload)))}`;
  const signature = await crypto.subtle.sign('Ed25519', privateKey, encoder.encode(signingInput));
  return `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;
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

  const parts = credentials.token.split('.');
  if (parts.length !== 3 || parts.some(part => part.length === 0)) {
    throw new Unauthorized('Plex JWT must contain three encoded segments.');
  }
  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  const header = parseHeader(encodedHeader);
  const keyResponse = await ofetch<PlexJwtKeysResponse>(`${AUTH_URL}/keys`, {
    headers: requestHeaders(credentials.clientIdentifier),
    timeout,
    retry: 0,
  });
  const signingKey = keyResponse.keys.find(key => key.kid === header.kid);
  if (!signingKey) {
    throw new Unauthorized(`Plex JWT signing key ${header.kid} is not published by Plex.`);
  }
  const verificationKey = await crypto.subtle.importKey(
    'jwk',
    { ...signingKey, ext: true, key_ops: ['verify'] },
    'Ed25519',
    false,
    ['verify'],
  );
  const validSignature = await crypto.subtle.verify(
    'Ed25519',
    verificationKey,
    decodeBase64Url(encodedSignature),
    encoder.encode(`${encodedHeader}.${encodedClaims}`),
  );
  if (!validSignature) {
    throw new Unauthorized('Plex JWT signature is invalid.');
  }

  const claims = decodeJson<PlexJwtClaims>(encodedClaims, 'payload');
  if (claims.iss !== 'plex.tv') {
    throw new Unauthorized('Plex JWT issuer is invalid.');
  }
  if (claims.thumbprint !== (await keyId(credentials.privateKey))) {
    throw new Unauthorized('Plex JWT was issued for a different key pair.');
  }
  if (!claims.aud.includes('plex.tv') || !claims.aud.includes(credentials.clientIdentifier)) {
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
