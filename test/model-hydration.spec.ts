import { describe, expect, it, vi } from 'vitest';

import { Track } from '../src/audio.ts';
import { Playlist } from '../src/playlist.ts';
import { PlayQueue } from '../src/playqueue.ts';
import type { PlexServer } from '../src/server.ts';
import { Movie } from '../src/video.ts';

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
        playQueueSelectedMetadataItemID: 20,
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
});
