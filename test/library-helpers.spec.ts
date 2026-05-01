import { describe, expect, it, vi } from 'vitest';

import {
  BadRequest,
  MovieSection,
  NotFound,
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

function createMovieSection() {
  const responses = new Map<string, unknown>([
    [
      '/library/sections/1/all?includeMeta=1&includeAdvanced=1&X-Plex-Container-Start=0&X-Plex-Container-Size=0',
      { MediaContainer: { Meta: [filterMeta] } },
    ],
    ['/library/sections/1/genre', { MediaContainer: { Directory: genreChoices } }],
  ]);
  const query = vi.fn(({ path }: { path: string }) =>
    Promise.resolve(responses.get(path) ?? { MediaContainer: { Metadata: [] } }),
  );
  const section = new MovieSection({ query } as unknown as PlexServer, movieSectionData);
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
      ['movie.id', '99'],
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
