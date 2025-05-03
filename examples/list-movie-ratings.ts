import { parseArgs } from 'node:util';

import { type MovieSection, MyPlexAccount } from '../src/index.js';

const {
  values: { username, password, host },
} = parseArgs({
  options: {
    username: {
      type: 'string',
      short: 'u',
    },
    password: {
      type: 'string',
      short: 'p',
    },
    host: {
      type: 'string',
      short: 'h',
    },
  },
});

async function listMovies() {
  const account = await new MyPlexAccount(host, username, password).connect();
  const resource = await account.resource('cooper-plex');
  const plex = await resource.connect();
  const library = await plex.library();
  const movieSection = await library.section<MovieSection>('Movies');
  const movies = await movieSection.all();

  for (const movie of movies) {
    await movie.reload();
    console.log('---');
    console.log(movie.title);
    console.log(
      movie.ratings.map(rating => ({
        image: rating.image,
        type: rating.type,
        value: rating.value,
      })),
    );
    console.log(movie.guids.find(g => g.id.startsWith('imdb:'))?.id);
    console.log();
  }
}

listMovies().then(() => console.log('done'));
