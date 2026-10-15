import { beforeAll, describe, expect, it } from 'vitest';

import { Artist, Track } from '../src/audio.ts';
import type { MusicSection } from '../src/library.ts';
import { Playlist } from '../src/playlist.ts';
import type { PlexServer } from '../src/server.ts';

import { assertDefined, first } from './assertions.ts';
import { createClient } from './test-client.ts';

describe('Audio Class Tests', () => {
  let plex: PlexServer;

  beforeAll(async () => {
    plex = await createClient();
  }, 60_000);

  it('should load Artist attributes correctly for Ladytron', async () => {
    const library = await plex.library();
    const musicSection = await library.section('Music');
    expect(musicSection.CONTENT_TYPE).toBe('audio');
    const results = await musicSection.search({ title: 'Ladytron', libtype: 'artist' }, Artist);
    expect(results.length).toBeGreaterThan(0);
    const artist = results[0];
    assertDefined(artist);
    expect(artist.type).toBe('artist');
    expect(artist.title).toBe('Ladytron');

    const albums = await artist.albums();
    expect(albums.length).toBeGreaterThan(0);
    const album = albums[0];
    assertDefined(album);
    expect(album.type).toBe('album');
    expect(album.title).toBe('Light & Magic');

    const tracks = await album.tracks();
    expect(tracks.length).toBeGreaterThan(0);
    const track = tracks[0];
    assertDefined(track);
    expect(track.type).toBe('track');
    expect(track.title).toBe('Seventeen');
  });

  it('lists artists from the music section root', async () => {
    const library = await plex.library();
    const musicSection = await library.section<MusicSection>('Music');

    const artists = await musicSection.all();
    const recentlyAdded = await musicSection.recentlyAdded();
    const artist = await musicSection.get({ title: 'Ladytron' });

    expect(artists.length).toBeGreaterThan(0);
    expect(artists.every(item => item instanceof Artist)).toBe(true);
    expect(recentlyAdded.every(item => item instanceof Artist)).toBe(true);
    expect(artist).toBeInstanceOf(Artist);
    expect(artist.key).toBe(`/library/metadata/${artist.ratingKey}`);
    const tracks = await musicSection.all({ libtype: 'track' });
    expect(tracks.length).toBeGreaterThan(0);
    expect(tracks.every(item => item instanceof Track)).toBe(true);
    // Track objects built from artist rows sent these to `/children/...` and got a 400.
    expect(Array.isArray(await artist.hubs())).toBe(true);
    expect(Array.isArray(await artist.extras())).toBe(true);
  });

  it('loads audio stream values for tracks', async () => {
    const library = await plex.library();
    const musicSection = await library.section('Music');
    const [artist] = await musicSection.search({ title: 'Ladytron', libtype: 'artist' }, Artist);
    assertDefined(artist);
    const [album] = await artist.albums();
    assertDefined(album);
    const [track] = await album.tracks();
    assertDefined(track);
    await track.reload();

    assertDefined(track.media);
    const [media] = track.media;
    assertDefined(media);
    expect(media.container).toBe('mp3');
    const [stream] = first(media.parts).audioStreams();
    assertDefined(stream);
    expect(stream.channels).toBe(2);
    expect(stream.samplingRate).toBe(48_000);
    expect(stream.audioChannelLayout).toBe('stereo');
    expect(typeof stream.canNormalizeLoudness).toBe('boolean');
  });

  it('lists music radio stations as playlists', async () => {
    const library = await plex.library();
    const musicSection = await library.section<MusicSection>('Music');

    const stations = await musicSection.stations();

    expect(stations.length).toBeGreaterThan(0);
    expect(first(stations)).toBeInstanceOf(Playlist);
    expect(first(stations).radio).toBe(true);
    expect(first(stations).playlistType).toBe('audio');
    // Generated stations have no timestamps.
    expect(first(stations).addedAt).toBeUndefined();
  });

  it('track relations (track.album, track.artist, album.artist) resolve correctly', async () => {
    const library = await plex.library();
    const musicSection = await library.section('Music');
    const [artist] = await musicSection.search({ title: 'Ladytron', libtype: 'artist' }, Artist);
    assertDefined(artist);
    const [album] = await artist.albums();
    assertDefined(album);
    const [track] = await album.tracks();
    assertDefined(track);

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
    assertDefined(artist);
    const [album] = await artist.albums();
    assertDefined(album);

    const found = await artist.album(album.title as string);
    expect(found?.title).toBe(album.title);
  });

  it('track.getWebURL includes details for parentKey', async () => {
    const library = await plex.library();
    const musicSection = await library.section('Music');
    const [artist] = await musicSection.search({ title: 'Ladytron', libtype: 'artist' }, Artist);
    assertDefined(artist);
    const [album] = await artist.albums();
    assertDefined(album);
    const [track] = await album.tracks();
    assertDefined(track);

    expect(track.parentKey).toBeTruthy();
    const url = track.getWebURL();
    expect(url).toContain('/details?');
    expect(url).toContain('key=');
    expect(url).toContain(encodeURIComponent(track.parentKey as string));
  });
});
