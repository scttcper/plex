import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  Artist,
  Collections,
  type MovieSection,
  type MusicSection,
  PlexServer,
  Track,
} from '../src/index.ts';

import { assertDefined, first } from './assertions.ts';
import { createClient } from './test-client.ts';

let plex: PlexServer;
let movieSection: MovieSection;
let musicSection: MusicSection;

const TEST_COLLECTION_NAME = '__test_collection__';

/** Clean up any leftover test collections */
async function cleanupTestCollections() {
  const collections = [
    ...(await movieSection.collections()),
    ...(await musicSection.collections()),
  ];
  for (const c of collections) {
    if (c.title === TEST_COLLECTION_NAME) {
      await plex.query({
        path: `/library/metadata/${c.ratingKey}`,
        method: 'delete',
      });
    }
  }
}

beforeAll(async () => {
  plex = await createClient();
  const library = await plex.library();
  movieSection = await library.section<MovieSection>('Movies');
  musicSection = await library.section<MusicSection>('Music');
  await cleanupTestCollections();
});

afterAll(async () => {
  await cleanupTestCollections();
});

describe('Collections', () => {
  it('should list collections in a section', async () => {
    const collections = await movieSection.collections();
    expect(Array.isArray(collections)).toBe(true);
  });

  it('should have expected properties on a collection', async () => {
    const collections = await movieSection.collections();
    expect(collections.length).toBeGreaterThan(0);
    const collection = collections[0];
    assertDefined(collection);
    expect(collection.ratingKey).toBeTruthy();
    expect(collection.title).toBeTruthy();
    expect(typeof collection.smart).toBe('boolean');
    expect(typeof collection.childCount).toBe('number');
    // Plex sends unix seconds, other models expose them as dates.
    expect(collection.addedAt).toBeInstanceOf(Date);
    expect(collection.addedAt.getFullYear()).toBeGreaterThan(2000);
    expect(collection.updatedAt.getTime()).toBeGreaterThanOrEqual(collection.addedAt.getTime());
  });

  it('should get items from a collection', async () => {
    const collections = await movieSection.collections();
    expect(collections.length).toBeGreaterThan(0);
    const collection = collections[0];
    assertDefined(collection);
    const items = await collection.items();
    expect(items.length).toBe(collection.childCount);
  });

  it('should create a play queue from a collection', async () => {
    const movies = (await movieSection.all()).slice(0, 2);
    const collection = await Collections.create(plex, TEST_COLLECTION_NAME, {
      section: movieSection,
      items: movies,
    });

    try {
      const playQueue = await collection.createPlayQueue();

      expect(playQueue.playQueueTotalCount).toBe(2);
      expect(playQueue.items.map(item => item.ratingKey).toSorted()).toEqual(
        movies.map(movie => movie.ratingKey).toSorted(),
      );
    } finally {
      await cleanupTestCollections();
    }
  });

  it('should create, verify items, and delete a collection', async () => {
    const movies = await movieSection.all();
    expect(movies.length).toBeGreaterThanOrEqual(2);
    const testItems = movies.slice(0, 2);

    // Create
    const collection = await Collections.create(plex, TEST_COLLECTION_NAME, {
      section: movieSection,
      items: testItems,
    });
    expect(collection.title).toBe(TEST_COLLECTION_NAME);
    expect(collection.ratingKey).toBeTruthy();

    // Verify items by fetching children
    const items = await collection.items();
    expect(items.length).toBe(2);

    // Clean up
    await plex.query({
      path: `/library/metadata/${collection.ratingKey}`,
      method: 'delete',
    });

    // Verify deletion
    const remaining = await movieSection.collections();
    const found = remaining.find(c => c.title === TEST_COLLECTION_NAME);
    expect(found).toBeUndefined();
  });

  it('should return artists from a music artist collection', async () => {
    const artist = first(await musicSection.searchArtists({ title: 'Ladytron' }));
    const collection = await musicSection.createCollection(TEST_COLLECTION_NAME, [artist]);

    try {
      const items = await collection.items();

      expect(collection.subtype).toBe('artist');
      expect(first(items)).toBeInstanceOf(Artist);
      expect(first(items).ratingKey).toBe(artist.ratingKey);
    } finally {
      await cleanupTestCollections();
    }
  });

  it('should return tracks from a music track collection', async () => {
    const track = first(await musicSection.searchTracks({ title: 'Evil' }));
    // createCollection uses the section type, so build a track collection directly.
    const params = new URLSearchParams({
      sectionId: musicSection.key,
      smart: '0',
      title: TEST_COLLECTION_NAME,
      type: '10',
      uri: `${plex._uriRoot()}/library/metadata/${track.ratingKey}`,
    });
    await plex.query({ path: `/library/collections?${params.toString()}`, method: 'post' });

    try {
      const collection = await musicSection.collection(TEST_COLLECTION_NAME);
      const items = await collection.items();

      expect(collection.subtype).toBe('track');
      expect(first(items)).toBeInstanceOf(Track);
      expect(first(items).ratingKey).toBe(track.ratingKey);
    } finally {
      await cleanupTestCollections();
    }
  });

  it('should reject creating a collection with no items', async () => {
    await expect(
      Collections.create(plex, '__empty_test__', { section: movieSection, items: [] }),
    ).rejects.toThrow('At least one item is required');
  });

  it('should create and update a smart collection with validated filters', async () => {
    const collection = await movieSection.createCollection(TEST_COLLECTION_NAME, {
      smart: true,
      search: { where: { year: 2008 } },
    });

    expect(collection.smart).toBe(true);
    expect(collection.isVideo).toBe(true);
    expect(collection.listType).toBe('video');
    expect(collection.metadataType).toBe('movie');
    const initialItems = await collection.items();
    expect(initialItems.length).toBeGreaterThan(0);
    expect(initialItems.every(item => item.year === 2008)).toBe(true);

    await collection.updateFilters({ where: { year: 1984 } });
    const updatedItems = await collection.items();
    expect(updatedItems.length).toBeGreaterThan(0);
    expect(updatedItems.every(item => item.year === 1984)).toBe(true);

    await plex.query({ path: `/library/metadata/${collection.ratingKey}`, method: 'delete' });
  });
});
