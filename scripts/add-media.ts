import { setTimeout as sleep } from 'node:timers/promises';

import type { PlexServer } from '../src/index.js';
import { createClient } from '../test/test-client.js';

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
  await sleep(10_000);
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
      'prefs[enableVoiceActivityGeneration]': '0',
    },
  );

  await sleep(25_000);
}

if (!module.parent) {
  addMedia()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
