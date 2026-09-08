import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, expect, it } from 'vitest';

import {
  type Collections,
  type Movie,
  type MovieSection,
  type Playlist,
  type PlexServer,
} from '../src/index.ts';

import { createClient } from './test-client.ts';

const prefix = '__api_parity_test__';
const runPrefix = `${prefix}${randomUUID()}_`;
let server: PlexServer;
let section: MovieSection;
let collection: Collections<Movie>;
let playlist: Playlist;

async function cleanup(): Promise<void> {
  if (!section) {
    return;
  }
  for (const item of (await section.collections()).filter(candidate =>
    candidate.title.startsWith(prefix),
  )) {
    await item.delete();
  }
  for (const item of (await server.playlists()).filter(candidate =>
    candidate.title.startsWith(prefix),
  )) {
    await item.delete();
  }
}

beforeAll(async () => {
  server = await createClient();
  section = await (await server.library()).section<MovieSection>('Movies');
  await cleanup();
  const [movie] = await section.all();
  expect(movie).toBeDefined();
  collection = await server.createCollection(`${runPrefix}collection`, { section, items: [movie] });
  playlist = await server.createPlaylist(`${runPrefix}playlist`, { items: [movie] });
});

afterAll(cleanup);

it('batches typed metadata edits on a temporary collection', async () => {
  await collection.editFields({
    title: `${runPrefix}collection_edited`,
    summary: 'Temporary summary',
  });
  await collection.reload();
  expect(collection.title).toBe(`${runPrefix}collection_edited`);
  expect(collection.summary).toBe('Temporary summary');
});

it('edits playlist fields through the playlist endpoint and clears a summary', async () => {
  await playlist.editFields({ title: `${runPrefix}playlist_edited`, summary: 'Temporary summary' });
  await playlist.reload();
  expect(playlist.title).toBe(`${runPrefix}playlist_edited`);
  expect(playlist.summary).toBe('Temporary summary');
  await playlist.editFields({ summary: '' });
  await playlist.reload();
  expect(playlist.summary).toBe('');
});

it('creates and removes managed visibility for a temporary collection', async () => {
  const hub = await collection.visibility();
  await hub.updateVisibility({ recommended: false, home: false, shared: false });
  await hub.reload();
  expect(hub.identifier).toBe(`custom.collection.${section.key}.${collection.ratingKey}`);
  expect(hub.promotedToRecommended).toBe(false);
  await hub.remove();
});

it('preserves collection labels when adding and removing tags', async () => {
  await collection.editTags({ tag: 'label', items: ['Keep, & preserve'] });
  await collection.editTags({ tag: 'label', items: ['Another label'] });
  expect(collection.labels.map(label => label.tag).sort()).toEqual([
    'Another label',
    'Keep, & preserve',
  ]);
  await collection.editTags({ tag: 'label', items: ['Keep, & preserve'], remove: true });
  expect(collection.labels.map(label => label.tag)).toEqual(['Another label']);
});
