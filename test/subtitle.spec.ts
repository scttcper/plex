import { setTimeout as sleep } from 'node:timers/promises';

import { afterAll, beforeAll, expect, it } from 'vitest';

import {
  type MediaPart,
  type Movie,
  type MovieSection,
  type PlexServer,
  SubtitleStream,
} from '../src/index.ts';

import { createClient } from './test-client.ts';

const subtitleTitle = 'plex-ts-selection-test';
let plex: PlexServer;
let movie: Movie;
let part: MediaPart;
let subtitle: SubtitleStream;

async function cleanupTestSubtitles(): Promise<void> {
  await movie.reload();
  const leftovers = movie
    .subtitleStreams()
    .filter(
      stream => stream.title === subtitleTitle && stream.key === `/library/streams/${stream.id}`,
    );
  for (const stream of leftovers) {
    await plex.query({ path: stream.key, method: 'delete' });
  }
}

async function waitForDownloadedSubtitle(
  existingIds: ReadonlySet<number>,
): Promise<SubtitleStream> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await sleep(500);
    await movie.reload();
    const downloaded = movie
      .subtitleStreams()
      .find(
        stream => !existingIds.has(stream.id) && stream.key === `/library/streams/${stream.id}`,
      );
    if (downloaded) {
      return downloaded;
    }
  }
  throw new Error('Downloaded subtitle did not appear on the Plex item.');
}

async function cleanupDownloadedSubtitle(stream: SubtitleStream | undefined): Promise<void> {
  if (stream?.key === `/library/streams/${stream.id}`) {
    await plex.query({ path: stream.key, method: 'delete' });
  }
}

beforeAll(async () => {
  plex = await createClient();
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  [movie] = await section.search({ title: 'Bunny' });
  await movie.reload();
  await cleanupTestSubtitles();

  await plex.query({
    path: `${movie.key}/subtitles?${new URLSearchParams({
      title: `${subtitleTitle}.srt`,
      format: 'srt',
    }).toString()}`,
    method: 'post',
    headers: { Accept: 'text/plain, */*' },
    body: new TextEncoder().encode('1\n00:00:00,000 --> 00:00:01,000\nSubtitle test\n'),
  });
  await movie.reload();

  const matches = movie.subtitleStreams().filter(stream => stream.title === subtitleTitle);
  expect(matches).toHaveLength(1);
  [subtitle] = matches;
  const matchingParts = movie
    .iterParts()
    .filter(candidate => candidate.subtitleStreams().some(stream => stream.id === subtitle.id));
  expect(matchingParts).toHaveLength(1);
  [part] = matchingParts;
});

afterAll(async () => {
  await part?.resetSelectedSubtitleStream();
  await cleanupTestSubtitles();
});

it('constructs typed subtitle streams and selects or resets them', async () => {
  expect(subtitle).toBeInstanceOf(SubtitleStream);
  expect(typeof subtitle.id).toBe('number');
  expect(typeof subtitle.key).toBe('string');
  expect(typeof subtitle.canAutoSync).toBe('boolean');
  expect(typeof subtitle.selected).toBe('boolean');
  expect(typeof subtitle.format).toBe('string');
  expect(typeof subtitle.displayTitle).toBe('string');

  await subtitle.setSelected();
  await movie.reload();
  const selectedSubtitle = movie.subtitleStreams().find(stream => stream.title === subtitleTitle);
  expect(selectedSubtitle?.selected).toBe(true);

  const selectedPart = movie
    .iterParts()
    .find(candidate =>
      candidate.subtitleStreams().some(stream => stream.id === selectedSubtitle?.id),
    );
  expect(selectedPart).toBeDefined();
  await selectedPart!.resetSelectedSubtitleStream();
  expect(selectedSubtitle?.selected).toBe(false);
  await movie.reload();
  const resetSubtitle = movie.subtitleStreams().find(stream => stream.title === subtitleTitle);
  expect(resetSubtitle?.selected).toBeUndefined();
});

it('searches for and downloads an on-demand subtitle', async () => {
  const results = await movie.searchSubtitles({
    language: 'en',
    hearingImpaired: 0,
    forced: 0,
  });
  expect(results.length).toBeGreaterThan(0);
  const [result] = results;
  expect(result).toBeInstanceOf(SubtitleStream);
  expect(typeof result.id).toBe('number');
  expect(typeof result.key).toBe('string');
  expect(typeof result.languageTag).toBe('string');
  expect(typeof result.providerTitle).toBe('string');
  expect(typeof result.score).toBe('number');
  expect(typeof result.sourceKey).toBe('string');

  const existingIds = new Set(movie.subtitleStreams().map(stream => stream.id));
  let downloaded: SubtitleStream | undefined;
  try {
    await movie.downloadSubtitle(result);
    downloaded = await waitForDownloadedSubtitle(existingIds);
    expect(typeof downloaded.key).toBe('string');
    expect(typeof downloaded.sourceKey).toBe('string');
    expect(typeof downloaded.title).toBe('string');
    expect(typeof downloaded.providerTitle).toBe('string');
    expect(typeof downloaded.transient).toBe('string');
  } finally {
    await cleanupDownloadedSubtitle(downloaded);
  }
});
