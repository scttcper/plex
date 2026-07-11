import { afterEach, beforeAll, expect, it } from 'vitest';

import {
  type Movie,
  type MovieSection,
  Playlist,
  type PlexServer,
  type ShowSection,
} from '../src/index.ts';

import { createClient } from './test-client.ts';

let plex: PlexServer;
let playlist: Playlist | undefined;
let buckBunny: Movie;
let ghostbusters: Movie;
const smartPlaylistTitle = 'plexapi-ts-smart-playlist-test';

beforeAll(async () => {
  plex = await createClient();
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  [buckBunny] = await section.search({ title: 'Bunny' });
  [ghostbusters] = await section.search({ title: 'Ghostbusters' });
  expect(buckBunny).toBeDefined();
  expect(ghostbusters).toBeDefined();
  const leftovers = await plex.playlists({ title: smartPlaylistTitle });
  await Promise.all(leftovers.map(item => item.delete()));
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

  const itemsRemoved = await playlist.items();
  expect(itemsRemoved).toHaveLength(1);
  expect(playlist.isVideo).toBe(true);
  expect(playlist.metadataType).toBe('movie');
});

it('should retrieve playlist items grouped by library type', async () => {
  const library = await plex.library();
  const section = await library.section<ShowSection>('TV Shows');
  const show = await section.get({ title: 'Silicon Valley' });
  const episodes = (await show.episodes()).slice(0, 3);
  playlist = await Playlist.create(plex, 'grouped playlist items', { items: episodes });

  const shows = await playlist.items({ libtype: 'show' });
  const seasons = await playlist.items({ libtype: 'season' });
  const groupedEpisodes = await playlist.items({ libtype: 'episode' });

  expect(shows).toHaveLength(1);
  expect(shows[0].ratingKey).toBe(show.ratingKey);
  expect(seasons).toHaveLength(1);
  expect(seasons[0].parentRatingKey).toBe(show.ratingKey);
  expect(groupedEpisodes.map(episode => episode.ratingKey)).toEqual(
    episodes.map(episode => episode.ratingKey),
  );
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

it('should update a playlist by ratingKey without fetching it first', async () => {
  const title = 'test_playlist_static_update';
  const new_title = 'test_playlist_updated_title';
  const new_summary = 'Updated via static method';

  // Create playlist
  playlist = await Playlist.create(plex, title, { items: [buckBunny] });
  expect(playlist.title).toBe(title);
  expect(playlist.summary).toBe('');

  // Update using static method with just the ratingKey (no fetch required)
  await Playlist.update(plex, playlist.ratingKey, {
    title: new_title,
    summary: new_summary,
  });

  // Fetch and verify updates
  await playlist.reload();
  expect(playlist.title).toBe(new_title);
  expect(playlist.summary).toBe(new_summary);
});

it('should create and delete a smart playlist', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  let smartPlaylist: Playlist | undefined;
  try {
    smartPlaylist = await Playlist.create(plex, smartPlaylistTitle, {
      smart: true,
      section,
      search: {
        limit: 5,
        sort: 'addedAt:desc',
        where: { year: 2008 },
      },
    });
    expect(smartPlaylist.smart).toBe(true);
    expect(smartPlaylist.title).toBe(smartPlaylistTitle);
    expect((await smartPlaylist.section()).key).toBe(section.key);

    await smartPlaylist.updateFilters({ where: { year: 1984 } });
    const items = await smartPlaylist.items();
    expect(items.map(item => item.year)).toEqual([1984]);
  } finally {
    await smartPlaylist?.delete();
  }
});
