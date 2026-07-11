import { beforeAll, expect, it } from 'vitest';

import type { MovieSection } from '../src/library.ts';
import { MyPlexAccount, PlexUserState } from '../src/myplex.ts';
import type { PlexServer } from '../src/server.ts';
import type { Movie } from '../src/video.ts';

import { createAccount, createClient } from './test-client.ts';

let account: MyPlexAccount;
let plex: PlexServer;

beforeAll(async () => {
  account = await createAccount();
  plex = await createClient();
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
  const watchlist = await account.watchlist({ limit: 1 });
  const webhooks = await account.webhooks();
  const library = await plex.library();
  const movieSection = await library.section<MovieSection>('Movies');
  const [movie] = await movieSection.search<Movie>({ libtype: 'movie', maxresults: 1 });
  const userState = await account.userState(movie);

  expect(Array.isArray(users)).toBe(true);
  expect(Array.isArray(sentInvites)).toBe(true);
  expect(Array.isArray(receivedInvites)).toBe(true);
  expect(sharingSections.length).toBeGreaterThan(0);
  expect(typeof sharingSections[0].id).toBe('number');
  expect(typeof sharingSections[0].key).toBe('number');
  expect(typeof sharingSections[0].title).toBe('string');
  expect(typeof sharingSections[0].type).toBe('string');
  expect(Array.isArray(watchlist)).toBe(true);
  expect(Array.isArray(webhooks)).toBe(true);
  expect(userState).toBeInstanceOf(PlexUserState);
  expect(typeof userState.ratingKey).toBe('string');
  expect(typeof userState.viewCount).toBe('number');
  expect(typeof userState.viewOffset).toBe('number');
});
