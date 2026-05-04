import { describe, expect, it, vi } from 'vitest';

import {
  BadRequest,
  Movie,
  MovieSection,
  NotFound,
  Setting,
  ShowSection,
  type EditableLibraryItem,
  type PlexServer,
} from '../src/index.js';

const showSectionData = {
  uuid: 'show-section-uuid',
  key: '2',
  agent: 'com.plexapp.agents.thetvdb',
  allowSync: true,
  art: '/:/resources/show-fanart.jpg',
  composite: '/library/sections/2/composite',
  filters: true,
  language: 'en-US',
  Location: [],
  refreshing: false,
  scanner: 'Plex TV Series',
  thumb: '/:/resources/show.png',
  title: 'TV Shows',
  type: 'show',
  updatedAt: 1,
  createdAt: 1,
  scannedAt: 1,
};

const movieSectionData = {
  ...showSectionData,
  uuid: 'movie-section-uuid',
  key: '1',
  agent: 'com.plexapp.agents.imdb',
  composite: '/library/sections/1/composite',
  scanner: 'Plex Movie',
  title: 'Movies',
  type: 'movie',
};

const filterMeta = {
  Type: [
    {
      active: true,
      key: '/library/sections/1/all?type=1',
      title: 'Movies',
      type: 'movie',
      Field: [
        { key: 'movie.title', title: 'Title', type: 'string' },
        { key: 'movie.year', title: 'Year', type: 'integer' },
        { key: 'movie.genre', title: 'Genre', type: 'tag' },
        { key: 'movie.unwatched', title: 'Unwatched', type: 'boolean' },
        { key: 'movie.addedAt', title: 'Date Added', type: 'date' },
      ],
      Filter: [
        {
          filter: 'genre',
          filterType: 'tag',
          key: '/library/sections/1/genre',
          title: 'Genre',
          type: 'filter',
        },
      ],
      Sort: [{ key: 'titleSort', title: 'Title', defaultDirection: 'asc' }],
    },
  ],
  FieldType: [
    {
      type: 'string',
      Operator: [
        { key: '=', title: 'contains' },
        { key: '!=', title: 'does not contain' },
        { key: '==', title: 'is' },
        { key: '!==', title: 'is not' },
        { key: '<=', title: 'begins with' },
        { key: '>=', title: 'ends with' },
      ],
    },
    {
      type: 'integer',
      Operator: [
        { key: '=', title: 'is' },
        { key: '!=', title: 'is not' },
        { key: '>>=', title: 'is greater than' },
        { key: '<<=', title: 'is less than' },
      ],
    },
    {
      type: 'tag',
      Operator: [
        { key: '=', title: 'is' },
        { key: '!=', title: 'is not' },
      ],
    },
    {
      type: 'boolean',
      Operator: [
        { key: '=', title: 'is true' },
        { key: '!=', title: 'is false' },
      ],
    },
    {
      type: 'date',
      Operator: [
        { key: '>>=', title: 'is after' },
        { key: '<<=', title: 'is before' },
      ],
    },
  ],
};

const genreChoices = [
  {
    fastKey: '/library/sections/1/all?genre=1&type=1',
    key: '1',
    title: 'Animation',
    type: 'genre',
  },
  { fastKey: '/library/sections/1/all?genre=2&type=1', key: '2', title: 'Comedy', type: 'genre' },
];

const labelChoices = [
  {
    fastKey: '/library/sections/2/all?label=99&type=4',
    key: '99',
    title: 'Favorite',
    type: 'label',
  },
];

const collectionData = {
  childCount: 1,
  key: '/library/metadata/99',
  ratingKey: 99,
  smart: false,
  title: 'Test Collection',
  type: 'collection',
};

const playlistData = {
  addedAt: 1,
  composite: '/playlists/88/composite',
  guid: 'playlist://88',
  key: '/playlists/88/items',
  leafCount: 1,
  playlistType: 'video',
  ratingKey: '88',
  smart: false,
  summary: '',
  title: 'Test Playlist',
  type: 'playlist',
  updatedAt: 1,
};

