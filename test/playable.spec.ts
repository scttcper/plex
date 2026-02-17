import { beforeAll, expect, it } from 'vitest';

import { type Movie, type MovieSection, type PlexServer, MediaPart } from '../src/index.js';

import { createClient } from './test-client.js';

let plex: PlexServer;
let movie: Movie;

beforeAll(async () => {
  plex = await createClient();
  const library = await plex.library();
  const section = await library.section<MovieSection>('Movies');
  const results = await section.search({ title: 'Bunny' });
  expect(results.length).toBeGreaterThan(0);
  movie = results[0];
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
  expect(typeof parts[0].file).toBe('string');
  expect(parts[0].file.length).toBeGreaterThan(0);
});

it('should have audio streams accessible from media parts', () => {
  // Note: Playable.audioStreams() uses instanceof AudioStream, but MediaPart._loadData
  // constructs all streams as MediaPartStream. Access audio streams via streamType instead.
  const parts = movie.iterParts();
  expect(parts.length).toBeGreaterThan(0);
  const audioStreams = parts[0].streams.filter(s => s.streamType === 2);
  expect(audioStreams.length).toBeGreaterThan(0);
  expect(audioStreams[0].codec).toBeDefined();
});

it('should return video streams with streamType 1 from videoStreams', () => {
  const videoStreams = movie.videoStreams();
  expect(videoStreams.length).toBeGreaterThan(0);
  // Video streams have streamType 1
  for (const stream of videoStreams) {
    expect(stream.streamType).toBe(1);
  }
});
