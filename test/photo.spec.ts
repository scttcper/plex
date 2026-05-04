import { describe, expect, it, vi } from 'vitest';

import {
  Clip,
  Library,
  NotFound,
  Photo,
  PhotoMedia,
  PhotoPart,
  Photoalbum,
  PhotoSection,
  Unsupported,
  type PlexServer,
} from '../src/index.js';

const photoSectionData = {
  uuid: 'photo-section-uuid',
  key: '3',
  agent: 'com.plexapp.agents.none',
  allowSync: true,
  art: '/:/resources/photo-fanart.jpg',
  composite: '/library/sections/3/composite',
  filters: true,
  language: 'en-US',
  Location: [{ id: 1, path: '/data/Photos' }],
  refreshing: false,
  scanner: 'Plex Photo Scanner',
  thumb: '/:/resources/photo.png',
  title: 'Photos',
  type: 'photo',
  updatedAt: 1,
  createdAt: 1,
  scannedAt: 1,
};

const photoAlbumData = {
  addedAt: 1,
  composite: '/library/metadata/30/composite/1',
  guid: 'local://30',
  key: '/library/metadata/30',
  librarySectionID: 3,
  librarySectionKey: '/library/sections/3',
  librarySectionTitle: 'Photos',
  ratingKey: 30,
  summary: 'A test album',
  thumb: '/library/metadata/30/thumb/1',
  title: 'Test Album',
  type: 'photo',
  updatedAt: 1,
  Field: [{ name: 'title', locked: '0' }],
  Image: [{ type: 'coverPoster', url: '/library/metadata/30/thumb/1' }],
};

const photoData = {
  addedAt: 1,
  guid: 'com.plexapp.agents.none://31?lang=xn',
  index: 1,
  key: '/library/metadata/31',
  librarySectionID: 3,
  librarySectionKey: '/library/sections/3',
  librarySectionTitle: 'Photos',
  originallyAvailableAt: '2026-01-01',
  parentGuid: 'local://30',
  parentIndex: 1,
  parentKey: '/library/metadata/30',
  parentRatingKey: 30,
  parentThumb: '/library/metadata/30/thumb/1',
  parentTitle: 'Test Album',
  ratingKey: 31,
  summary: 'A test photo',
  thumb: '/library/metadata/31/thumb/1',
  title: 'Cute Cat',
  type: 'photo',
  updatedAt: 1,
  userRating: 8,
  year: 2026,
  Field: [{ name: 'title', locked: '1' }],
  Image: [{ type: 'snapshot', url: '/library/metadata/31/thumb/1' }],
  Media: [
    {
      aspectRatio: 1.5,
      audioChannels: 0,
      bitrate: 100,
      duration: 0,
      height: 800,
      id: 300,
      has64bitOffsets: false,
      optimizedForStreaming: false,
      videoCodec: 'jpeg',
      videoFrameRate: '',
      videoProfile: '',
      width: 1200,
      Part: [
        {
          container: 'jpeg',
          duration: 0,
          file: '/data/Photos/Cute Cat.jpg',
          id: 301,
          key: '/library/parts/301/file.jpg',
          optimizedForStreaming: false,
          size: 12_345,
          videoProfile: '',
        },
      ],
    },
  ],
  Tag: [{ tag: 'favorite' }],
};

const clipData = {
  ...photoData,
  key: '/library/metadata/32',
  ratingKey: 32,
  title: 'Photo Clip',
  type: 'clip',
};

const photoFilterMeta = {
  Type: [
    {
      active: true,
      key: '/library/sections/3/all?type=13',
      title: 'Photos',
      type: 'photo',
      Sort: [{ key: 'addedAt', title: 'Date Added', defaultDirection: 'desc' }],
      Field: [],
      Filter: [],
    },
    {
      active: true,
      key: '/library/sections/3/all?type=14',
      title: 'Albums',
      type: 'photoalbum',
      Sort: [{ key: 'addedAt', title: 'Date Added', defaultDirection: 'desc' }],
      Field: [],
      Filter: [],
    },
  ],
  FieldType: [],
};

function createServer(responses: Map<string, unknown>): PlexServer {
  return {
    query: vi.fn(({ path }: { path: string }) =>
      Promise.resolve(responses.get(path) ?? { MediaContainer: { Metadata: [] } }),
    ),
    url: vi.fn((path: string, { includeToken }: { includeToken?: boolean } = {}) => {
      const url = new URL(path, 'http://plex.test');
      if (includeToken) {
        url.searchParams.set('X-Plex-Token', 'token');
      }

      return url;
    }),
    _buildWebURL: vi.fn(
      ({ base = 'https://app.plex.tv/desktop', endpoint, params }) =>
        `${base}/#!/${endpoint}?${params.toString()}`,
    ),
  } as unknown as PlexServer;
}

