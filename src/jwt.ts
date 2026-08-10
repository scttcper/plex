import { ofetch } from 'ofetch';

import { decodeBase64Url, encodeBase64Url } from './base64.ts';
import { BASE_HEADERS, TIMEOUT } from './config.ts';
import { BadRequest, Unauthorized } from './exceptions.ts';
import type {
  KnownPlexJwtScope,
  PlexJwtClaims,
  PlexJwtCredentials,
  PlexJwtPrivateKey,
  PlexJwtPublicKey,
  PlexJwtScope,
  PlexJwtUserClaims,
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

function assertNonEmptyString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new BadRequest(`${name} must be a non-empty string.`);
  }
}

function validateScopes(scopes: readonly PlexJwtScope[]): void {
  if (scopes.length === 0) {
    throw new BadRequest('At least one Plex JWT scope is required.');
  }
  for (const scope of scopes) {
    assertNonEmptyString(scope, 'Plex JWT scope');
  }
}

function decodeKeyPart(value: string, name: string): Uint8Array {
  if (!/^[\w-]+$/.test(value)) {
    throw new BadRequest(`${name} must be base64url encoded.`);
  }
  const bytes = decodeBase64Url(value);
  if (bytes.length !== 32) {
    throw new BadRequest(`${name} must contain a 32-byte Ed25519 key.`);
  }
  return bytes;
}

