import { beforeAll, expect, it } from 'vitest';

import type { MyPlexAccount } from '../src/myplex.ts';

import { createAccount } from './test-client.ts';

let account: MyPlexAccount;

beforeAll(async () => {
  account = await createAccount();
});

it('reads account users and pending invites from Plex XML endpoints', async () => {
  const users = await account.users();
  const sentInvites = await account.pendingInvites({ includeReceived: false });
  const receivedInvites = await account.pendingInvites({ includeSent: false });
  const resources = await account.resources();
  const serverResource = resources.find(resource =>
    resource.provides.split(',').includes('server'),
  );
  expect(serverResource).toBeDefined();
  const sharingSections = await account.sharingSections(serverResource!.clientIdentifier);

  expect(Array.isArray(users)).toBe(true);
  expect(Array.isArray(sentInvites)).toBe(true);
  expect(Array.isArray(receivedInvites)).toBe(true);
  expect(sharingSections.length).toBeGreaterThan(0);
  expect(typeof sharingSections[0].id).toBe('number');
  expect(typeof sharingSections[0].key).toBe('number');
  expect(typeof sharingSections[0].title).toBe('string');
  expect(typeof sharingSections[0].type).toBe('string');
});
