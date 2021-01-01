import { createClient } from '../test/test-client';

const delay = async (ms: number) =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

export async function addMedia(): Promise<void> {
  const server = await createClient();
  const library = await server.library();
  console.log('friendlyName', server.friendlyName);

  await library.add(
    'TV Shows',
    'show',
    'com.plexapp.agents.thetvdb',
    'Plex Series Scanner',
    '/data/shows',
    'en',
  );
  await delay(10000);
  await library.add(
    'Movies',
    'movie',
    'com.plexapp.agents.imdb',
    'Plex Movie Scanner',
    '/data/movies',
    'en',
    {
      'prefs[enableBIFGeneration]': '0',
      'prefs[augmentWithProviderContent]': '0',
      'prefs[collectionMode]': '0',
    },
  );

  await delay(20000);
}

if (!module.parent) {
  addMedia()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
