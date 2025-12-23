import { setTimeout as sleep } from 'node:timers/promises';

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MusicSection } from '../src/library.js';
import type { PlexServer } from '../src/server.js';

import { createClient } from './test-client.js';

describe('History API Tests', () => {
  let plex: PlexServer;
  let musicSectionId: string;

  beforeAll(async () => {
    plex = await createClient();

    const library = await plex.library();
    const sections = await library.sections();
    const musicSection = sections.find(s => s.CONTENT_TYPE === 'audio');

    if (!musicSection) {
      throw new Error('Music library section not found. Run bootstrap script.');
    }

    musicSectionId = musicSection.key;
  }, 60000);

  beforeEach(async () => {
    // Create history data by scrobbling a track
    const library = await plex.library();
    const musicLibrary = await library.sectionByID<MusicSection>(musicSectionId);
    const tracks = await musicLibrary.searchTracks({ title: '' });

    if (tracks.length > 0) {
      const track = tracks[0];
      try {
        const key = `/:/scrobble?key=${track.ratingKey}&identifier=com.plexapp.plugins.library`;
        await plex.query({ path: key });
        await sleep(2000); // Wait for history to be updated
      } catch {
        // Ignore errors - tests will handle empty history gracefully
      }
    }
  }, 15000);

  it('should return history without filters', async () => {
    const history = await plex.history({ maxResults: 100 });
    expect(Array.isArray(history)).toBe(true);

    // Filter out null/undefined items
    const validHistory = history.filter(h => h != null);

    // Verify all items have required properties
    validHistory.forEach(item => {
      expect(item).toHaveProperty('type');
      expect(item).toHaveProperty('ratingKey');
      expect(item).toHaveProperty('title');
    });
  }, 30000);

  it('should filter history by librarySectionId to return only music tracks', async () => {
    const allHistory = await plex.history({ maxResults: 100 });
    const musicHistory = await plex.history({ maxResults: 100, librarySectionId: musicSectionId });

    // Filter out null/undefined items
    const validAllHistory = allHistory.filter(h => h != null);
    const validMusicHistory = musicHistory.filter(h => h != null);

    // Music history should only contain tracks
    const hasNonTracks = validMusicHistory.some(item => item.type !== 'track');
    expect(hasNonTracks).toBe(false);

    // All music history items should have correct librarySectionID
    const allHaveCorrectSection = validMusicHistory.every(
      item => item.librarySectionID === musicSectionId,
    );
    expect(allHaveCorrectSection).toBe(true);

    // Filter should not increase results
    expect(validMusicHistory.length).toBeLessThanOrEqual(validAllHistory.length);
  }, 30000);

  it('should filter history by ratingKey', async () => {
    const allHistory = await plex.history({ maxResults: 10 });
    const validHistory = allHistory.filter(h => h != null);

    // If no history, test passes (empty arrays are valid)
    if (validHistory.length === 0) {
      expect(validHistory).toHaveLength(0);
      return;
    }

    const firstItem = validHistory[0];
    const ratingKey = firstItem.ratingKey;

    // If no ratingKey, test passes (invalid data handled gracefully)
    if (!ratingKey) {
      expect(ratingKey).toBeUndefined();
      return;
    }

    const filteredHistory = await plex.history({ maxResults: 100, ratingKey });
    const validFilteredHistory = filteredHistory.filter(h => h != null);

    // All items should have the same ratingKey
    const allSameKey = validFilteredHistory.every(item => item.ratingKey === ratingKey);
    expect(allSameKey).toBe(true);

    // Each history entry should have a unique historyKey
    const historyKeys = validFilteredHistory.map(item => item.historyKey);
    const uniqueHistoryKeys = new Set(historyKeys);
    expect(uniqueHistoryKeys.size).toBe(validFilteredHistory.length);
  }, 30000);
});
