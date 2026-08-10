import { readdir, rm } from 'node:fs/promises';

import { afterAll, beforeAll, expect, it } from 'vitest';

import { Movie, type MovieSection, Optimized, type PlexServer } from '../src/index.ts';

import { createClient } from './test-client.ts';

const optimizedTitle = '__optimized_media_test__';
const renamedOptimizedTitle = '__optimized_media_test_renamed__';
const plexVersionsDirectory = new URL('../plex/media/Movies/Plex Versions', import.meta.url);

let movieSection: MovieSection;
let plex: PlexServer;
let originalBackgroundQueuePaused: boolean;

async function cleanupOptimizedMedia(): Promise<void> {
  const groups = await plex.optimizedItems();
  const matches = groups.filter(group =>
    [optimizedTitle, renamedOptimizedTitle].includes(group.title),
  );
  await Promise.all(matches.map(group => group.remove()));
  await removeEmptyPlexVersionsDirectory();
}

async function removeEmptyPlexVersionsDirectory(): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(plexVersionsDirectory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    throw error;
  }
  if (entries.length === 0) {
    await rm(plexVersionsDirectory, { force: true, recursive: true });
  }
}

async function setBackgroundQueuePaused(paused: boolean): Promise<void> {
  const params = new URLSearchParams({ BackgroundQueueIdlePaused: paused ? '1' : '0' });
  await plex.query({ path: `/:/prefs?${params.toString()}`, method: 'put' });
}

beforeAll(async () => {
  plex = await createClient();
  plex.baseurl = 'http://localhost:32400';
  movieSection = await (await plex.library()).section<MovieSection>('Movies');
  const pauseSetting = (await plex.settings()).get('BackgroundQueueIdlePaused');
  if (typeof pauseSetting.value !== 'boolean') {
    throw new TypeError('BackgroundQueueIdlePaused did not return a boolean value.');
  }
  originalBackgroundQueuePaused = pauseSetting.value;
  await setBackgroundQueuePaused(true);
  await cleanupOptimizedMedia();
});

afterAll(async () => {
  try {
    await cleanupOptimizedMedia();
  } finally {
    await setBackgroundQueuePaused(originalBackgroundQueuePaused);
  }
});

it('creates, inspects, renames, and removes strongly typed optimized media', async () => {
  const movie = await movieSection.get({ title: 'Ghostbusters' });
  const optimized = await movie.optimize({
    title: optimizedTitle,
    target: {
      profile: 'Universal Mobile',
      maxBitrate: 1500,
      name: 'Custom: Integration Test',
      quality: 60,
      resolution: { height: 480, width: 720 },
    },
  });

  expect(optimized).toBeInstanceOf(Optimized);
  expect(typeof optimized.id).toBe('number');
  expect(optimized.type).toBe(42);
  expect(optimized.title).toBe(optimizedTitle);
  expect(optimized.target).toBe('Custom: Integration Test');
  expect(optimized.targetTagID).toBeUndefined();
  expect(optimized.status.itemsCount).toBe(1);
  expect(typeof optimized.status.state).toBe('string');
  expect(optimized.mediaSettings.videoQuality).toBe(60);
  expect(optimized.mediaSettings.maxVideoBitrate).toBe(1500);
  expect(optimized.mediaSettings.videoResolution).toBe('720x480');
  expect(optimized.policy.scope).toBe('all');
  expect(optimized.policy.unwatched).toBe(false);
  expect(optimized.location.librarySectionID).toBe(Number(movieSection.key));
  expect(optimized.location.uri).toBe(
    `library://${movieSection.uuid}/item/${encodeURIComponent(movie.key)}`,
  );
  expect(optimized.device.profile).toBe('Universal Mobile');

  expect(await plex.backgroundTranscodeJobs()).toEqual([]);

  const items = await optimized.items();
  expect(items).toHaveLength(1);
  expect(items[0]).toBeInstanceOf(Movie);
  expect(items[0].ratingKey).toBe(movie.ratingKey);
  expect(items[0].processingState).toBe('pending');

  await optimized.rename(renamedOptimizedTitle);
  expect(optimized.title).toBe(renamedOptimizedTitle);
  expect((await plex.optimizedItems()).find(group => group.id === optimized.id)?.title).toBe(
    renamedOptimizedTitle,
  );

  await optimized.remove();
  expect((await plex.optimizedItems()).some(group => group.id === optimized.id)).toBe(false);

  const preset = await movie.optimize({ target: 'original', title: optimizedTitle });
  expect(preset.target).toBe('Original Quality');
  expect(preset.targetTagID).toBe(3);
  expect(preset.mediaSettings.videoQuality).toBeUndefined();
  expect(preset.mediaSettings.videoResolution).toBeUndefined();
  await preset.remove();
}, 30_000);