function createPhotoSection() {
  const responses = new Map<string, unknown>([
    [
      '/library/sections/3/all?includeMeta=1&includeAdvanced=1&X-Plex-Container-Start=0&X-Plex-Container-Size=0',
      { MediaContainer: { Meta: [photoFilterMeta] } },
    ],
    [
      '/library/sections/3/all?includeGuids=1&type=14&X-Plex-Container-Size=1',
      { MediaContainer: { Directory: [photoAlbumData] } },
    ],
    [
      '/library/sections/3/all?includeGuids=1&type=13&X-Plex-Container-Size=1',
      { MediaContainer: { Photo: [photoData] } },
    ],
    [
      '/library/sections/3/all?includeGuids=1&sort=photo.addedAt%3Adesc&type=13&X-Plex-Container-Size=1',
      { MediaContainer: { Photo: [photoData] } },
    ],
  ]);
  const server = createServer(responses);
  const section = new PhotoSection(server, photoSectionData);
  return { query: server.query as ReturnType<typeof vi.fn>, section };
}

describe('Photo libraries', () => {
  it('instantiates photo sections from library section discovery', async () => {
    const responses = new Map<string, unknown>([
      [
        '/library/sections',
        {
          MediaContainer: {
            Directory: [photoSectionData],
          },
        },
      ],
    ]);
    const server = createServer(responses);
    const library = new Library(server, {
      size: 1,
      allowSync: true,
      art: '',
      content: '',
      identifier: 'com.plexapp.plugins.library',
      mediaTagPrefix: '/system/bundle/media/flags/',
      mediaTagVersion: 1,
      title1: 'Plex Library',
      title2: '',
      Directory: [],
    });

    const sections = await library.sections();

    expect(sections[0]).toBeInstanceOf(PhotoSection);
    expect(sections[0].type).toBe('photo');
  });

  it('searches photo albums with the photoalbum search type', async () => {
    const { query, section } = createPhotoSection();

    const albums = await section.searchAlbums({ maxresults: 1 });

    expect(albums[0]).toBeInstanceOf(Photoalbum);
    expect(albums[0].title).toBe('Test Album');
    expect(query).toHaveBeenCalledWith({
      path: '/library/sections/3/all?includeGuids=1&type=14&X-Plex-Container-Size=1',
    });
  });

  it('searches photos with the photo search type', async () => {
    const { query, section } = createPhotoSection();

    const photos = await section.searchPhotos({ maxresults: 1 });

    expect(photos[0]).toBeInstanceOf(Photo);
    expect(photos[0].title).toBe('Cute Cat');
    expect(query).toHaveBeenCalledWith({
      path: '/library/sections/3/all?includeGuids=1&type=13&X-Plex-Container-Size=1',
    });
  });

  it('returns recently added photos with typed photo results', async () => {
    const { query, section } = createPhotoSection();

    const photos = await section.recentlyAddedPhotos(1);

    expect(photos[0]).toBeInstanceOf(Photo);
    expect(query).toHaveBeenCalledWith({
      path: '/library/sections/3/all?includeGuids=1&sort=photo.addedAt%3Adesc&type=13&X-Plex-Container-Size=1',
    });
  });

  it('rejects collections for photo libraries', async () => {
    const { section } = createPhotoSection();

    await expect(section.collections()).rejects.toThrow(Unsupported);
  });

  it('returns typed children from photo albums', async () => {
    const responses = new Map<string, unknown>([
      [
        '/library/metadata/30/children?includeGuids=1',
        {
          MediaContainer: {
            Directory: [photoAlbumData],
            Photo: [photoData],
            Video: [clipData],
          },
        },
      ],
    ]);
    const server = createServer(responses);
    const album = new Photoalbum(server, photoAlbumData);

    const albums = await album.albums();
    const photos = await album.photos();
    const clips = await album.clips();

    expect(albums[0]).toBeInstanceOf(Photoalbum);
    expect(photos[0]).toBeInstanceOf(Photo);
    expect(clips[0]).toBeInstanceOf(Clip);
  });

  it('returns typed children from collapsed metadata responses', async () => {
    const responses = new Map<string, unknown>([
      [
        '/library/metadata/30/children?includeGuids=1',
        {
          MediaContainer: {
            Metadata: [
              { ...photoAlbumData, key: '/library/metadata/30/children' },
              photoData,
              clipData,
            ],
          },
        },
      ],
    ]);
    const server = createServer(responses);
    const album = new Photoalbum(server, photoAlbumData);

    const albums = await album.albums();
    const photos = await album.photos();
    const clips = await album.clips();

    expect(albums[0]).toBeInstanceOf(Photoalbum);
    expect(photos[0]).toBeInstanceOf(Photo);
    expect(clips[0]).toBeInstanceOf(Clip);
  });

  it('rejects missing photo album children with not found errors', async () => {
    const responses = new Map<string, unknown>([
      [
        '/library/metadata/30/children?includeGuids=1',
        {
          MediaContainer: {
            Photo: [photoData],
          },
        },
      ],
    ]);
    const server = createServer(responses);
    const album = new Photoalbum(server, photoAlbumData);

    await expect(album.photo('Missing')).rejects.toThrow(NotFound);
  });

  it('maps photo file locations and original urls from media parts', () => {
    const server = createServer(new Map());
    const photo = new Photo(server, photoData);

    expect(photo.media[0]).toBeInstanceOf(PhotoMedia);
    expect(photo.media[0].parts[0]).toBeInstanceOf(PhotoPart);
    expect(photo.locations).toEqual(['/data/Photos/Cute Cat.jpg']);
    expect(photo.originalUrl()).toBe(
      'http://plex.test/library/parts/301/file.jpg?X-Plex-Token=token',
    );
  });
});
