import { beforeAll, expect, it } from 'vitest';

import { MovieSection, Playlist, PlexServer } from '../src/index.js';

import { createClient } from './test-client.js';

const delay = async (ms: number) =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

let plex: PlexServer;
beforeAll(async () => {
  plex = await createClient();
});

it('should create a playlist and add/remove an item', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const [buckBunny] = await section.search({ title: 'Bunny' });
  const [ghostbusters] = await section.search({ title: 'Ghostbusters' });

  const playlist = await Playlist.create(plex, 'my playlist', { items: [buckBunny] });
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

  await delay(1000);
  await playlist.delete();
});
