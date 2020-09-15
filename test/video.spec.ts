import { describe, it, beforeAll, expect } from '@jest/globals';

import { PlexServer, ShowSection } from '../src';
import { Show } from '../src/video';
import { createClient } from './test-client';

describe('Show', () => {
  let plex: PlexServer;
  let show: Show;
  beforeAll(async () => {
    plex = await createClient();
    const library = await plex.library();
    const section = await library.section<ShowSection>('TV Shows');
    const results = await section.search({ title: 'Game of Thrones' });
    show = results[0];
  });

  it('should get show details', async () => {
    const library = await plex.library();
    const section = await library.section<ShowSection>('TV Shows');
    const results = await section.search({ title: 'Game of Thrones' });
    const show = results[0];
    await show.reload();
    expect(show.key).toBe(show._details_key);
    // console.log(show.genres);
    // // const seasons = await show.seasons({ index: 2 });
    // // console.log(seasons);
  });

  it('should should get a shows\'s episodes', async () => {
    const episodes = await show.episodes();
    // 2 seasons of GoT
    expect(episodes.length).toBe(20);
  });

  it('should should get a season\'s episodes', async () => {
    const seasons = await show.seasons();
    const episodes = await seasons[0].episodes();
    // Season 1 of GoT
    expect(episodes.length).toBe(10);
  });
});
