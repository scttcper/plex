import { randomUUID } from 'node:crypto';

import { ofetch } from 'ofetch';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { BASE_HEADERS } from '../src/config.ts';
import { refreshPlexJwt, registerPlexJwt, verifyPlexJwt } from '../src/jwt.ts';
import type { PlexJwtScope } from '../src/jwt.types.ts';
import { MyPlexAccount } from '../src/myplex.ts';

import { createAccount } from './test-client.ts';

const clientIdentifier = `plex-ts-jwt-test-${randomUUID()}`;
const scopes = ['username', 'email', 'friendly_name'] as const satisfies readonly PlexJwtScope[];

interface PlexPinResponse {
  readonly id: number;
  readonly code: string;
  readonly authToken: string | null;
}

let account: MyPlexAccount;
let bootstrapToken: string;

function pinHeaders(token?: string): Headers {
  const headers = new Headers(BASE_HEADERS);
  headers.set('Accept', 'application/json');
  headers.set('X-Plex-Client-Identifier', clientIdentifier);
  if (token) {
    headers.set('X-Plex-Token', token);
  }
  return headers;
}

async function cleanupJwtDevices(): Promise<void> {
  const devices = await account.devices();
  const matchingDevices = devices.filter(device => device.clientIdentifier === clientIdentifier);
  await Promise.all(
    matchingDevices.map(device =>
      account.query({ url: `https://plex.tv/devices/${device.id}.xml`, method: 'delete' }),
    ),
  );
}

async function createBootstrapToken(): Promise<string> {
  const pin = await ofetch<PlexPinResponse>('https://clients.plex.tv/api/v2/pins', {
    method: 'POST',
    headers: pinHeaders(),
    retry: 0,
  });
  const linkHeaders = pinHeaders(account.authenticationToken);
  linkHeaders.set('Content-Type', 'application/x-www-form-urlencoded');
  linkHeaders.set('X-Plex-Product', 'Plex SSO');
  await ofetch('https://plex.tv/api/v2/pins/link', {
    method: 'PUT',
    headers: linkHeaders,
    body: new URLSearchParams({ code: pin.code }),
    retry: 0,
  });
  const linkedPin = await ofetch<PlexPinResponse>(`https://clients.plex.tv/api/v2/pins/${pin.id}`, {
    headers: pinHeaders(),
    retry: 0,
  });
  if (!linkedPin.authToken) {
    throw new Error('Plex did not return a token for the linked JWT test device.');
  }
  return linkedPin.authToken;
}

beforeAll(async () => {
  account = await createAccount();
  await cleanupJwtDevices();
  bootstrapToken = await createBootstrapToken();
});

afterAll(async () => {
  await cleanupJwtDevices();
});

it('registers, verifies, refreshes, and authenticates with a Plex JWT', async () => {
  const credentials = await registerPlexJwt({
    token: bootstrapToken,
    clientIdentifier,
    scopes,
  });
  const claims = await verifyPlexJwt({ credentials });
  const refreshed = await refreshPlexJwt({ credentials: structuredClone(credentials) });
  const refreshedClaims = await verifyPlexJwt({ credentials: refreshed });
  const jwtAccount = await new MyPlexAccount({ token: refreshed.token }).connect();

  expect(credentials.scopes).toEqual(scopes);
  expect(credentials.privateKey.d).toHaveLength(43);
  expect(credentials.privateKey.x).toHaveLength(43);
  expect(claims.iss).toBe('plex.tv');
  expect(claims.aud).toContain('plex.tv');
  expect(claims.aud).toContain(clientIdentifier);
  expect(claims.thumbprint).toHaveLength(64);
  expect(claims.user.id).toBe(account.id);
  expect(claims.user.uuid).toBe(account.uuid);
  expect(claims.user.username).toBe(account.username);
  expect(claims.user.email).toBe(account.email);
  expect(claims.exp).toBeGreaterThan(claims.iat);
  expect(refreshed.token).not.toBe(credentials.token);
  expect(refreshedClaims.thumbprint).toBe(claims.thumbprint);
  expect(jwtAccount.id).toBe(account.id);
  expect(jwtAccount.username).toBe(account.username);
}, 20_000);
