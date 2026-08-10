import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, expect, it } from 'vitest';

import { refreshPlexJwt, registerPlexJwt, verifyPlexJwt } from '../src/jwt.ts';
import type { PlexJwtScope } from '../src/jwt.types.ts';
import { MyPlexAccount } from '../src/myplex.ts';
import { MyPlexPinLogin } from '../src/pin.ts';

import { createAccount } from './test-client.ts';

const clientIdentifierPrefix = 'plex-ts-jwt-test-';
const clientIdentifier = `${clientIdentifierPrefix}${randomUUID()}`;
const scopes = ['username', 'email', 'friendly_name'] as const satisfies readonly PlexJwtScope[];

let account: MyPlexAccount;
let bootstrapToken: string;

async function cleanupJwtDevices(): Promise<void> {
  const devices = await account.devices();
  const matchingDevices = devices.filter(device =>
    device.clientIdentifier.startsWith(clientIdentifierPrefix),
  );
  await Promise.all(
    matchingDevices.map(device =>
      account.query({ url: `https://plex.tv/devices/${device.id}.xml`, method: 'delete' }),
    ),
  );
}

async function createBootstrapToken(): Promise<string> {
  const login = await MyPlexPinLogin.create({ clientIdentifier });
  await account.linkPin(login);
  return (await login.wait({ pollInterval: 100, timeout: 5000 })).token;
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
