import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, beforeAll, expect, it } from 'vitest';

import {
  Common,
  Movie,
  Season,
  Episode,
  FilteringSort,
  FilterChoice,
  Genre,
  LibraryTimeline,
  MovieSection,
  type PlexServer,
  type ShowSection,
  BadRequest,
} from '../src/index.js';

import { createClient } from './test-client.js';

const TEST_ADD_LIBRARY_NAME = '__plexapi_add_test__';
const TEST_ADD_LIBRARY_HOST_PATH = join(process.cwd(), 'plex/media/LibraryAddTest');
const TEST_ADD_LIBRARY_PLEX_PATH = '/data/LibraryAddTest';

let plex: PlexServer;

async function cleanupAddTestLibrary() {
  const library = await plex.library();
  const sections = await library.sections();
  for (const section of sections) {
    if (section.title === TEST_ADD_LIBRARY_NAME) {
      await section.delete();
    }
  }
}

beforeAll(async () => {
  plex = await createClient();
  await mkdir(TEST_ADD_LIBRARY_HOST_PATH, { recursive: true });
  await cleanupAddTestLibrary();
});

afterAll(async () => {
  await cleanupAddTestLibrary();
  await rm(TEST_ADD_LIBRARY_HOST_PATH, { recursive: true, force: true });
});

it('should get all sections', async () => {
  const library = await plex.library();
  const sections = await library.sections();
  expect(sections.length).toBeGreaterThan(1);
  expect(sections.find(section => section.type === 'movie').type).toBe('movie');
});

it('should create and delete a temporary movie section', async () => {
  const library = await plex.library();
  const section = await library.add({
    name: TEST_ADD_LIBRARY_NAME,
    type: 'movie',
    agent: 'tv.plex.agents.movie',
    scanner: 'Plex Movie',
    locations: TEST_ADD_LIBRARY_PLEX_PATH,
    preferences: {
      enableBIFGeneration: false,
    },
  });
  expect(section).toBeInstanceOf(MovieSection);
  expect(section.title).toBe(TEST_ADD_LIBRARY_NAME);
  expect(section.type).toBe('movie');
  expect(section.locations.map(location => location.path)).toEqual([TEST_ADD_LIBRARY_PLEX_PATH]);
  await section.delete();
  await expect(library.section(TEST_ADD_LIBRARY_NAME)).rejects.toThrow();
});

it('should search for all unwatched movies', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const results = await section.search({ unwatched: true });
  expect(results.length).toBeGreaterThan(0);
});

it('should get a list of movies and mark one watched', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const results = await section.search({ title: 'Bunny' });
  expect(results.length).toBeGreaterThanOrEqual(1);
  results[0].isChildOf(Movie);
  await results[0].markWatched();
  await results[0].markUnwatched();
});

it('should search for movies matching a title', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const results = await section.search({ title: 'Bunny' });
  expect(results.length).toBe(1);
  const [buckBunny] = results;
  await buckBunny.reload();
  expect(results[0].title).toBe('Big Buck Bunny');
  expect(results[0].librarySectionID).toBeTruthy();
});

it('should get a movie with typed search filters', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const movie = await section.get({ title: 'Big Buck Bunny', year: 2008, libtype: 'movie' });
  expect(movie).toBeInstanceOf(Movie);
  expect(movie.title).toBe('Big Buck Bunny');
  expect(movie.year).toBe(2008);
});

it('should search for tv show matching a title', async () => {
  const library = await plex.library();
  const section = await library.section<ShowSection>('TV Shows');
  const results = await section.search({ title: 'Silicon Valley' });
  const show = results[0];
  expect(show.index).toBeDefined();
  expect(show.isWatched).toBeFalsy();
});

it('should search for all content matching search query', async () => {
  const results = await plex.search('Buck');
  expect(results.length).toBeGreaterThan(1);
  const movies = results.find(x => x.type === 'movie');
  expect(movies?.Metadata?.[0]?.title).toBe('Big Buck Bunny');
});

it('should list all items in all sections', async () => {
  const library = await plex.library();
  const items = await library.all();
  expect(items.length).toBeGreaterThanOrEqual(9);
});

it('should list all movies in movie section', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const items = await section.all();
  expect(items.length).toBe(7);
});