async function keyId(privateKey: PlexJwtPrivateKey): Promise<string> {
  const privateBytes = decodeKeyPart(privateKey.d, 'privateKey.d');
  const publicBytes = decodeKeyPart(privateKey.x, 'privateKey.x');
  const keyMaterial = new Uint8Array(privateBytes.length + publicBytes.length);
  keyMaterial.set(privateBytes);
  keyMaterial.set(publicBytes, privateBytes.length);
  const digest = await crypto.subtle.digest('SHA-256', keyMaterial);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function validatePrivateKey(privateKey: PlexJwtPrivateKey): Promise<void> {
  if (
    privateKey.kty !== 'OKP' ||
    privateKey.crv !== 'Ed25519' ||
    privateKey.use !== 'sig' ||
    privateKey.alg !== 'EdDSA'
  ) {
    throw new BadRequest('privateKey must be an Ed25519 signing JWK.');
  }
  assertNonEmptyString(privateKey.kid, 'privateKey.kid');
  decodeKeyPart(privateKey.x, 'privateKey.x');
  const derivedKeyId = await keyId(privateKey);
  if (derivedKeyId !== privateKey.kid) {
    throw new BadRequest('The Plex JWT key ID does not match its key material.');
  }
}

function toPublicKey(privateKey: PlexJwtPrivateKey): PlexJwtPublicKey {
  return {
    kty: privateKey.kty,
    crv: privateKey.crv,
    x: privateKey.x,
    use: privateKey.use,
    alg: privateKey.alg,
    kid: privateKey.kid,
  };
}

async function createPrivateKey(): Promise<PlexJwtPrivateKey> {
  const generated = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  if (!('privateKey' in generated)) {
    throw new BadRequest('Unable to generate an Ed25519 key pair.');
  }
  const privateJwk = await crypto.subtle.exportKey('jwk', generated.privateKey);
  assertNonEmptyString(privateJwk.d, 'generated private key');
  assertNonEmptyString(privateJwk.x, 'generated public key');

  const provisionalPrivateKey: PlexJwtPrivateKey = {
    kty: 'OKP',
    crv: 'Ed25519',
    x: privateJwk.x,
    use: 'sig',
    alg: 'EdDSA',
    kid: 'pending',
    d: privateJwk.d,
  };
  return { ...provisionalPrivateKey, kid: await keyId(provisionalPrivateKey) };
}

function decodeJson(encoded: string, name: string): unknown {
  try {
    return JSON.parse(decoder.decode(decodeBase64Url(encoded))) as unknown;
  } catch {
    throw new Unauthorized(`Plex JWT ${name} is not valid base64url JSON.`);
  }
}

function isPlexJwtHeader(value: unknown): value is PlexJwtHeader {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const header = value as Partial<PlexJwtHeader>;
  return (
    header.alg === 'EdDSA' &&
    typeof header.kid === 'string' &&
    (header.typ === undefined || header.typ === 'JWT')
  );
}

function isPlexJwtUserClaims(value: unknown): value is PlexJwtUserClaims {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const user = value as Partial<PlexJwtUserClaims>;
  return (
    Number.isSafeInteger(user.id) &&
    typeof user.uuid === 'string' &&
    (user.username === undefined || typeof user.username === 'string') &&
    (user.email === undefined || typeof user.email === 'string') &&
    (user.friendly_name === undefined ||
      user.friendly_name === null ||
      typeof user.friendly_name === 'string') &&
    (user.restricted === undefined || typeof user.restricted === 'boolean') &&
    (user.anonymous === undefined || typeof user.anonymous === 'boolean') &&
    (user.joinedAt === undefined || Number.isSafeInteger(user.joinedAt))
  );
}

function isPlexJwtClaims(value: unknown): value is PlexJwtClaims {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const claims = value as Partial<PlexJwtClaims>;
  return (
    typeof claims.nonce === 'string' &&
    typeof claims.thumbprint === 'string' &&
    claims.iss === 'plex.tv' &&
    Array.isArray(claims.aud) &&
    claims.aud.every(audience => typeof audience === 'string') &&
    Number.isSafeInteger(claims.iat) &&
    Number.isSafeInteger(claims.exp) &&
    isPlexJwtUserClaims(claims.user)
  );
}

function parseHeader(encoded: string): PlexJwtHeader {
  const header = decodeJson(encoded, 'header');
  if (!isPlexJwtHeader(header)) {
    throw new Unauthorized('Plex JWT header is invalid.');
  }
  return header;
}

function parseClaims(encoded: string): PlexJwtClaims {
  const claims = decodeJson(encoded, 'payload');
  if (!isPlexJwtClaims(claims)) {
    throw new Unauthorized('Plex JWT claims are invalid.');
  }
  return claims;
}

async function fetchNonce(clientIdentifier: string, timeout: number): Promise<string> {
  const response = await ofetch<PlexJwtNonceResponse>(`${AUTH_URL}/nonce`, {
    headers: requestHeaders(clientIdentifier),
    timeout,
    retry: 0,
  });
  assertNonEmptyString(response?.nonce, 'Plex nonce');
  return response.nonce;
}

async function clientJwt(
  credentials: Pick<PlexJwtCredentials, 'clientIdentifier' | 'privateKey' | 'scopes'>,
  timeout: number,
): Promise<string> {
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    { ...credentials.privateKey, ext: true, key_ops: ['sign'] },
    'Ed25519',
    false,
    ['sign'],
  );
  const now = Math.floor(Date.now() / 1000);
  const header: PlexJwtHeader = {
    alg: 'EdDSA',
    typ: 'JWT',
    kid: credentials.privateKey.kid,
  };
  const payload = {
    nonce: await fetchNonce(credentials.clientIdentifier, timeout),
    scope: credentials.scopes.join(','),
    aud: 'plex.tv',
    iss: credentials.clientIdentifier,
    iat: now,
    exp: now + clientTokenLifetimeSeconds,
  };
  const signingInput = `${encodeBase64Url(encoder.encode(JSON.stringify(header)))}.${encodeBase64Url(encoder.encode(JSON.stringify(payload)))}`;
  const signature = await crypto.subtle.sign('Ed25519', privateKey, encoder.encode(signingInput));
  return `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;
}

async function exchange(
  credentials: Pick<PlexJwtCredentials, 'clientIdentifier' | 'privateKey' | 'scopes'>,
  timeout: number,
): Promise<string> {
  const response = await ofetch<PlexJwtTokenResponse>(`${AUTH_URL}/token`, {
    method: 'POST',
    headers: requestHeaders(credentials.clientIdentifier),
    body: { jwt: await clientJwt(credentials, timeout) },
    timeout,
    retry: 0,
  });
  assertNonEmptyString(response?.auth_token, 'Plex JWT exchange token');
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
  assertNonEmptyString(token, 'Plex token');
  assertNonEmptyString(clientIdentifier, 'Plex client identifier');
  validateScopes(scopes);
  const privateKey = suppliedPrivateKey ?? (await createPrivateKey());
  await validatePrivateKey(privateKey);
  await ofetch(`${AUTH_URL}/jwk`, {
    method: 'POST',
    headers: requestHeaders(clientIdentifier, token),
    body: { jwk: toPublicKey(privateKey) },
    timeout,
    retry: 0,
  });
  const tokenlessCredentials = { clientIdentifier, privateKey, scopes: [...scopes] };
  const jwtToken = await exchange(tokenlessCredentials, timeout);
  const credentials: PlexJwtCredentials = { ...tokenlessCredentials, token: jwtToken };
  await verifyPlexJwt({ credentials, refreshWithinSeconds: 0, timeout });
  return credentials;
}

/** Exchange persisted Plex JWT credentials for a fresh, verified token. */
export async function refreshPlexJwt({
  credentials,
  scopes = credentials.scopes,
  timeout = TIMEOUT,
}: RefreshPlexJwtOptions): Promise<PlexJwtCredentials> {
  assertNonEmptyString(credentials.clientIdentifier, 'Plex client identifier');
  validateScopes(scopes);
  await validatePrivateKey(credentials.privateKey);
  const refreshedCredentials: PlexJwtCredentials = {
    ...credentials,
    scopes: [...scopes],
    token: await exchange({ ...credentials, scopes }, timeout),
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
  assertNonEmptyString(credentials.clientIdentifier, 'Plex client identifier');
  assertNonEmptyString(credentials.token, 'Plex JWT');
  if (!Number.isFinite(refreshWithinSeconds) || refreshWithinSeconds < 0) {
    throw new BadRequest('refreshWithinSeconds must be a non-negative number.');
  }
  await validatePrivateKey(credentials.privateKey);

  const parts = credentials.token.split('.');
  if (parts.length !== 3 || parts.some(part => part.length === 0)) {
    throw new Unauthorized('Plex JWT must contain three encoded segments.');
  }
  const [encodedHeader, encodedClaims, encodedSignature] = parts as [string, string, string];
  const header = parseHeader(encodedHeader);
  const keyResponse = await ofetch<PlexJwtKeysResponse>(`${AUTH_URL}/keys`, {
    headers: requestHeaders(credentials.clientIdentifier),
    timeout,
    retry: 0,
  });
  if (!Array.isArray(keyResponse?.keys)) {
    throw new Unauthorized('Plex JWT key response is invalid.');
  }
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

  const claims = parseClaims(encodedClaims);
  if (claims.thumbprint !== credentials.privateKey.kid) {
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