function createMovieSection() {
  const createCollectionParams = new URLSearchParams({
    title: 'Test Collection',
    type: '1',
    sectionId: '1',
    uri: 'server://machine/library/metadata/10',
  });
  const responses = new Map<string, unknown>([
    [
      '/library/sections/1/all?includeMeta=1&includeAdvanced=1&X-Plex-Container-Start=0&X-Plex-Container-Size=0',
      { MediaContainer: { Meta: [filterMeta] } },
    ],
    ['/library/sections/1/genre', { MediaContainer: { Directory: genreChoices } }],
    [
      '/library/sections/1/prefs',
      {
        MediaContainer: {
          Setting: [
            {
              advanced: '1',
              default: '0',
              enumValues: '0:Disabled|1:Enabled',
              group: 'library',
              hidden: '0',
              id: 'includeInGlobal',
              label: 'Include in dashboard',
              summary: 'Show this library on the dashboard.',
              type: 'bool',
              value: '1',
            },
          ],
        },
      },
    ],
    [
      '/hubs/search?includeCollections=1&includeExternalMedia=1&query=bunny&sectionId=1&limit=2&section=1',
      {
        MediaContainer: {
          Hub: [
            {
              context: 'hub.search',
              hubIdentifier: 'movie',
              key: '/hubs/search',
              more: false,
              size: 1,
              style: 'shelf',
              title: 'Movies',
              type: 'movie',
            },
          ],
        },
      },
    ],
    [
      '/hubs/sections/1/continueWatching/items?includeGuids=1',
      {
        MediaContainer: {
          Metadata: [
            {
              addedAt: 1,
              key: '/library/metadata/10',
              ratingKey: 10,
              title: 'Continue Movie',
              type: 'movie',
            },
          ],
        },
      },
    ],
    [
      `/library/collections?${createCollectionParams.toString()}`,
      { MediaContainer: { Metadata: [collectionData] } },
    ],
    [
      '/library/sections/1/all?includeGuids=1&title=Test+Collection&type=18',
      { MediaContainer: { Directory: [collectionData] } },
    ],
    [
      '/playlists?uri=server%3A%2F%2Fmachine%2Flibrary%2Fmetadata%2F10&type=video&title=Test+Playlist&smart=0',
      { MediaContainer: { Metadata: [playlistData] } },
    ],
    [
      '/playlists?type=15&playlistType=video&sectionID=1',
      { MediaContainer: { Playlist: [playlistData] } },
    ],
  ]);
  const query = vi.fn(({ path }: { path: string }) =>
    Promise.resolve(responses.get(path) ?? { MediaContainer: { Metadata: [] } }),
  );
  const history = vi.fn(async () => []);
  const sections: MovieSection[] = [];
  const server = {
    history,
    _uriRoot: vi.fn(() => 'server://machine'),
    query,
    library: vi.fn(async () => ({
      sections: vi.fn(async () => sections),
    })),
  } as unknown as PlexServer;
  const section = new MovieSection(server, movieSectionData);
  sections.push(section);
  return { history, query, section };
}

function createShowSection() {
  const filterMeta = {
    Type: [
      {
        active: true,
        key: '/library/sections/2/all?type=4',
        title: 'Episodes',
        type: 'episode',
        Field: [],
        Filter: [],
        Sort: [],
      },
    ],
    FieldType: [
      {
        type: 'tag',
        Operator: [
          { key: '=', title: 'is' },
          { key: '!=', title: 'is not' },
        ],
      },
    ],
  };
  const responses = new Map<string, unknown>([
    [
      '/library/sections/2/all?includeMeta=1&includeAdvanced=1&X-Plex-Container-Start=0&X-Plex-Container-Size=0',
      { MediaContainer: { Meta: [filterMeta] } },
    ],
    ['/library/sections/2/label?type=4', { MediaContainer: { Directory: labelChoices } }],
  ]);
  const query = vi.fn(({ path }: { path: string }) =>
    Promise.resolve(responses.get(path) ?? { MediaContainer: { Metadata: [] } }),
  );
  const section = new ShowSection({ query } as unknown as PlexServer, showSectionData);
  return { query, section };
}

