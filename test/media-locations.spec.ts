import { describe, expect, it, vi } from 'vitest';

import { PlexServer } from '../src/server.ts';
import { Clip, Episode, Movie } from '../src/video.ts';

const metadata = {
  key: '/library/metadata/10',
  ratingKey: '10',
  Media: [
    {
      Part: [
        { key: '/parts/1' },
        { key: '/parts/2', file: '' },
        { key: '/parts/3', file: '/media/movie.mp4' },
      ],
    },
  ],
};

describe('video file locations', () => {
  it('omits absent and empty clip filenames', () => {
    const clip = new Clip(new PlexServer('http://localhost:32400', 'test'), {
      ...metadata,
      type: 'clip',
    });
    expect(clip.locations()).toEqual(['/media/movie.mp4']);
  });

  it('omits absent and empty episode filenames', () => {
    const episode = new Episode(new PlexServer('http://localhost:32400', 'test'), {
      ...metadata,
      type: 'episode',
    });
    expect(episode.locations()).toEqual(['/media/movie.mp4']);
  });

  it('omits absent and empty movie filenames', async () => {
    const movie = new Movie(new PlexServer('http://localhost:32400', 'test'), {
      ...metadata,
      type: 'movie',
    });
    vi.spyOn(movie, 'reload').mockImplementation(async () => {});
    expect(await movie.locations()).toEqual(['/media/movie.mp4']);
  });
});
