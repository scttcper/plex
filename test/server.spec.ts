import { describe, expect, it, vi } from 'vitest';

import type { Movie } from '../src/index.ts';
import { Playlist } from '../src/playlist.ts';
import { PlexServer } from '../src/server.ts';

const playlistData = {
  addedAt: 1,
  composite: '/playlists/88/composite',
  guid: 'playlist://88',
  key: '/playlists/88/items',
  leafCount: 2,
  playlistType: 'video',
  ratingKey: '88',
  smart: false,
  summary: '',
  title: 'Test Playlist',
  type: 'playlist',
  updatedAt: 1,
};

describe('PlexServer._buildWebURL', () => {
  const server = new PlexServer('http://localhost:32400', 'test-token');
  // Set machineIdentifier for testing
  server.machineIdentifier = 'abc123';

  it('should build URL with endpoint and params', () => {
    const params = new URLSearchParams({ key: '/library/metadata/123' });
    const result = server._buildWebURL({
      base: 'https://app.plex.tv/desktop/',
      endpoint: 'details',
      params,
    });
    expect(result).toBe(
      'https://app.plex.tv/desktop/#!/server/abc123/details?key=%2Flibrary%2Fmetadata%2F123',
    );
  });

  it('should build URL with endpoint but no params', () => {
    const result = server._buildWebURL({
      base: 'https://app.plex.tv/desktop/',
      endpoint: 'playlist',
    });
    expect(result).toBe('https://app.plex.tv/desktop/#!/server/abc123/playlist');
  });

  it('should build URL without endpoint (media URL)', () => {
    const params = new URLSearchParams({ source: 'library' });
    const result = server._buildWebURL({
      base: 'https://app.plex.tv/desktop/',
      params,
    });
    expect(result).toBe(
      'https://app.plex.tv/desktop/#!/media/abc123/com.plexapp.plugins.library?source=library',
    );
  });

  it('should build URL without endpoint or params', () => {
    const result = server._buildWebURL();
    expect(result).toBe('https://app.plex.tv/desktop/#!/media/abc123/com.plexapp.plugins.library');
  });
});

describe('PlexServer playlists', () => {
  it('lists and finds playlists with typed options', async () => {
    const server = new PlexServer('http://localhost:32400', 'test-token');
    const responses = new Map<string, unknown>([
      [
        '/playlists?playlistType=video&sectionID=1&title=Test&sort=titleSort%3Aasc%2CaddedAt%3Adesc',
        { MediaContainer: { Metadata: [playlistData] } },
      ],
      ['/playlists?title=Test+Playlist', { MediaContainer: { Metadata: [playlistData] } }],
    ]);
    server.query = vi.fn(({ path }: { path: string }) =>
      Promise.resolve(responses.get(path)),
    ) as never;

    const playlists = await server.playlists({
      playlistType: 'video',
      sectionId: 1,
      title: 'Test',
      sort: ['titleSort:asc', 'addedAt:desc'],
    });
    const playlist = await server.playlist('Test Playlist');

    expect(playlists[0]).toBeInstanceOf(Playlist);
    expect(playlists[0].metadataType).toBe('movie');
    expect(playlist.ratingKey).toBe('88');
  });

  it('moves a regular playlist item with an options object', async () => {
    const server = new PlexServer('http://localhost:32400', 'test-token');
    const responses = new Map<string, unknown>([
      [
        '/playlists/88/items?includeGuids=1',
        {
          MediaContainer: {
            Metadata: [
              {
                addedAt: 1,
                key: '/library/metadata/1',
                playlistItemID: 101,
                ratingKey: '1',
                summary: '',
                thumb: '',
                title: 'First',
                type: 'movie',
                updatedAt: 1,
                year: 2008,
              },
              {
                addedAt: 1,
                key: '/library/metadata/2',
                playlistItemID: 102,
                ratingKey: '2',
                summary: '',
                thumb: '',
                title: 'Second',
                type: 'movie',
                updatedAt: 1,
                year: 1984,
              },
            ],
          },
        },
      ],
      ['/playlists/88/items/102/move?after=101', { MediaContainer: {} }],
    ]);
    server.query = vi.fn(({ path }: { path: string }) =>
      Promise.resolve(responses.get(path)),
    ) as never;
    const playlist = new Playlist(server, playlistData, '/playlists/88');
    const first = { ratingKey: '1', title: 'First' } as Movie;
    const second = { ratingKey: '2', title: 'Second' } as Movie;

    await playlist.moveItem(second, { after: first });

    expect(server.query).toHaveBeenLastCalledWith({
      path: '/playlists/88/items/102/move?after=101',
      method: 'put',
    });
  });
});
