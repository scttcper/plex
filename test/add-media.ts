import { createClient } from './test-client';

export async function addMedia(): Promise<void> {
  const server = await createClient();
  const library = await server.library();
  await library.add('Movies', 'movie', 'com.plexapp.agents.imdb', 'Plex Movie Scanner', '/data/movies');
  await library.add('TV Shows', 'show', 'com.plexapp.agents.thetvdb', 'Plex Series Scanner', '/data/shows');
}

if (!module.parent) {
  addMedia()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
