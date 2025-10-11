import { beforeAll, describe, expect, it } from 'vitest';

import type { PlexServer } from '../src/server.js';

import { createClient } from './test-client.js';

describe('History API Tests', () => {
  let plex: PlexServer;
  let musicSectionId: string;

  beforeAll(async () => {
    plex = await createClient();

    // Get music library section ID
    const library = await plex.library();
    const sections = await library.sections();
    const musicSection = sections.find(s => s.CONTENT_TYPE === 'audio');

    if (!musicSection) {
      throw new Error('Music library section not found. Run bootstrap script.');
    }

    musicSectionId = musicSection.key;
  }, 60000);

  it('should return history without filters', async () => {
    const history = await plex.history(100);
    expect(Array.isArray(history)).toBe(true);
    console.log(`Total history items (no filter): ${history.length}`);
    console.log(`Media types:`, [...new Set(history.map(h => h.type))]);
  }, 30000);

  it('should filter history by librarySectionId to return only music tracks', async () => {
    // Get all history without filter
    const allHistory = await plex.history(100);

    // Get history filtered by music library section
    const musicHistory = await plex.history(100, undefined, undefined, undefined, musicSectionId);

    console.log(`All history count: ${allHistory.length}`);
    console.log(`Music history count: ${musicHistory.length}`);
    console.log(`All history types:`, [...new Set(allHistory.map(h => h.type))]);
    console.log(`Music history types:`, [...new Set(musicHistory.map(h => h.type))]);

    // Music history should only contain tracks (audio items)
    const hasNonTracks = musicHistory.some(item => item.type !== 'track');
    expect(hasNonTracks).toBe(false);

    // If there are multiple media types in all history but only tracks in music history, filter worked
    const allTypes = new Set(allHistory.map(h => h.type));
    if (allTypes.size > 1) {
      // Filter should have reduced the results
      expect(musicHistory.length).toBeLessThanOrEqual(allHistory.length);
    }
  }, 30000);

  it('should filter history by ratingKey', async () => {
    // Get first history item
    const allHistory = await plex.history(10);
    if (allHistory.length === 0) {
      console.log('No history items available for testing');
      return;
    }

    const firstItem = allHistory[0];
    // Extract ratingKey from key (format: /library/metadata/12345)
    const keyMatch = firstItem.key?.match(/\/library\/metadata\/(\d+)/);
    const ratingKey = keyMatch?.[1];

    if (!ratingKey) {
      console.log('First history item has no parseable ratingKey');
      return;
    }

    // Get history for specific ratingKey
    const filteredHistory = await plex.history(100, undefined, ratingKey);

    console.log(`Filtered by ratingKey ${ratingKey}: ${filteredHistory.length} items`);

    // All items should have keys referencing the same ratingKey
    const allSameKey = filteredHistory.every(item => {
      const match = item.key?.match(/\/library\/metadata\/(\d+)/);
      return match?.[1] === ratingKey;
    });
    expect(allSameKey).toBe(true);
  }, 30000);
});
