import { beforeAll, expect, it } from 'vitest';

import {
  AudioStream,
  type Movie,
  type MovieSection,
  type PlexServer,
  MediaPart,
  VideoStream,
} from '../src/index.ts';

import { assertDefined, first } from './assertions.ts';
import { createClient } from './test-client.ts';

let plex: PlexServer;
let movie: Movie;

/** Put a shared item's view count and resume position back after a test changes them. */
async function restoreWatchState(
  item: Movie,
  { viewCount, viewOffset }: { viewCount: number; viewOffset: number },
): Promise<void> {
  await item.markUnplayed();
  for (let count = 0; count < viewCount; count += 1) {
    await item.markPlayed();
  }
  if (viewOffset > 0) {
    await item.updateTimeline({ time: viewOffset });
  }
}

beforeAll(async () => {
  plex = await createClient();
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const results = await section.search({ title: 'Bunny' });
  expect(results.length).toBeGreaterThan(0);
  movie = first(results);
  // Reload to get full object with media/parts/streams
  await movie.reload();
});

it('should get a stream URL containing transcode and auth token', () => {
  const url = movie.getStreamURL();
  expect(typeof url).toBe('string');
  expect(url).toContain('transcode');
  expect(url).toContain(plex.token);
});

it('should return MediaPart objects from iterParts', () => {
  const parts = movie.iterParts();
  expect(parts.length).toBeGreaterThan(0);
  expect(parts[0]).toBeInstanceOf(MediaPart);
  expect(typeof first(parts).file).toBe('string');
  expect(first(parts).file).not.toBe('');
});

it('should have audio streams accessible from media parts', () => {
  const audioStreams = movie.audioStreams();
  expect(audioStreams.length).toBeGreaterThan(0);
  expect(audioStreams[0]).toBeInstanceOf(AudioStream);
  expect(first(audioStreams).codec).toBeDefined();
});

it('should return strongly typed video streams', () => {
  const [stream] = movie.videoStreams();
  assertDefined(stream);

  expect(stream).toBeInstanceOf(VideoStream);
  expect(stream.streamType).toBe(1);
  expect(stream.codec).toBe('h264');
  expect(stream.bitDepth).toBe(8);
  expect(stream.frameRate).toBe(30);
  expect(stream.height).toBe(1080);
  expect(stream.hasScalingMatrix).toBe(false);
  expect(stream.streamIdentifier).toBe(1);
  expect(stream.width).toBe(1920);
});

it('should update progress and timeline position', async () => {
  await movie.reload();
  const original = { viewCount: movie.viewCount ?? 0, viewOffset: movie.viewOffset };

  try {
    await movie.markUnplayed();
    await movie.updateProgress({ time: 90_000 });
    await movie.reload();
    expect(movie.viewOffset).toBe(90_000);
    await movie.updateTimeline({ time: 120_000 });
    await movie.reload();
    expect(movie.viewOffset).toBe(120_000);
  } finally {
    await restoreWatchState(movie, original);
  }

  await movie.reload();
  expect(movie.viewCount).toBe(original.viewCount);
  expect(movie.viewOffset).toBe(original.viewOffset);
});
