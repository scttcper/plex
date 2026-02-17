import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Collections, type MovieSection, PlexServer } from '../src/index.js';

import { createClient } from './test-client.js';

let plex: PlexServer;
let movieSection: MovieSection;

const TEST_COLLECTION_NAME = '__test_collection__';

/** Clean up any leftover test collections */
async function cleanupTestCollections() {
  const collections = await movieSection.collections();
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
    expect(collection.ratingKey).toBeTruthy();
    expect(collection.title).toBeTruthy();
    expect(typeof collection.smart).toBe('boolean');
    expect(typeof collection.childCount).toBe('number');
  });

  it('should get items from a collection', async () => {
    const collections = await movieSection.collections();
    expect(collections.length).toBeGreaterThan(0);
    const collection = collections[0];
    const items = await collection.items();
    expect(items.length).toBe(collection.childCount);
  });

  it('should create, verify items, and delete a collection', async () => {
    const movies = await movieSection.all();
    expect(movies.length).toBeGreaterThanOrEqual(2);
    const testItems = movies.slice(0, 2);

    // Create
    const collection = await Collections.create(
      plex,
      TEST_COLLECTION_NAME,
      movieSection,
      testItems,
    );
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

  it('should reject creating a collection with no items', async () => {
    await expect(Collections.create(plex, '__empty_test__', movieSection, [])).rejects.toThrow(
      'At least one item is required',
    );
  });
});
