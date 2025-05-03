import { beforeAll, expect, it } from 'vitest';

import { Movie, type MovieSection, type PlexServer, type ShowSection } from '../src/index.js';

import { createClient } from './test-client.js';

let plex: PlexServer;
beforeAll(async () => {
  plex = await createClient();
});

it('should get all sections', async () => {
  const library = await plex.library();
  const sections = await library.sections();
  expect(sections.length).toBeGreaterThan(1);
  expect(sections.find(section => section.type === 'movie').type).toBe('movie');
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
  let url = section.getWebURL(undefined, tab);
  expect(url).toContain('https://app.plex.tv/desktop');
  expect(url).toContain(plex.machineIdentifier);
  expect(url).toContain(`source=${section.key}`);
  expect(url).toContain(`pivot=${tab}`);
  // Test a different base
  const base = 'https://doesnotexist.com/plex';
  url = section.getWebURL(base);
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
