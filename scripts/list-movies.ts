import { MovieSection, MyPlexAccount } from '../src/index.js';

async function listMovies() {
  const account = await new MyPlexAccount(
    'http://136.24.98.251:32400',
    'scttcper@gmail.com',
    'wqu@vky!vjg7RKA_dfk',
  ).connect();
  const resource = await account.resource('cooper-plex');
  const plex = await resource.connect();
  const library = await plex.library();
  const movieSection = await library.section<MovieSection>('Movies');
  const movies = await movieSection.all();

  for (const movie of movies) {
    // eslint-disable-next-line no-await-in-loop
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
