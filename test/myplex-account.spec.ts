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

  expect(Array.isArray(users)).toBe(true);
  expect(Array.isArray(sentInvites)).toBe(true);
  expect(Array.isArray(receivedInvites)).toBe(true);
});
