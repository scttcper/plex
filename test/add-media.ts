import pWaitFor from 'p-wait-for';

import { ShowSection } from '../src';
import { createClient } from './test-client';

const delay = async (ms: number) =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

export async function addMedia(): Promise<void> {
  await delay(30000);
  const server = await createClient();
  const library = await server.library();
  console.log('friendlyName', server.friendlyName);

  await library.add(
    'TV Shows',
    'show',
    'com.plexapp.agents.thetvdb',
    'Plex Series Scanner',
    '/data/shows',
  );
  await pWaitFor(
    async () => {
      const showSection = await library.section<ShowSection>('TV Shows');
      if (!showSection) {
        return false;
      }

      if (showSection.refreshing) {
        return false;
      }

      const shows = await showSection.all();
      if (shows.length === 2) {
        return true;
      }

      const thrones = await showSection.search({ title: 'Game of Thrones' });
      if (thrones[0]) {
        return (await thrones[0].episodes()).length === 20;
      }

      return false;
    },
    { interval: 2000, timeout: 60000 },
  );

  await library.add(
    'Movies',
    'movie',
    'com.plexapp.agents.imdb',
    'Plex Movie Scanner',
    '/data/movies',
  );
  await delay(30000);
}

if (!module.parent) {
  addMedia()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
