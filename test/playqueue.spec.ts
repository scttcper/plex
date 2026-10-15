import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  type Episode,
  type Movie,
  type MovieSection,
  PlayQueue,
  PlexClient,
  type PlexServer,
  Playlist,
  type ShowSection,
} from '../src/index.ts';

import { assertDefined, first, itemAt } from './assertions.ts';
import { createClient } from './test-client.ts';

let plex: PlexServer;
let movie: Movie;
let episodes: Episode[];
let playlist: Playlist | undefined;
let playQueue: PlayQueue | undefined;

beforeAll(async () => {
  plex = await createClient();
  const library = await plex.library();

  // Get a movie for testing
  const movieSection = await library.section<MovieSection>('Movies');
  movie = first(await movieSection.search({ title: 'Bunny' }));

  // Get episodes for testing
  const showSection = await library.section<ShowSection>('TV Shows');
  const shows = await showSection.search({ title: 'Silicon Valley' });
  expect(shows.length).toBeGreaterThan(0);
  const show = shows[0];
  assertDefined(show);
  const seasons = await show.seasons();
  expect(seasons.length).toBeGreaterThan(0);
  episodes = (await first(seasons).episodes()).slice(0, 3);
  expect(episodes.length).toBeGreaterThanOrEqual(3);
});

afterEach(async () => {
  // Clean up any created playlist
  if (playlist) {
    await playlist.delete();
    playlist = undefined;
  }

  // PlayQueues don't need explicit deletion as they're temporary
  playQueue = undefined;
});

describe('PlayQueue Creation', () => {
  it('should create PlayQueue from single movie', async () => {
    playQueue = await PlayQueue.create(plex, movie);

    expect(playQueue.playQueueID).toBeDefined();
    expect(playQueue.playQueueTotalCount).toBeGreaterThan(0);
    expect(playQueue.length).toBe(playQueue.playQueueTotalCount);
    expect(playQueue.playQueueSourceURI).toBeDefined();
  });

  it('should create PlayQueue from movie list', async () => {
    const library = await plex.library();
    const movieSection = await library.section<MovieSection>('Movies');
    const movies = await movieSection.search({ limit: 2 });
    expect(movies.length).toBeGreaterThanOrEqual(2);

    playQueue = await PlayQueue.create(plex, movies.slice(0, 2));

    expect(playQueue.playQueueTotalCount).toBe(2);
    const items = playQueue.items;
    expect(items).toHaveLength(2);
  });

  it('should create PlayQueue with options', async () => {
    playQueue = await PlayQueue.create(plex, movie, {
      shuffle: true,
      repeat: true,
      continuous: false,
    });

    expect(playQueue.playQueueShuffled).toBe(true);
  });

  it('should create PlayQueue from server method', async () => {
    playQueue = await plex.createPlayQueue(movie);

    expect(playQueue.playQueueID).toBeDefined();
    expect(playQueue.playQueueTotalCount).toBeGreaterThan(0);
  });

  it('should create PlayQueue from playable item method', async () => {
    playQueue = await movie.createPlayQueue();

    expect(playQueue.playQueueID).toBeDefined();
    expect(decodeURIComponent(playQueue.playQueueSourceURI)).toContain(movie.key);
  });
});

describe('PlayQueue Retrieval', () => {
  it('should get existing PlayQueue by ID', async () => {
    // First create a PlayQueue
    const originalPQ = await PlayQueue.create(plex, movie);

    // Then retrieve it by ID
    playQueue = await PlayQueue.get(plex, originalPQ.playQueueID);

    expect(playQueue.playQueueID).toBe(originalPQ.playQueueID);
    expect(playQueue.playQueueVersion).toBe(originalPQ.playQueueVersion);
  });

  it('should get PlayQueue with window options', async () => {
    const originalPQ = await PlayQueue.create(plex, movie);

    playQueue = await PlayQueue.get(plex, originalPQ.playQueueID, {
      window: 10,
      includeBefore: false,
      includeAfter: true,
    });

    expect(playQueue.playQueueID).toBe(originalPQ.playQueueID);
  });
});

