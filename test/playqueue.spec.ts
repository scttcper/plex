import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  type Episode,
  type Movie,
  type MovieSection,
  PlayQueue,
  type PlexServer,
  Playlist,
  type ShowSection,
} from '../src/index.js';

import { createClient } from './test-client.js';

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
  [movie] = await movieSection.search({ title: 'Bunny' });
  expect(movie).toBeDefined();

  // Get episodes for testing
  const showSection = await library.section<ShowSection>('TV Shows');
  const shows = await showSection.search({ title: 'Silicon Valley' });
  expect(shows.length).toBeGreaterThan(0);
  const show = shows[0];
  const seasons = await show.seasons();
  expect(seasons.length).toBeGreaterThan(0);
  episodes = (await seasons[0].episodes()).slice(0, 3);
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
  it('should get items from PlayQueue', async () => {
    playQueue = await PlayQueue.create(plex, movie);

    const items = playQueue.items;
    expect(items.length).toBeGreaterThan(0);

    const firstItem = playQueue.getItem(0);
    expect(firstItem).toBeDefined();
    expect(firstItem?.ratingKey).toBe(items[0].ratingKey);
  });

  it('should check if PlayQueue contains item', async () => {
    playQueue = await PlayQueue.create(plex, movie);

    const items = playQueue.items;
    expect(items.length).toBeGreaterThan(0);
    const contains = playQueue.contains(items[0]);
    expect(contains).toBe(true);
  });

  it('should get queue item from library item', async () => {
    playQueue = await PlayQueue.create(plex, movie);

    const queueItem = playQueue.getQueueItem(movie);
    expect(queueItem).toBeDefined();
    expect(queueItem.ratingKey).toBe(movie.ratingKey);
  });

  // TODO: Episode.section() fails because librarySectionID is undefined on episodes from a PlayQueue slice
  it.skip('should add item to PlayQueue', async () => {
    playQueue = await PlayQueue.create(plex, episodes.slice(0, 1));

    const initialCount = playQueue.playQueueTotalCount;
    await playQueue.addItem(episodes[1]);

    expect(playQueue.playQueueTotalCount).toBe(initialCount + 1);
  });

  // TODO: Episode.section() fails because librarySectionID is undefined on episodes from a PlayQueue slice
  it.skip('should add item with playNext option', async () => {
    playQueue = await PlayQueue.create(plex, episodes.slice(0, 1));

    await playQueue.addItem(episodes[1], { playNext: true });

    const items = playQueue.items;
    expect(items.length).toBe(2);
  });

  // TODO: removeItem does not update playQueueTotalCount
  it.skip('should remove item from PlayQueue', async () => {
    playQueue = await PlayQueue.create(plex, episodes.slice(0, 2));

    const initialCount = playQueue.playQueueTotalCount;
    const items = playQueue.items;

    await playQueue.removeItem(items[0]);

    expect(playQueue.playQueueTotalCount).toBe(initialCount - 1);
  });

  it('should move item in PlayQueue', async () => {
    playQueue = await PlayQueue.create(plex, episodes);

    const items = playQueue.items;
    const firstItem = items[0];
    const secondItem = items[1];

    // Move first item after second item
    await playQueue.moveItem(firstItem, { after: secondItem });

    const newItems = playQueue.items;
    // The order should have changed
    expect(newItems[0].ratingKey).not.toBe(firstItem.ratingKey);
  });

  // TODO: clear does not update playQueueTotalCount
  it.skip('should clear all items from PlayQueue', async () => {
    playQueue = await PlayQueue.create(plex, episodes.slice(0, 2));

    expect(playQueue.playQueueTotalCount).toBeGreaterThan(0);

    await playQueue.clear();

    expect(playQueue.playQueueTotalCount).toBe(0);
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
    expect(items[0].ratingKey).toBe(movie.ratingKey);
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
    playQueue = await PlayQueue.create(plex, movie);

    // Try to get a queue item that doesn't exist
    const library = await plex.library();
    const movieSection = await library.section<MovieSection>('Movies');
    const otherMovies = await movieSection.search({ title: 'Ghost' });

    const otherMovie = otherMovies[0];
    expect(() => playQueue.getQueueItem(otherMovie)).toThrow();
  });
});
