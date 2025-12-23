import { beforeAll, describe, expect, it } from 'vitest';

import { Artist } from '../src/audio.js';
import type { PlexServer } from '../src/server.js';

import { createClient } from './test-client.js';

describe('Audio Class Tests', () => {
  let plex: PlexServer;

  beforeAll(async () => {
    plex = await createClient();
  }, 60_000);

  it('should load Artist attributes correctly for Ladytron', async () => {
    const library = await plex.library();
    const musicSection = await library.section('Music');
    expect(musicSection.CONTENT_TYPE).toBe('audio');
    if (!musicSection) {
      throw new Error("Test section 'Music' not found. Run bootstrap script.");
    }
    const results = await musicSection.search({ title: 'Ladytron', libtype: 'artist' }, Artist);
    expect(results.length).toBeGreaterThan(0);
    const artist = results[0];
    expect(artist.type).toBe('artist');
    expect(artist.title).toBe('Ladytron');

    const albums = await artist.albums();
    expect(albums.length).toBeGreaterThan(0);
    const album = albums[0];
    expect(album.type).toBe('album');
    expect(album.title).toBe('Light & Magic');

    const tracks = await album.tracks();
    expect(tracks.length).toBeGreaterThan(0);
    const track = tracks[0];
    expect(track.type).toBe('track');
    expect(track.title).toBe('Seventeen');
  });

  it('track relations (track.album, track.artist, album.artist) resolve correctly', async () => {
    const library = await plex.library();
    const musicSection = await library.section('Music');
    const [artist] = await musicSection.search({ title: 'Ladytron', libtype: 'artist' }, Artist);
    const [album] = await artist.albums();
    const [track] = await album.tracks();

    const viaAlbum = await track.album();
    expect(viaAlbum.type).toBe('album');
    expect(viaAlbum.title).toBe(album.title);

    const viaArtist = await track.artist();
    expect(viaArtist.type).toBe('artist');
    expect(viaArtist.title).toBe(artist.title);

    const albumArtist = await album.artist();
    expect(albumArtist.title).toBe(artist.title);
  });

  it('artist.album finds album by title (case-insensitive exact)', async () => {
    const library = await plex.library();
    const musicSection = await library.section('Music');
    const [artist] = await musicSection.search({ title: 'Ladytron', libtype: 'artist' }, Artist);
    const [album] = await artist.albums();

    const found = await artist.album(album.title as string);
    expect(found?.title).toBe(album.title);
  });

  it('track.getWebURL includes details for parentKey', async () => {
    const library = await plex.library();
    const musicSection = await library.section('Music');
    const [artist] = await musicSection.search({ title: 'Ladytron', libtype: 'artist' }, Artist);
    const [album] = await artist.albums();
    const [track] = await album.tracks();

    expect(track.parentKey).toBeTruthy();
    const url = track.getWebURL();
    expect(url).toContain('/details?');
    expect(url).toContain('key=');
    expect(url).toContain(encodeURIComponent(track.parentKey as string));
  });
});
