import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  type Album,
  type Artist,
  type MusicSection,
  Playlist,
  type PlexServer,
  type Track,
} from '../src/index.js';

import { createClient } from './test-client.js';

describe('Audio Playlist Tests', () => {
  let plex: PlexServer;
  let playlist: Playlist | undefined;
  let track1: Track;
  let track2: Track;
  let track3: Track;
  let album1: Album;
  let album2: Album;
  let artist1: Artist;
  let artist2: Artist;

  beforeAll(async () => {
    plex = await createClient();
    const library = await plex.library();
    const musicSection = await library.section<MusicSection>('Music');

    if (!musicSection) {
      throw new Error('Music library section not found. Run bootstrap script.');
    }

    // Get some tracks from the test library (Ladytron - Light & Magic album)
    const tracks = await musicSection.search<Track>({
      libtype: 'track',
      'album.title': 'Light & Magic',
      limit: 3,
    });

    if (tracks.length < 3) {
      throw new Error(
        'Not enough test tracks found. Need at least 3 tracks in "Light & Magic" album.',
      );
    }

    [track1, track2, track3] = tracks;

    // Get some albums from the test library
    const albums = await musicSection.search<Album>({
      libtype: 'album',
      'artist.title': 'Ladytron',
      limit: 2,
    });

    if (albums.length < 2) {
      throw new Error('Not enough test albums found. Need at least 2 Ladytron albums.');
    }

    [album1, album2] = albums;

    // Get some artists from the test library
    const artists = await musicSection.search<Artist>({
      libtype: 'artist',
      limit: 2,
    });

    if (artists.length < 2) {
      throw new Error('Not enough test artists found. Need at least 2 artists.');
    }

    [artist1, artist2] = artists;

    expect(track1).toBeDefined();
    expect(track2).toBeDefined();
    expect(track3).toBeDefined();
    expect(album1).toBeDefined();
    expect(album2).toBeDefined();
    expect(artist1).toBeDefined();
    expect(artist2).toBeDefined();
  }, 60000);

  afterEach(async () => {
    await playlist?.delete();
    playlist = undefined;
  });

  it('should create an audio playlist', async () => {
    playlist = await Playlist.create(plex, 'Test Audio Playlist', { items: [track1] });

    expect(playlist.ratingKey).toBeDefined();
    expect(playlist.title).toBe('Test Audio Playlist');
    expect(playlist.playlistType).toBe('audio');

    const items = await playlist.items();
    expect(items).toHaveLength(1);
    expect(items[0].ratingKey).toBe(track1.ratingKey);
  });

  it('should create an audio playlist with multiple tracks', async () => {
    playlist = await Playlist.create(plex, 'Multi Track Playlist', {
      items: [track1, track2, track3],
    });

    expect(playlist.ratingKey).toBeDefined();
    expect(playlist.playlistType).toBe('audio');

    const items = await playlist.items();
    expect(items).toHaveLength(3);
    expect(items[0].ratingKey).toBe(track1.ratingKey);
    expect(items[1].ratingKey).toBe(track2.ratingKey);
    expect(items[2].ratingKey).toBe(track3.ratingKey);
  });

  it('should add items to an audio playlist', async () => {
    playlist = await Playlist.create(plex, 'Add Items Test', { items: [track1] });

    await playlist.addItems([track2]);

    // @ts-expect-error reset cached items
    playlist._items = null;

    const items = await playlist.items();
    expect(items).toHaveLength(2);
    expect(items[0].ratingKey).toBe(track1.ratingKey);
    expect(items[1].ratingKey).toBe(track2.ratingKey);
  });

  it('should remove items from an audio playlist', async () => {
    playlist = await Playlist.create(plex, 'Remove Items Test', {
      items: [track1, track2, track3],
    });

    await playlist.removeItems([track2]);

    // @ts-expect-error reset cached items
    playlist._items = null;

    const items = await playlist.items();
    expect(items).toHaveLength(2);
    expect(items[0].ratingKey).toBe(track1.ratingKey);
    expect(items[1].ratingKey).toBe(track3.ratingKey);
  });

  it('should edit an audio playlist title and summary', async () => {
    const title = 'Original Audio Playlist';
    const newTitle = 'Updated Audio Playlist';
    const newSummary = 'This is my updated audio playlist summary';

    playlist = await Playlist.create(plex, title, { items: [track1] });

    expect(playlist.title).toBe(title);
    expect(playlist.summary).toBe('');

    await playlist.edit({ title: newTitle, summary: newSummary });
    await playlist.reload();

    expect(playlist.title).toBe(newTitle);
    expect(playlist.summary).toBe(newSummary);
  });

  it('should get playlist items and verify they are Track instances', async () => {
    playlist = await Playlist.create(plex, 'Track Type Test', { items: [track1, track2] });

    const items = await playlist.items();

    expect(items).toHaveLength(2);
    expect(items[0].type).toBe('track');
    expect(items[1].type).toBe('track');
    expect(items[0].title).toBeDefined();
    // Type assertion for Track-specific fields
    expect((items[0] as Track).grandparentTitle).toBeDefined(); // Artist name
    expect((items[0] as Track).parentTitle).toBeDefined(); // Album name
  });

  it('should find a specific track by title in playlist', async () => {
    playlist = await Playlist.create(plex, 'Item Search Test', { items: [track1, track2] });

    const foundItem = await playlist.item(track1.title);

    expect(foundItem).toBeDefined();
    expect(foundItem?.ratingKey).toBe(track1.ratingKey);
    expect(foundItem?.title).toBe(track1.title);
  });

  it('should return null when searching for non-existent track', async () => {
    playlist = await Playlist.create(plex, 'Not Found Test', { items: [track1] });

    const notFound = await playlist.item('This Track Does Not Exist');

    expect(notFound).toBeNull();
  });

  it('should delete an audio playlist', async () => {
    playlist = await Playlist.create(plex, 'Delete Test', { items: [track1] });

    const ratingKey = playlist.ratingKey;
    expect(ratingKey).toBeDefined();

    await playlist.delete();

    // Verify deletion by attempting to fetch - should fail or return null
    try {
      await plex.query(`/playlists/${ratingKey}`);
      // If we get here, deletion failed
      expect.fail('Playlist should have been deleted');
    } catch (error) {
      // Expected - playlist no longer exists
      expect(error).toBeDefined();
    }

    playlist = undefined; // Prevent afterEach from trying to delete again
  });

  describe('Album Playlists', () => {
    it('should create an album playlist', async () => {
      playlist = await Playlist.create(plex, 'Test Album Playlist', { items: [album1] });

      expect(playlist.ratingKey).toBeDefined();
      expect(playlist.title).toBe('Test Album Playlist');
      expect(playlist.playlistType).toBe('audio');

      const items = await playlist.items();
      expect(items).toHaveLength(1);
      expect(items[0].ratingKey).toBe(album1.ratingKey);
    });

    it('should create an album playlist with multiple albums', async () => {
      playlist = await Playlist.create(plex, 'Multi Album Playlist', {
        items: [album1, album2],
      });

      expect(playlist.ratingKey).toBeDefined();
      expect(playlist.playlistType).toBe('audio');

      const items = await playlist.items();
      expect(items).toHaveLength(2);
      expect(items[0].ratingKey).toBe(album1.ratingKey);
      expect(items[1].ratingKey).toBe(album2.ratingKey);
    });

    it('should add albums to an album playlist', async () => {
      playlist = await Playlist.create(plex, 'Add Albums Test', { items: [album1] });

      await playlist.addItems([album2]);

      // @ts-expect-error reset cached items
      playlist._items = null;

      const items = await playlist.items();
      expect(items).toHaveLength(2);
      expect(items[0].ratingKey).toBe(album1.ratingKey);
      expect(items[1].ratingKey).toBe(album2.ratingKey);
    });

    it('should remove albums from an album playlist', async () => {
      playlist = await Playlist.create(plex, 'Remove Albums Test', {
        items: [album1, album2],
      });

      await playlist.removeItems([album1]);

      // @ts-expect-error reset cached items
      playlist._items = null;

      const items = await playlist.items();
      expect(items).toHaveLength(1);
      expect(items[0].ratingKey).toBe(album2.ratingKey);
    });

    it('should verify album items have correct type and metadata', async () => {
      playlist = await Playlist.create(plex, 'Album Type Test', { items: [album1] });

      const items = await playlist.items();

      expect(items).toHaveLength(1);
      expect(items[0].type).toBe('album');
      expect(items[0].title).toBeDefined();
      // Type assertion for Album-specific fields
      expect((items[0] as Album).parentTitle).toBeDefined(); // Artist name
    });
  });

  describe('Artist Playlists', () => {
    it('should create an artist playlist', async () => {
      playlist = await Playlist.create(plex, 'Test Artist Playlist', { items: [artist1] });

      expect(playlist.ratingKey).toBeDefined();
      expect(playlist.title).toBe('Test Artist Playlist');
      expect(playlist.playlistType).toBe('audio');

      const items = await playlist.items();
      expect(items).toHaveLength(1);
      expect(items[0].ratingKey).toBe(artist1.ratingKey);
    });

    it('should create an artist playlist with multiple artists', async () => {
      playlist = await Playlist.create(plex, 'Multi Artist Playlist', {
        items: [artist1, artist2],
      });

      expect(playlist.ratingKey).toBeDefined();
      expect(playlist.playlistType).toBe('audio');

      const items = await playlist.items();
      expect(items).toHaveLength(2);
      expect(items[0].ratingKey).toBe(artist1.ratingKey);
      expect(items[1].ratingKey).toBe(artist2.ratingKey);
    });

    it('should add artists to an artist playlist', async () => {
      playlist = await Playlist.create(plex, 'Add Artists Test', { items: [artist1] });

      await playlist.addItems([artist2]);

      // @ts-expect-error reset cached items
      playlist._items = null;

      const items = await playlist.items();
      expect(items).toHaveLength(2);
      expect(items[0].ratingKey).toBe(artist1.ratingKey);
      expect(items[1].ratingKey).toBe(artist2.ratingKey);
    });

    it('should remove artists from an artist playlist', async () => {
      playlist = await Playlist.create(plex, 'Remove Artists Test', {
        items: [artist1, artist2],
      });

      await playlist.removeItems([artist2]);

      // @ts-expect-error reset cached items
      playlist._items = null;

      const items = await playlist.items();
      expect(items).toHaveLength(1);
      expect(items[0].ratingKey).toBe(artist1.ratingKey);
    });

    it('should verify artist items have correct type and metadata', async () => {
      playlist = await Playlist.create(plex, 'Artist Type Test', { items: [artist1] });

      const items = await playlist.items();

      expect(items).toHaveLength(1);
      expect(items[0].type).toBe('artist');
      expect(items[0].title).toBeDefined();
    });
  });
});