describe('PlayQueue Items Management', () => {
  it('should play the start item of a new PlayQueue', async () => {
    const startItem = itemAt(episodes, 1);
    const created = await PlayQueue.create(plex, episodes, { startItem });
    expect(created.playQueueSelectedItemOffset).toBe(1);
    const client = new PlexClient({ server: plex });
    const sendCommand = vi.spyOn(client, 'sendCommand').mockResolvedValue(null);

    await client.playMedia(created);

    expect(sendCommand).toHaveBeenCalledWith(
      'playback/playMedia',
      expect.objectContaining({ key: startItem.key, type: 'video' }),
    );
  });

  it('should play the selected item from a window that does not contain it', async () => {
    const created = await PlayQueue.create(plex, episodes);
    const selected = first(created.items);
    const window = await PlayQueue.get(plex, created.playQueueID, {
      center: itemAt(created.items, 1).playQueueItemID,
      window: 1,
      includeBefore: false,
    });
    expect(window.items.map(item => item.ratingKey)).toEqual([itemAt(episodes, 2).ratingKey]);
    expect(window.selectedItem).toBeUndefined();
    const client = new PlexClient({ server: plex });
    const sendCommand = vi.spyOn(client, 'sendCommand').mockResolvedValue(null);

    await client.playMedia(window);

    expect(sendCommand).toHaveBeenCalledWith(
      'playback/playMedia',
      expect.objectContaining({ key: selected.key, type: 'video' }),
    );
  });

  it('should get items from PlayQueue', async () => {
    playQueue = await PlayQueue.create(plex, movie);

    const items = playQueue.items;
    expect(items.length).toBeGreaterThan(0);

    const firstItem = playQueue.getItem(0);
    expect(firstItem).toBeDefined();
    expect(firstItem?.ratingKey).toBe(first(items).ratingKey);
  });

  it('should check if PlayQueue contains item', async () => {
    playQueue = await PlayQueue.create(plex, movie);

    const items = playQueue.items;
    expect(items.length).toBeGreaterThan(0);
    const contains = playQueue.contains(first(items));
    expect(contains).toBe(true);
  });

  it('should get queue item from library item', async () => {
    playQueue = await PlayQueue.create(plex, movie);

    const queueItem = playQueue.getQueueItem(movie);
    expect(queueItem).toBeDefined();
    expect(queueItem.ratingKey).toBe(movie.ratingKey);
  });

  it('should add item to PlayQueue', async () => {
    playQueue = await PlayQueue.create(plex, episodes.slice(0, 1));

    const initialCount = playQueue.playQueueTotalCount;
    await playQueue.addItem(itemAt(episodes, 1));

    expect(playQueue.playQueueTotalCount).toBe(initialCount + 1);
  });

  it('should add item with playNext option', async () => {
    playQueue = await PlayQueue.create(plex, episodes.slice(0, 1));

    await playQueue.addItem(itemAt(episodes, 1), { playNext: true });

    const items = playQueue.items;
    expect(items.length).toBe(2);
  });

  it('should remove item from PlayQueue', async () => {
    playQueue = await PlayQueue.create(plex, episodes.slice(0, 3));

    const initialCount = playQueue.playQueueTotalCount;
    const initialVersion = playQueue.playQueueVersion;
    const removed = itemAt(playQueue.items, 2);

    await playQueue.removeItem(removed);

    expect(playQueue.playQueueTotalCount).toBe(initialCount - 1);
    expect(playQueue.items).toHaveLength(initialCount - 1);
    expect(playQueue.playQueueVersion).toBeGreaterThan(initialVersion);
    expect(playQueue.contains(removed)).toBe(false);
  });

  it('should move item in PlayQueue', async () => {
    playQueue = await PlayQueue.create(plex, episodes);

    const items = playQueue.items;
    const firstItem = items[0];
    assertDefined(firstItem);
    const secondItem = items[1];

    // Move first item after second item
    await playQueue.moveItem(firstItem, { after: secondItem });

    const newItems = playQueue.items;
    // The order should have changed
    expect(first(newItems).ratingKey).not.toBe(firstItem.ratingKey);
  });

  it('should clear all but the selected item from PlayQueue', async () => {
    playQueue = await PlayQueue.create(plex, episodes.slice(0, 3));
    const selectedRatingKey = playQueue.playQueueSelectedMetadataItemID;

    expect(playQueue.playQueueTotalCount).toBe(3);

    await playQueue.clear();

    expect(playQueue.playQueueTotalCount).toBe(1);
    expect(playQueue.items.map(item => item.ratingKey)).toEqual([selectedRatingKey]);
  });
});

describe('PlayQueue Refresh', () => {
  it('should refresh PlayQueue data', async () => {
    playQueue = await PlayQueue.create(plex, movie);

    const originalVersion = playQueue.playQueueVersion;

    await playQueue.refresh();

    // Version might be the same if no changes occurred
    expect(playQueue.playQueueVersion).toBeGreaterThanOrEqual(originalVersion);
  });
});

describe('PlayQueue from Playlist', () => {
  it('should create PlayQueue from playlist', async () => {
    // Create a playlist first
    playlist = await Playlist.create(plex, 'test_playqueue_playlist', { items: [movie] });

    // Create PlayQueue from playlist
    playQueue = await PlayQueue.create(plex, playlist);

    expect(playQueue.playQueueID).toBeDefined();
    expect(playQueue.playQueueTotalCount).toBe(1);

    const items = playQueue.items;
    expect(first(items).ratingKey).toBe(movie.ratingKey);
  });
});

describe('PlayQueue Station Support', () => {
  it('should create PlayQueue from station key', async () => {
    // This test requires a valid station key, which is hard to generate
    // In a real scenario, you would get this from an artist's station() method
    const mockStationKey = '/library/metadata/1/station/test';

    playQueue = await PlayQueue.fromStationKey(plex, mockStationKey);
    expect(playQueue).toBeDefined();
  });
});

describe('PlayQueue Error Handling', () => {
  it('should handle invalid PlayQueue ID gracefully', async () => {
    await expect(PlayQueue.get(plex, 999_999)).rejects.toThrow();
  });

  it('should handle queue item not found', async () => {
    const queue = await PlayQueue.create(plex, movie);
    playQueue = queue;

    // Try to get a queue item that doesn't exist
    const library = await plex.library();
    const movieSection = await library.section<MovieSection>('Movies');
    const otherMovie = first(await movieSection.search({ title: 'Ghost' }));
    expect(() => queue.getQueueItem(otherMovie)).toThrow();
  });
});
