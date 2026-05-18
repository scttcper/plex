import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import type { PlexServer } from '../src/index.ts';
import { createClient } from '../test/test-client.ts';

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

  await library.add({
    name: 'TV Shows',
    type: 'show',
    agent: 'tv.plex.agents.series',
    scanner: 'Plex TV Series',
    locations: '/data/shows',
    language: 'en-US',
    preferences: {
      useLocalAssets: '0',
      useExternalExtras: '0',
      enableBIFGeneration: '0',
      augmentWithProviderContent: '0',
    },
  });
  await sleep(10_000);
  await library.add({
    name: 'Movies',
    type: 'movie',
    agent: 'tv.plex.agents.movie',
    scanner: 'Plex Movie',
    locations: '/data/movies',
    language: 'en-US',
    preferences: {
      enableCinemaTrailers: '0',
      useLocalAssets: '0',
      useExternalExtras: '0',
      enableBIFGeneration: '0',
      augmentWithProviderContent: '0',
      enableVoiceActivityGeneration: '0',
    },
  });

  await sleep(25_000);
}

const __filename = fileURLToPath(import.meta.url);
const mainModulePath = path.resolve(process.argv[1]);
if (__filename === mainModulePath) {
  addMedia()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
