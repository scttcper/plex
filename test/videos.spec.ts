import { describe, expect, it, beforeAll } from '@jest/globals';

import { PlexServer, ShowSection } from '../src';
import { createClient } from './test-client';

describe('Name of the group', () => {
  let plex: PlexServer;
  beforeAll(async () => {
    plex = await createClient();
  });

  it('should get tv show episodes', async () => {
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
});