it('should get movie section plex url', async () => {
  const tab = 'library';
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  let url = section.getWebURL({ tab });
  expect(url).toContain('https://app.plex.tv/desktop');
  expect(url).toContain(plex.machineIdentifier);
  expect(url).toContain(`source=${section.key}`);
  expect(url).toContain(`pivot=${tab}`);
  // Test a different base
  const base = 'https://doesnotexist.com/plex';
  url = section.getWebURL({ base });
  expect(url).toContain(base);
});

// TODO: Not sure yet why this fails
it.skip('should list all clients connected to the Server.', async () => {
  const clients = await plex.clients();
  expect(clients.length).toBeGreaterThanOrEqual(0);

  // There's no clients currently during normal test conditions
  // Manually start watching something for client tests
  if (clients.length > 0) {
    const client = clients[0];
    await client.reload();
  }
});

it('should get library on deck items', async () => {
  const library = await plex.library();
  const onDeck = await library.onDeck();
  // On deck may be empty if nothing is in progress, that's OK
  expect(Array.isArray(onDeck)).toBe(true);
});

it('should get root library hubs', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const hubs = await library.hubs({ sectionID: section.key, limit: 2 });
  expect(hubs.length).toBeGreaterThan(0);
  expect(typeof hubs[0].title).toBe('string');
  expect(typeof hubs[0].type).toBe('string');
  expect(typeof hubs[0].more).toBe('boolean');
  expect(typeof hubs[0].size).toBe('number');
});

it('should get root library recently added items', async () => {
  const library = await plex.library();
  const recentlyAdded = await library.recentlyAdded();
  expect(recentlyAdded.length).toBeGreaterThan(0);
  expect(typeof recentlyAdded[0].title).toBe('string');
  expect(typeof recentlyAdded[0].type).toBe('string');
});

it('should search root library items by type', async () => {
  const library = await plex.library();
  const results = await library.search({ title: 'Bunny', libtype: 'movie' });
  expect(results.length).toBe(1);
  expect(results[0]).toBeInstanceOf(Movie);
  expect(results[0].title).toBe('Big Buck Bunny');
});

it('should aggregate root library history', async () => {
  const library = await plex.library();
  const history = await library.history({ maxResults: 1 });
  expect(Array.isArray(history)).toBe(true);
});

it('should get global library tags', async () => {
  const library = await plex.library();
  const tags = await library.tags('genre');
  expect(tags.length).toBeGreaterThan(0);
  expect(tags[0]).toBeInstanceOf(Genre);
  expect(typeof tags[0].tag).toBe('string');
  expect(typeof tags[0].filter).toBe('string');
  const items = await tags[0].items();
  expect(items.length).toBeGreaterThan(0);
  expect(items[0]).toBeInstanceOf(Movie);
});

it('should get movie section on deck items', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const onDeck = await section.onDeck();
  // On deck may be empty if nothing is in progress, that's OK
  expect(Array.isArray(onDeck)).toBe(true);
});

it('should get movie section recently added items', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const recentlyAdded = await section.recentlyAdded();
  expect(recentlyAdded.length).toBeGreaterThan(0);
  // Verify items are Movie instances
  expect(recentlyAdded[0]).toBeInstanceOf(Movie);
});

it('should list all movie section items with typed options', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const items = await section.all({ sort: 'titleSort', libtype: 'movie', maxResults: 2 });
  expect(items.length).toBe(2);
  expect(items[0]).toBeInstanceOf(Movie);
});

it('should get show section recently added items', async () => {
  const library = await plex.library();
  const section = await library.section<ShowSection>('TV Shows');
  const recentlyAdded = await section.recentlyAdded();
  expect(recentlyAdded.length).toBeGreaterThan(0);
});

it('should search show seasons and episodes', async () => {
  const library = await plex.library();
  const section = await library.section<ShowSection>('TV Shows');
  const seasons = await section.searchSeasons({ 'show.title': 'Silicon Valley' });
  const episodes = await section.searchEpisodes({ title: 'Minimum Viable Product' });
  expect(seasons[0]).toBeInstanceOf(Season);
  expect(episodes[0]).toBeInstanceOf(Episode);
});

