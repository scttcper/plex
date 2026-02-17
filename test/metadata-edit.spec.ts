import { afterAll, beforeAll, expect, it } from 'vitest';

import { type Movie, type MovieSection, type PlexServer } from '../src/index.js';

import { createClient } from './test-client.js';

let plex: PlexServer;
let movie: Movie;
let originalTitle: string;
let originalSummary: string;
let originalSortTitle: string | undefined;
let originalContentRating: string;

beforeAll(async () => {
  plex = await createClient();
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  // Try "Sita Sings the Blues" first, fall back to "Elephants Dream"
  let results = await section.search({ title: 'Sita' });
  if (results.length === 0) {
    results = await section.search({ title: 'Elephant' });
  }

  expect(results.length).toBeGreaterThan(0);
  movie = results[0];
  // Reload to get full object with all fields
  await movie.reload();
  originalTitle = movie.title;
  originalSummary = movie.summary;
  originalSortTitle = movie.titleSort;
  originalContentRating = movie.contentRating;
});

afterAll(async () => {
  // Restore original values
  if (movie) {
    await movie.editTitle(originalTitle);
    await movie.editSummary(originalSummary);
    if (originalSortTitle) {
      await movie.editSortTitle(originalSortTitle);
    }

    if (originalContentRating) {
      await movie.editContentRating(originalContentRating);
    }
  }
});

it('should edit movie title', async () => {
  await movie.editTitle('Test Title Edit');
  await movie.reload();
  expect(movie.title).toBe('Test Title Edit');
});

it('should edit movie summary', async () => {
  await movie.editSummary('Test summary edit');
  await movie.reload();
  expect(movie.summary).toBe('Test summary edit');
});

it('should edit movie sort title', async () => {
  await movie.editSortTitle('ZZZZZ Test Sort Title');
  await movie.reload();
  expect(movie.titleSort).toBe('ZZZZZ Test Sort Title');
});

it('should edit movie content rating', async () => {
  await movie.editContentRating('PG-13');
  await movie.reload();
  expect(movie.contentRating).toBe('PG-13');
});
