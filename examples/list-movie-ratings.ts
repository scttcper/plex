import { type MovieSection, MyPlexAccount } from '../src/index.js';

async function listMovies() {
  const account = await new MyPlexAccount(
    process.env.PLEX_HOST,
    process.env.PLEX_USERNAME,
    process.env.PLEX_PASSWORD,
  ).connect();
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