it('should get recently added show content by type', async () => {
  const library = await plex.library();
  const section = await library.section<ShowSection>('TV Shows');
  const shows = await section.recentlyAddedShows();
  const seasons = await section.recentlyAddedSeasons();
  const episodes = await section.recentlyAddedEpisodes();
  expect(shows.length).toBeGreaterThan(0);
  expect(seasons[0]).toBeInstanceOf(Season);
  expect(episodes[0]).toBeInstanceOf(Episode);
});

it('should list sorts and filter choices', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const sorts = await section.listSorts();
  const genres = await section.listFilterChoices('genre');
  const sortedItems = await section.search({ sort: sorts[0], maxresults: 1 });
  expect(sorts[0]).toBeInstanceOf(FilteringSort);
  expect(genres[0]).toBeInstanceOf(FilterChoice);
  expect(sortedItems[0]).toBeInstanceOf(Movie);
});

it('should get items for a filter choice', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const genres = await section.listFilterChoices('genre');
  const items = await genres[0].items();
  expect(items.length).toBeGreaterThan(0);
  expect(items[0]).toBeInstanceOf(Movie);
});

it('should get library section managed hubs and timeline', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const hubs = await section.managedHubs();
  const timeline = await section.timeline();
  expect(hubs.length).toBeGreaterThan(0);
  expect(typeof hubs[0].identifier).toBe('string');
  expect(timeline).toBeInstanceOf(LibraryTimeline);
});

it('should get section continue watching items', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const items = await section.continueWatching();
  expect(Array.isArray(items)).toBe(true);
});

it('should search section hubs', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const hubs = await section.hubSearch('Bunny', { mediatype: 'movie', limit: 2 });
  expect(hubs.length).toBeGreaterThan(0);
  expect(typeof hubs[0].title).toBe('string');
  expect(hubs[0].type).toBe('movie');
});

it('should get common fields for movie items', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const bunny = await section.search({ title: 'Bunny' });
  const elephants = await section.search({ title: 'Elephants' });
  const common = await section.common([bunny[0], elephants[0]]);
  expect(common).toBeInstanceOf(Common);
  expect(common.commonType).toBe('movie');
  expect(common.ratingKeys).toEqual([Number(bunny[0].ratingKey), Number(elephants[0].ratingKey)]);
});

it('should get movie section first character data', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const characters = await section.firstCharacter();
  expect(characters.length).toBeGreaterThan(0);
  // Each character entry should have a title and size
  const firstChar = characters[0];
  expect(typeof firstChar.title).toBe('string');
  expect(typeof firstChar.size).toBe('number');
  expect(firstChar.size).toBeGreaterThan(0);
});

it('should have locations with paths', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  expect(section.locations.length).toBeGreaterThan(0);
  for (const location of section.locations) {
    expect(typeof location.id).toBe('number');
    expect(typeof location.path).toBe('string');
  }
});

it('should throw when removing all locations', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const allPaths = section.locations.map(loc => loc.path);
  await expect(section.removeLocations(allPaths)).rejects.toThrow(BadRequest);
});

it('should get totalViewSize for movie section', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const size = await section.totalViewSize();
  expect(size).toBeGreaterThan(0);
});

it('should get totalViewSize with libtype filter', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const size = await section.totalViewSize({ libtype: 'movie' });
  expect(typeof size).toBe('number');
  expect(size).toBeGreaterThan(0);
});

it('should get totalViewSize excluding collections', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const size = await section.totalViewSize({ includeCollections: false });
  expect(typeof size).toBe('number');
  expect(size).toBeGreaterThan(0);
});

it('should get totalSize for movie section', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const size = await section.totalSize();
  expect(size).toBeGreaterThan(0);
});

it('should get totalDuration for movie section', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const duration = await section.totalDuration();
  expect(typeof duration).toBe('number');
});

it('should get totalStorage for movie section', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const storage = await section.totalStorage();
  expect(typeof storage).toBe('number');
});

it('should add and remove locations', async () => {
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const originalCount = section.locations.length;
  const fakePath = '/tmp/plex-test-location';
  const updated = await section.addLocations(fakePath);
  expect(updated.locations.length).toBe(originalCount + 1);
  const restored = await updated.removeLocations(fakePath);
  expect(restored.locations.length).toBe(originalCount);
});
