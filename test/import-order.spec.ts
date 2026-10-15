import { expect, it } from 'vitest';

// Import a model module before anything else so it starts the circular import chain, the same
// way a deep import of dist/src/audio.js would.
import { Album, Artist, Track } from '../src/audio.ts';
import { classForPlexType } from '../src/itemFactory.ts';
import { Episode, Movie } from '../src/video.ts';

it('resolves item classes no matter which model module loads first', () => {
  expect(classForPlexType('track')).toBe(Track);
  expect(classForPlexType('album')).toBe(Album);
  expect(classForPlexType('artist')).toBe(Artist);
  expect(classForPlexType('episode')).toBe(Episode);
  expect(classForPlexType('movie')).toBe(Movie);
});
