import { beforeAll, describe, expect, it } from 'vitest';

import { Artist } from '../src/audio.js';
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
    expect(musicSection.CONTENT_TYPE).toBe('audio');
    if (!musicSection) {
      throw new Error("Test section 'Music' not found. Run bootstrap script.");
    }
    const results = await musicSection.search<Artist>(
      { title: 'Ladytron', libtype: 'artist' },
      Artist,
    );
    expect(results.length).toBeGreaterThan(0);
    const artist = results[0];
    expect(artist.type).toBe('artist');
    expect(artist.title).toBe('Ladytron');

    const albums = await artist.albums();
    expect(albums.length).toBeGreaterThan(0);
    const album = albums[0];
    expect(album.type).toBe('album');
    expect(album.title).toBe('Light & Magic');
    console.log({ album: album.parent?.deref() });

    const tracks = await album.tracks();
    expect(tracks.length).toBeGreaterThan(0);
    const track = tracks[0];
    expect(track.type).toBe('track');
    expect(track.title).toBe('Seventeen');
  });
});
