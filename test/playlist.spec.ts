import { afterEach, beforeAll, expect, it } from 'vitest';

import { type Movie, type MovieSection, Playlist, type PlexServer } from '../src/index.js';

import { createClient } from './test-client.js';

let plex: PlexServer;
let playlist: Playlist | undefined;
let buckBunny: Movie;
let ghostbusters: Movie;

beforeAll(async () => {
  plex = await createClient();
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  [buckBunny] = await section.search({ title: 'Bunny' });
  [ghostbusters] = await section.search({ title: 'Ghostbusters' });
  // biome-ignore lint/suspicious/noMisplacedAssertion: <explanation>
  expect(buckBunny).toBeDefined();
  // biome-ignore lint/suspicious/noMisplacedAssertion: <explanation>
  expect(ghostbusters).toBeDefined();
});

afterEach(async () => {
  await playlist?.delete();
  playlist = undefined;
});

it('should create a playlist and add/remove an item', async () => {
  playlist = await Playlist.create(plex, 'my playlist', { items: [buckBunny] });
  expect(playlist.ratingKey).toBeDefined();

  await playlist.addItems([ghostbusters]);

  const items = await playlist.items();
  expect(items).toHaveLength(2);
  expect(items[0].ratingKey).toBe(buckBunny.ratingKey);
  expect(items[1].ratingKey).toBe(ghostbusters.ratingKey);

  await playlist.removeItems([ghostbusters]);

  // @ts-expect-error reset cached items
  playlist._items = null;

  const itemsRemoved = await playlist.items();
  expect(itemsRemoved).toHaveLength(1);
});

it('should edit a playlist', async () => {
  const title = 'test_playlist_edit';
  const new_title = 'test_playlist_edit_new_title';
  const new_summary = 'test_playlist_edit_summary';
  playlist = await Playlist.create(plex, title, { items: [buckBunny] });
  expect(playlist.title).toBe(title);
  expect(playlist.summary).toBe('');
  await playlist.edit({ title: new_title, summary: new_summary });
  await playlist.reload();
  expect(playlist.title).toBe(new_title);
  expect(playlist.summary).toBe(new_summary);
});
