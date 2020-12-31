import pWaitFor from 'p-wait-for';

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
  let sections = await library.sections();
  await pWaitFor(
    async () => {
      if (sections.length) {
        const showSection = sections[0];
        const shows = await showSection.all();
        if (shows.length === 2) {
          return true;
        }
      }

      return false;
    },
    { interval: 2000, timeout: 60000 },
  );
  await delay(10000);

  await library.add(
    'Movies',
    'movie',
    'com.plexapp.agents.imdb',
    'Plex Movie Scanner',
    '/data/movies',
  );
  await delay(10000);
  sections = await library.sections();
  if (sections.length !== 2) {
    throw new Error('Sections not setup');
  }
}

if (!module.parent) {
  addMedia()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
