import { readFile } from 'node:fs/promises';

import { afterAll, beforeAll, expect, it } from 'vitest';

import {
  Art,
  ArtworkKind,
  Collections,
  Logo,
  type MovieSection,
  PlexServer,
  Poster,
  SquareArt,
} from '../src/index.ts';

import { createClient } from './test-client.ts';

const collectionTitle = '__artwork_management_test__';

let plex: PlexServer;
let movieSection: MovieSection;

async function cleanupArtworkCollection(): Promise<void> {
  const collections = await movieSection.collections();
  const matches = collections.filter(collection => collection.title === collectionTitle);
  await Promise.all(
    matches.map(collection =>
      plex.query({ path: `/library/metadata/${collection.ratingKey}`, method: 'delete' }),
    ),
  );
}

beforeAll(async () => {
  plex = await createClient();
  movieSection = await (await plex.library()).section<MovieSection>('Movies');
  await cleanupArtworkCollection();
});

afterAll(async () => {
  await cleanupArtworkCollection();
});

it('uploads, lists, selects, locks, and deletes typed artwork resources', async () => {
  const [movie] = await movieSection.search({ libtype: 'movie', maxresults: 1 });
  expect(movie).toBeDefined();
  const collection = await Collections.create(plex, collectionTitle, {
    section: movieSection,
    items: [movie!],
  });
  const image = await readFile(new URL('./data/cute_cat.jpg', import.meta.url));

  await collection.artwork.upload({ kind: ArtworkKind.Art, data: image });
  await collection.artwork.upload({ kind: ArtworkKind.Logo, data: image });
  await collection.artwork.upload({ kind: ArtworkKind.Poster, data: image });
  await collection.artwork.upload({ kind: ArtworkKind.SquareArt, data: image });

  const arts = await collection.artwork.arts();
  const logos = await collection.artwork.logos();
  const posters = await collection.artwork.posters();
  const squareArts = await collection.artwork.squareArts();
  const art = arts.find(resource => resource.ratingKey.startsWith('upload://'));
  const logo = logos.find(resource => resource.ratingKey.startsWith('upload://'));
  const poster = posters.find(resource => resource.ratingKey.startsWith('upload://'));
  const squareArt = squareArts.find(resource => resource.ratingKey.startsWith('upload://'));

  expect(art).toBeInstanceOf(Art);
  expect(logo).toBeInstanceOf(Logo);
  expect(poster).toBeInstanceOf(Poster);
  expect(squareArt).toBeInstanceOf(SquareArt);
  expect(typeof poster!.selected).toBe('boolean');
  expect(typeof poster!.ratingKey).toBe('string');

  await collection.artwork.delete(ArtworkKind.Logo);
  const deselectedLogo = (await collection.artwork.logos()).find(
    resource => resource.ratingKey === logo!.ratingKey,
  );
  expect(deselectedLogo!.selected).toBe(false);

  await collection.artwork.select(deselectedLogo!);
  const selectedLogo = (await collection.artwork.logos()).find(
    resource => resource.ratingKey === logo!.ratingKey,
  );
  expect(selectedLogo!.selected).toBe(true);

  await collection.artwork.setLocked({ kind: ArtworkKind.Logo, locked: true });
  await collection.artwork.setLocked({ kind: ArtworkKind.Logo, locked: false });
  await collection.artwork.delete(ArtworkKind.Logo);

  const remainingLogos = await collection.artwork.logos();
  expect(remainingLogos.some(resource => resource.selected)).toBe(false);
});
