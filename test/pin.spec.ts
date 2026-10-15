import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, expect, it } from 'vitest';

import { MyPlexAccount } from '../src/myplex.ts';
import { MyPlexPinLogin } from '../src/pin.ts';

import { assertDefined } from './assertions.ts';
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
  await Promise.all(matchingDevices.map(async device => device.delete()));
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

it('lists and deletes a linked device through the JSON device APIs', async () => {
  const deviceIdentifier = `${clientIdentifierPrefix}${randomUUID()}`;
  const login = await MyPlexPinLogin.create({ clientIdentifier: deviceIdentifier, product });
  await account.linkPin(login);
  await login.wait({ pollInterval: 100, timeout: 5000 });

  const device = (await account.devices()).find(
    candidate => candidate.clientIdentifier === deviceIdentifier,
  );
  assertDefined(device);
  expect(device.product).toBe(product);
  expect(typeof device.id).toBe('number');
  expect(typeof device.presence).toBe('boolean');
  expect(typeof device.token).toBe('string');
  expect(device.createdAt).toBeInstanceOf(Date);
  expect(Number.isNaN(device.createdAt.getTime())).toBe(false);
  expect(Array.isArray(device.connections)).toBe(true);

  await device.delete();

  const remaining = (await account.devices()).filter(
    candidate => candidate.clientIdentifier === deviceIdentifier,
  );
  expect(remaining).toEqual([]);
}, 15_000);