function lastQueryPath(query: ReturnType<typeof vi.fn>): string {
  const [{ path }] = query.mock.calls.at(-1) as [{ path: string }];
  return path;
}

function lastQueryBase(query: ReturnType<typeof vi.fn>): string {
  return lastQueryPath(query).split('?', 1)[0];
}

function lastQueryEntries(query: ReturnType<typeof vi.fn>): Array<[string, string]> {
  const [, search] = lastQueryPath(query).split('?', 2);
  return [...new URLSearchParams(search).entries()];
}

describe('LibrarySection edit helpers', () => {
  it('returns typed advanced settings for the section', async () => {
    const { query, section } = createMovieSection();

    const settings = await section.settings();

    expect(settings[0]).toBeInstanceOf(Setting);
    expect(settings[0].id).toBe('includeInGlobal');
    expect(settings[0].value).toBe(true);
    expect(settings[0].default).toBe(false);
    expect(settings[0].advanced).toBe(true);
    expect(settings[0].hidden).toBe(false);
    expect(settings[0].enumValues).toEqual({ '0': 'Disabled', '1': 'Enabled' });
    expect(query).toHaveBeenCalledWith({ path: '/library/sections/1/prefs' });
  });

  it('returns typed continue watching items for the section hub', async () => {
    const { query, section } = createMovieSection();

    const items = await section.continueWatching();

    expect(items[0]).toBeInstanceOf(Movie);
    expect(items[0].title).toBe('Continue Movie');
    expect(query).toHaveBeenCalledWith({
      path: '/hubs/sections/1/continueWatching/items?includeGuids=1',
    });
  });

  it('searches hubs scoped to the section', async () => {
    const { query, section } = createMovieSection();

    const hubs = await section.hubSearch('bunny', { limit: 2, mediatype: 'movie' });

    expect(hubs[0].title).toBe('Movies');
    expect(hubs[0].type).toBe('movie');
    expect(query).toHaveBeenCalledWith({
      path: '/hubs/search?includeCollections=1&includeExternalMedia=1&query=bunny&sectionId=1&limit=2&section=1',
    });
  });

  it('fetches watched history scoped to the section', async () => {
    const { history, section } = createMovieSection();

    await section.history({ maxResults: 2, ratingKey: 10 });

    expect(history).toHaveBeenCalledWith({
      accountId: 1,
      librarySectionId: '1',
      maxResults: 2,
      ratingKey: 10,
    });
  });

  it('creates a typed collection in the section', async () => {
    const { query, section } = createMovieSection();

    const collection = await section.createCollection('Test Collection', [{ ratingKey: 10 }]);

    expect(collection.title).toBe('Test Collection');
    expect(collection.ratingKey).toBe(99);
    expect(query).toHaveBeenCalledWith({
      path: '/library/collections?title=Test+Collection&type=1&sectionId=1&uri=server%3A%2F%2Fmachine%2Flibrary%2Fmetadata%2F10',
      method: 'post',
    });
  });

  it('finds a typed collection by exact title', async () => {
    const { section } = createMovieSection();

    const collection = await section.collection('Test Collection');

    expect(collection.title).toBe('Test Collection');
    expect(collection.ratingKey).toBe(99);
  });

  it('creates a typed playlist in the section', async () => {
    const { query, section } = createMovieSection();

    const playlist = await section.createPlaylist('Test Playlist', {
      items: [{ listType: 'video', ratingKey: 10 } as unknown as Movie],
    });

    expect(playlist.title).toBe('Test Playlist');
    expect(playlist.ratingKey).toBe('88');
    expect(query).toHaveBeenCalledWith({
      path: '/playlists?uri=server%3A%2F%2Fmachine%2Flibrary%2Fmetadata%2F10&type=video&title=Test+Playlist&smart=0',
      method: 'post',
    });
  });

  it('finds a typed playlist by exact title', async () => {
    const { section } = createMovieSection();

    const playlist = await section.playlist('Test Playlist');

    expect(playlist.title).toBe('Test Playlist');
    expect(playlist.ratingKey).toBe('88');
  });

  it('edits advanced section settings with validated values', async () => {
    const { query, section } = createMovieSection();

    const editedSection = await section.editAdvanced({ includeInGlobal: true });

    expect(editedSection).toBe(section);
    expect(query).toHaveBeenCalledWith({
      path: '/library/sections/1?prefs%5BincludeInGlobal%5D=1',
      method: 'put',
    });
  });

  it('rejects unknown advanced section settings', async () => {
    const { section } = createMovieSection();

    await expect(section.editAdvanced({ missingSetting: true })).rejects.toThrow(
      'missingSetting not found',
    );
  });

  it('rejects unknown setting types', async () => {
    const { section } = createMovieSection();

    expect(
      () =>
        new Setting(
          section.server,
          {
            advanced: '0',
            default: 'value',
            group: 'library',
            hidden: '0',
            id: 'unexpectedSetting',
            label: 'Unexpected',
            summary: 'Unexpected setting type.',
            type: 'mystery',
            value: 'value',
          },
          '/library/sections/1/prefs',
          section,
        ),
    ).toThrow(BadRequest);
  });

  it('resets advanced section settings to their defaults', async () => {
    const { query, section } = createMovieSection();

    const editedSection = await section.defaultAdvanced();

    expect(editedSection).toBe(section);
    expect(query).toHaveBeenCalledWith({
      path: '/library/sections/1?prefs%5BincludeInGlobal%5D=0',
      method: 'put',
    });
  });

  it('accepts child items that belong to the section through their parent', async () => {
    const query = vi.fn().mockResolvedValue({
      MediaContainer: {
        Common: [{ key: '/library/sections/2/common', mixedFields: '' }],
      },
    });
    const section = new ShowSection({ query } as unknown as PlexServer, showSectionData);
    const item = {
      ratingKey: '101',
      title: 'Pilot',
      type: 'episode',
      parent: new WeakRef(section),
    } as unknown as EditableLibraryItem;

    const common = await section.common(item);

    expect(common.ratingKeys).toEqual([101]);
    expect(query).toHaveBeenCalledWith({
      path: '/library/sections/2/common?id=101&type=4',
    });
  });

  it('rejects child items from another section parent', async () => {
    const query = vi.fn();
    const section = new ShowSection({ query } as unknown as PlexServer, showSectionData);
    const otherSection = new ShowSection({ query } as unknown as PlexServer, {
      ...showSectionData,
      key: '3',
      uuid: 'other-show-section-uuid',
    });
    const item = {
      ratingKey: '101',
      title: 'Pilot',
      type: 'episode',
      parent: new WeakRef(otherSection),
    } as unknown as EditableLibraryItem;

    await expect(section.common(item)).rejects.toThrow(BadRequest);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('LibrarySection search filters', () => {
  it('validates advanced filter groups into Plex push/pop parameters', async () => {
    const { query, section } = createMovieSection();

    await section.search({
      filters: {
        and: [
          { or: [{ title: 'Bunny' }, { title: 'Elephant' }] },
          { 'year>>': 1990 },
          { genre: 'Animation' },
          { unwatched: true },
          { 'addedAt>>': '30d' },
        ],
      },
      maxresults: 10,
      sort: 'titleSort:desc',
    });

    expect(lastQueryBase(query)).toBe('/library/sections/1/all');
    expect(lastQueryEntries(query)).toEqual([
      ['includeGuids', '1'],
      ['sort', 'movie.titleSort:desc'],
      ['X-Plex-Container-Size', '10'],
      ['push', '1'],
      ['push', '1'],
      ['movie.title', 'Bunny'],
      ['or', '1'],
      ['movie.title', 'Elephant'],
      ['pop', '1'],
      ['and', '1'],
      ['movie.year>>', '1990'],
      ['and', '1'],
      ['movie.genre', '1'],
      ['and', '1'],
      ['movie.unwatched', '1'],
      ['and', '1'],
      ['movie.addedAt>>', '-30d'],
      ['pop', '1'],
    ]);
  });

  it('uses repeated parameters for the and filter operator', async () => {
    const { query, section } = createMovieSection();

    await section.search({ filters: { 'genre&': ['Animation', 'Comedy'] } });

    expect(lastQueryBase(query)).toBe('/library/sections/1/all');
    expect(lastQueryEntries(query)).toEqual([
      ['includeGuids', '1'],
      ['movie.genre', '1'],
      ['movie.genre', '2'],
    ]);
  });

  it('allows static sort fields that are missing from filter metadata', async () => {
    const { query, section } = createMovieSection();

    await section.recentlyAddedMovies(10);

    expect(lastQueryEntries(query)).toContainEqual(['sort', 'movie.addedAt:desc']);
  });

  it('allows id filters that are missing from filter metadata', async () => {
    const { query, section } = createMovieSection();

    await section.search({ filters: { 'movie.id': 99 } });

    expect(lastQueryEntries(query)).toEqual([
      ['includeGuids', '1'],
      ['id', '99'],
    ]);
  });

  it('adds manual filter fields and guid operators missing from plex metadata', async () => {
    const { query, section } = createMovieSection();

    const fields = await section.listFields();
    const fieldTypes = await section.fieldTypes();
    await section.search({
      filters: {
        guid: 'plex://movie/123',
        viewOffset: 10,
      },
    });

    expect(fields.map(field => field.key)).toEqual(
      expect.arrayContaining([
        'guid',
        'id',
        'lastRatedAt',
        'updatedAt',
        'viewOffset',
        'group',
        'having',
      ]),
    );
    expect(fieldTypes.find(fieldType => fieldType.type === 'guid')?.operators[0].key).toBe('=');
    expect(lastQueryEntries(query)).toEqual([
      ['includeGuids', '1'],
      ['guid', 'plex://movie/123'],
      ['viewOffset', '10'],
    ]);
  });

  it('adds manual sort fields missing from plex metadata', async () => {
    const { query, section } = createMovieSection();

    const sorts = await section.listSorts();
    await section.search({ sort: 'guid:desc' });

    expect(sorts.map(sort => sort.key)).toEqual(
      expect.arrayContaining(['guid', 'id', 'updatedAt']),
    );
    expect(lastQueryEntries(query)).toEqual([
      ['includeGuids', '1'],
      ['sort', 'movie.guid:desc'],
    ]);
  });

  it('adds manual label filters for episode searches', async () => {
    const { query, section } = createShowSection();

    const filters = await section.listFilters('episode');
    await section.searchEpisodes({ filters: { label: 'Favorite' } });

    expect(filters.map(filter => filter.filter)).toContain('label');
    expect(query).toHaveBeenCalledWith({ path: '/library/sections/2/label?type=4' });
    expect(lastQueryEntries(query)).toEqual([
      ['includeGuids', '1'],
      ['type', '4'],
      ['episode.label', '99'],
    ]);
  });

  it('allows static boolean filters that are missing from filter metadata', async () => {
    const { query, section } = createMovieSection();

    await section.search({ duplicate: 1 });

    expect(lastQueryEntries(query)).toEqual([
      ['includeGuids', '1'],
      ['movie.duplicate', '1'],
    ]);
  });

  it('skips empty advanced filter groups', async () => {
    const { query, section } = createMovieSection();

    await section.search({ filters: { and: [] } });

    expect(lastQueryEntries(query)).toEqual([['includeGuids', '1']]);
  });

  it('keeps PlexAPI operators as local filters instead of server filters', async () => {
    const { query, section } = createMovieSection();

    await section.search({ summary__icontains: 'space' });

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith({
      path: '/library/sections/1/all?includeGuids=1',
    });
  });

  it('rejects operators that are not valid for the field type', async () => {
    const { section } = createMovieSection();

    await expect(section.search({ filters: { 'genre>>': 'Animation' } })).rejects.toThrow(NotFound);
  });
});
