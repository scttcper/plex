import { describe, expect, it, vi } from 'vitest';

import { Track } from '../src/audio.ts';
import { Collections } from '../src/library.ts';
import { Playlist } from '../src/playlist.ts';
import type { PlaylistResponse } from '../src/playlist.types.ts';
import { PlayQueue } from '../src/playqueue.ts';
import type { PlexServer } from '../src/server.ts';
import { Movie } from '../src/video.ts';

import { assertDefined } from './assertions.ts';

const server = {} as PlexServer;

class CountingTrack extends Track {
  static loadCount = 0;

  override _loadData(data: Parameters<Track['_loadData']>[0]): void {
    CountingTrack.loadCount += 1;
    super._loadData(data);
  }
}

describe('model hydration', () => {
  it('loads an audio model exactly once during construction', () => {
    CountingTrack.loadCount = 0;

    new CountingTrack(server, {
      key: '/library/metadata/1',
      ratingKey: '1',
      title: 'Track',
      type: 'track',
    });

    expect(CountingTrack.loadCount).toBe(1);
  });

  it('hydrates PlayQueue metadata as playable models', () => {
    const playQueue = new PlayQueue(
      server,
      {
        identifier: 'com.plexapp.plugins.library',
        mediaTagPrefix: '/system/bundle/media/flags/',
        mediaTagVersion: 1,
        playQueueID: 1,
        playQueueSelectedItemID: 10,
        playQueueSelectedItemOffset: 0,
        playQueueSelectedMetadataItemID: '20',
        playQueueShuffled: false,
        playQueueSourceURI: 'library://item',
        playQueueTotalCount: 1,
        playQueueVersion: 1,
        size: 1,
        Metadata: [
          {
            addedAt: 1,
            key: '/library/metadata/20',
            playQueueItemID: 10,
            ratingKey: '20',
            summary: '',
            thumb: '',
            title: 'Movie',
            type: 'movie',
          },
        ],
      },
      '/playQueues/1',
    );

    const [item] = playQueue.items;
    assertDefined(item);
    expect(item).toBeInstanceOf(Movie);
    expect(item.playQueueItemID).toBe(10);
    expect(typeof item.createPlayQueue).toBe('function');
  });

  it('hydrates playlist metadata through the shared factory', async () => {
    const query = vi.fn().mockResolvedValue({
      MediaContainer: {
        Metadata: [
          {
            addedAt: 1,
            key: '/library/metadata/20',
            playlistItemID: 10,
            ratingKey: '20',
            summary: '',
            thumb: '',
            title: 'Movie',
            type: 'movie',
          },
        ],
        size: 1,
        totalSize: 1,
      },
    });
    const playlistServer = { query } as unknown as PlexServer;
    const playlist = new Playlist(playlistServer, {
      addedAt: 1,
      composite: '/playlists/1/composite',
      guid: 'playlist://1',
      key: '/playlists/1/items',
      leafCount: 1,
      playlistType: 'video',
      ratingKey: '1',
      smart: false,
      summary: '',
      title: 'Playlist',
      type: 'playlist',
      updatedAt: 1,
    });

    const [item] = await playlist.items();

    expect(item).toBeInstanceOf(Movie);
    expect(item).toMatchObject({ playlistItemID: 10 });
  });

  it('parses analyzed media, part, and stream values from Plex payloads', () => {
    const movie = new Movie(server, {
      ratingKey: '1',
      key: '/library/metadata/1',
      guid: 'plex://movie/5d7768352e80df001ebde4c9',
      type: 'movie',
      title: 'Big Buck Bunny',
      year: 2008,
      addedAt: 1_760_236_778,
      updatedAt: 1_786_325_163,
      Media: [
        {
          id: 1,
          duration: 300_299,
          container: 'mp4',
          videoResolution: '1080',
          audioProfile: 'lc',
          optimizedForStreaming: 1,
          has64bitOffsets: false,
          Part: [
            {
              id: 1,
              key: '/library/parts/1/1760236778/file.mp4',
              container: 'mp4',
              duration: 300_299,
              size: 18_184_197,
              accessible: true,
              audioProfile: 'lc',
              has64bitOffsets: false,
              hasThumbnail: '1',
              optimizedForStreaming: true,
              Stream: [
                {
                  id: 247,
                  streamType: 2,
                  codec: 'mp3',
                  displayTitle: 'MP3 (Stereo)',
                  channels: 2,
                  samplingRate: 48_000,
                  audioChannelLayout: 'stereo',
                  albumGain: '-7.19',
                  gain: '0',
                  loudness: '-10.81',
                  lra: '14.18',
                  peak: '1.000000',
                  canNormalizeLoudness: '1',
                },
              ],
            },
          ],
        },
      ],
    } as never);

    const [media] = movie.media;
    assertDefined(media);
    expect(media.container).toBe('mp4');
    expect(media.videoResolution).toBe('1080');
    expect(media.audioProfile).toBe('lc');
    expect(media.optimizedForStreaming).toBe(true);
    expect(media.has64bitOffsets).toBe(false);
    const [part] = media.parts;
    assertDefined(part);
    expect(part.accessible).toBe(true);
    expect(part.audioProfile).toBe('lc');
    expect(part.hasThumbnail).toBe(true);
    expect(part.optimizedForStreaming).toBe(true);
    const [stream] = part.audioStreams();
    assertDefined(stream);
    expect(stream.channels).toBe(2);
    expect(stream.samplingRate).toBe(48_000);
    expect(stream.albumGain).toBe(-7.19);
    expect(stream.gain).toBe(0);
    expect(stream.loudness).toBe(-10.81);
    expect(stream.peak).toBe(1);
    expect(stream.canNormalizeLoudness).toBe(true);
    expect(movie.updatedAt).toEqual(new Date(1_786_325_163_000));
  });

  it('parses playlist and collection timestamps as unix seconds', () => {
    const playlist = new Playlist(server, {
      addedAt: 1_783_784_849,
      composite: '/playlists/1/composite/1792039977',
      guid: 'com.plexapp.agents.none://d0b0a7e4-4f3e-4ad1-8b8f-6f1d2c3b4a59',
      key: '/playlists/1/items',
      leafCount: 1,
      playlistType: 'video',
      ratingKey: '1',
      smart: true,
      summary: '',
      title: 'Test Smart Playlist',
      type: 'playlist',
      updatedAt: 1_792_039_977,
    });
    // Generated radio stations come back without timestamps, ratingKey, or composite.
    const station = new Playlist(server, {
      guid: 'tv.plex://station/library',
      icon: 'playlist://image.radio',
      key: '/library/sections/3/stations/1',
      leafCount: 0,
      librarySectionID: 3,
      librarySectionKey: '/library/sections/3',
      librarySectionTitle: 'Music',
      playlistType: 'audio',
      radio: '1',
      smart: true,
      summary: '',
      title: 'Library Radio',
      type: 'playlist',
    } as PlaylistResponse);
    const collection = new Collections(server, {
      addedAt: 1_760_236_832,
      contentRating: 'G',
      guid: 'collection://a066b9bb-a86a-4998-bbe9-ee967cdf14ff',
      index: 1322,
      key: '/library/collections/127/children',
      ratingKey: '127',
      subtype: 'movie',
      summary: '',
      thumb: '/library/collections/127/composite/1792042121?width=400&height=600',
      title: 'Test',
      type: 'collection',
      updatedAt: 1_792_042_121,
    });

    expect(playlist.addedAt).toEqual(new Date(1_783_784_849_000));
    expect(station.addedAt).toBeUndefined();
    expect(station.updatedAt).toBeUndefined();
    expect(playlist.updatedAt).toEqual(new Date(1_792_039_977_000));
    expect(collection.addedAt).toEqual(new Date(1_760_236_832_000));
    expect(collection.updatedAt).toEqual(new Date(1_792_042_121_000));
  });
});
