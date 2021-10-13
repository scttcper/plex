import { PlexServer } from '../src';
import { createClient } from '../test/test-client';

const delay = async (ms: number) =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

export async function addMedia(): Promise<void> {
  let server: PlexServer;
  try {
    server = await createClient();
  } catch (err) {
    console.log('creating client failed');
    throw err;
  }

  const library = await server.library();
  console.log('friendlyName', server.friendlyName);

  await library.add(
    'TV Shows',
    'show',
    'tv.plex.agents.series',
    'Plex TV Series',
    '/data/shows',
    'en-US',
    {
      'prefs[useLocalAssets]': '0',
      'prefs[useExternalExtras]': '0',
      'prefs[enableBIFGeneration]': '0',
      'prefs[augmentWithProviderContent]': '0',
    },
  );
  await delay(10000);
  await library.add(
    'Movies',
    'movie',
    'tv.plex.agents.movie',
    'Plex Movie',
    '/data/movies',
    'en-US',
    {
      'prefs[enableCinemaTrailers]': '0',
      'prefs[useLocalAssets]': '0',
      'prefs[useExternalExtras]': '0',
      'prefs[enableBIFGeneration]': '0',
      'prefs[augmentWithProviderContent]': '0',
    },
  );

  await delay(25000);
}

if (!module.parent) {
  addMedia()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
