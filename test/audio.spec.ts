import { beforeAll, describe, expect, it } from 'vitest';

import type { Audio } from '../src/audio.js';
import type { PlexServer } from '../src/server.js';

import { createClient } from './test-client.js';

describe('Audio Class Tests', () => {
  let plex: PlexServer;

  beforeAll(async () => {
    plex = await createClient();
  }, 60000);

  it('should load Artist attributes correctly for Ladytron', async () => {
    const library = await plex.library();
    const musicSection = await library.section('Music');
    if (!musicSection) {
      throw new Error("Test section 'Music' not found. Run bootstrap script.");
    }
    const results = await musicSection.search<Audio>({ title: 'Ladytron', libtype: 'artist' });
    if (!results || results.length === 0) {
      throw new Error("Test artist 'Ladytron' not found. Run bootstrap script.");
    }
    const artist = results[0];
    if (!artist) {
      throw new Error('Artist not loaded in beforeAll hook');
    }
    await artist.reload();

    expect(artist.addedAt).toBeInstanceOf(Date);
    // if (artist.lastRatedAt) { expect(artist.lastRatedAt).toBeInstanceOf(Date); }
    // if (artist.lastViewedAt) { expect(artist.lastViewedAt).toBeInstanceOf(Date); }
    expect(artist.updatedAt).toBeInstanceOf(Date);

    if (artist.art) {
      expect(artist.art).toMatch(/^http.*\/library\/metadata\/\d+\/art\/\d+/);
    }
    expect(artist.guid).toBeDefined();
    expect(artist.guid).toContain('plex://artist/');
    // TODO: Add check for mbid if reliably populated
    // TODO: Add check for artist.guids array if implemented

    expect(artist.key).toMatch(/^\/library\/metadata\/\d+$/);
    if ('_initpath' in artist && typeof artist._initpath === 'string') {
      expect(artist._initpath).toMatch(/^\/library\/metadata\/\d+$/);
    }

    expect(artist.listType).toBe('audio');
    expect(artist.type).toBe('artist');

    expect(artist.ratingKey).toBeDefined();
    expect(parseInt(artist.ratingKey, 10)).toBeGreaterThanOrEqual(1);

    expect(artist.summary).toBeDefined();

    if (artist.thumb) {
      expect(artist.thumb).toMatch(/^http.*\/library\/metadata\/\d+\/thumb\/\d+/);
    }

    expect(artist.title).toBe('Ladytron');
    expect(artist.titleSort).toBe('Ladytron');

    expect(artist.index).toBeGreaterThanOrEqual(1);
    expect(artist.librarySectionID).toBeGreaterThanOrEqual(1);
    expect(artist.viewCount).toBeGreaterThanOrEqual(0);

    // TODO: Add check for artist.similar if implemented
    // expect(artist.similar).toBeInstanceOf(Array);

    expect(artist.server.baseurl.toString()).toMatch(/^http/);
  });
});
