import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, expect, it } from 'vitest';

import { MyPlexAccount } from '../src/myplex.ts';
import { MyPlexPinLogin } from '../src/pin.ts';

import { createAccount } from './test-client.ts';

const clientIdentifierPrefix = 'plex-ts-pin-test-';
const clientIdentifier = `${clientIdentifierPrefix}${randomUUID()}`;
const product = 'Plex TypeScript PIN Test';

let account: MyPlexAccount;

async function cleanupPinDevices(): Promise<void> {
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

beforeAll(async () => {
  account = await createAccount();
  await cleanupPinDevices();
});

afterAll(async () => {
  await cleanupPinDevices();
});

it('creates, resumes, links, and authenticates an OAuth PIN', async () => {
  const login = await MyPlexPinLogin.create({
    clientIdentifier,
    mode: 'oauth',
    product,
  });
  const pending = await login.check();
  const resumed = await MyPlexPinLogin.resume({
    id: login.id,
    clientIdentifier,
    mode: 'oauth',
    product,
  });
  const oauthUrl = login.oauthUrl({ forwardUrl: 'https://example.com/authenticated' });

  await account.linkPin(login);
  const authentication = await resumed.wait({ pollInterval: 100, timeout: 5000 });
  const authenticatedAccount = await new MyPlexAccount({ token: authentication.token }).connect();

  expect(login.clientIdentifier).toBe(clientIdentifier);
  expect(pending).toBeNull();
  expect(oauthUrl).toContain(`clientID=${encodeURIComponent(clientIdentifier)}`);
  expect(oauthUrl).toContain(`code=${encodeURIComponent(login.code)}`);
  expect(oauthUrl).toContain('forwardUrl=https%3A%2F%2Fexample.com%2Fauthenticated');
  expect(authentication.newRegistration).toBe(false);
  expect(authenticatedAccount.id).toBe(account.id);
  expect(resumed.token).toBe(authentication.token);
}, 10_000);
