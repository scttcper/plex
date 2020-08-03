import { describe, expect, it, beforeAll } from '@jest/globals';

import { PlexServer, MovieSection, ShowSection } from '../src';
import { createClient } from './test-client';

describe('Library', () => {
  let plex: PlexServer;
  beforeAll(async () => {
    plex = await createClient();
  });

  it('should get all sections', async () => {
    const library = await plex.library();
    const sections = await library.sections();
    expect(sections.length).toBeGreaterThanOrEqual(1);
    expect(sections.find(section => section.type === 'movie')!.type).toBe('movie');
  });

  it('should get a list of unwatched movies and mark one watched', async () => {
    const library = await plex.library();
    const section = await library.section<MovieSection>('Movies');
    const results = await section.search();
    expect(results.length).toBeGreaterThanOrEqual(4);
    await results[0].markWatched();
    await results[0].markUnwatched();
  });

  it('should search for movies matching a title', async () => {
    const library = await plex.library();
    const section = await library.section<MovieSection>('Movies');
    const results = await section.search({ title: 'Bunny' });
    expect(results).toHaveLength(1);
    // console.log(results[0]);
    // await results[0].reload();
    expect(results[0].title).toBe('Big Buck Bunny');
    expect(results[0].librarySectionID).toBe(1);
  });

  it('should search for tv show matching a title', async () => {
    const library = await plex.library();
    const section = await library.section<ShowSection>('TV Shows');
    const results = await section.search({ title: 'Game of Thrones' });
    expect(results[0].seasonNumber).toBe(1);
  });

  it('should search for all content matching search query', async () => {
    const results = await plex.search('Buck');
    expect(results.length).toBeGreaterThan(1);
    const movies = results.find(x => x.type === 'movie');
    expect(movies?.Metadata?.[0]?.title).toBe('Big Buck Bunny');
  });

  it('should list all clients connected to the Server.', async () => {
    const clients = await plex.clients();
    expect(clients.length).toBeGreaterThanOrEqual(1);
    // TODO: implement PlexClient
  });
});
