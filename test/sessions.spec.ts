import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, expect, it } from 'vitest';

import { Movie, type MovieSection, type PlexServer } from '../src/index.ts';

import { createClient } from './test-client.ts';

const clientIdentifier = `plex-typescript-test-${randomUUID()}`;
const timelineHeaders = {
  'X-Plex-Client-Identifier': clientIdentifier,
  'X-Plex-Device': 'Node.js',
  'X-Plex-Device-Name': 'Plex TypeScript Session Test',
  'X-Plex-Platform': 'Node.js',
  'X-Plex-Product': 'Plex TypeScript Tests',
  'X-Plex-Session-Identifier': clientIdentifier,
};

let movie: Movie;
let plex: PlexServer;

async function updateTimeline(state: 'playing' | 'stopped'): Promise<void> {
  const params = new URLSearchParams({
    duration: movie.duration.toString(),
    identifier: 'com.plexapp.plugins.library',
    key: movie.key,
    ratingKey: movie.ratingKey,
    state,
    time: '1000',
  });
  await plex.query({
    headers: timelineHeaders,
    method: 'post',
    path: `/:/timeline?${params.toString()}`,
  });
}

beforeAll(async () => {
  plex = await createClient();
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  [movie] = await section.search({ title: 'Bunny' });
  await updateTimeline('playing');
});

afterAll(async () => {
  await updateTimeline('stopped');
});

it('hydrates active playback sessions as playable media', async () => {
  const sessions = await plex.sessions();
  const session = sessions.find(item => item.player.machineIdentifier === clientIdentifier);

  expect(session).toBeInstanceOf(Movie);
  expect(session?.live).toBe(false);
  expect(session?.player.machineIdentifier).toBe(clientIdentifier);
  expect(session?.player.state).toBe('playing');
  expect(session?.player.title).toBe('Plex TypeScript Session Test');
  expect(session?.players).toEqual([session?.player]);
  expect(session?.sessions).toEqual([]);
  expect(session?.ratingKey).toBe(movie.ratingKey);
  expect(typeof session?.sessionKey).toBe('number');
  expect(session?.transcodeSessions).toEqual([]);
  expect(typeof session?.user.id).toBe('number');
  expect(typeof session?.user.title).toBe('string');
  expect(session?.usernames).toEqual([session?.user.title]);
});
