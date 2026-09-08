import { describe, expect, it, vi } from 'vitest';

import { PlexServer } from '../src/server.ts';
import { Movie } from '../src/video.ts';

describe('streamed downloads', () => {
  it('paginates descendants and cancels a body when iteration stops', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const item = new Movie(server, { key: '/library/metadata/10', ratingKey: '10' });
    const query = vi
      .spyOn(server, 'query')
      .mockResolvedValueOnce({
        MediaContainer: { Metadata: [{ key: '/library/metadata/10', type: 'show' }] },
      })
      .mockResolvedValueOnce({
        MediaContainer: {
          totalSize: 2,
          Metadata: [
            {
              key: '/library/metadata/11',
              Media: [{ Part: [{ key: '/parts/1', file: '/media/one.mkv' }] }],
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        MediaContainer: {
          totalSize: 2,
          Metadata: [
            {
              key: '/library/metadata/12',
              Media: [{ Part: [{ key: '/parts/2', file: 'C:\\media\\two.mkv' }] }],
            },
          ],
        },
      });
    const cancel = vi.fn();
    const stream = vi
      .spyOn(server, 'stream')
      .mockImplementation(async () => new ReadableStream({ cancel }));
    const downloads = item.download();
    const first = await downloads.next();
    expect(first.value).toMatchObject({ filename: 'one.mkv', key: '/library/metadata/11' });
    const second = await downloads.next();
    expect(second.value).toMatchObject({ filename: 'two.mkv', key: '/library/metadata/12' });
    expect(cancel).toHaveBeenCalledTimes(1);
    await downloads.return();
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(new URL(query.mock.calls[2][0].path).searchParams.get('X-Plex-Container-Start')).toBe(
      '1',
    );
    expect(new URL(stream.mock.calls[0][0]).searchParams.get('download')).toBe('1');
  });

  it('rejects media URLs on a different origin before streaming', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const item = new Movie(server, { key: '/library/metadata/10', ratingKey: '10' });
    vi.spyOn(server, 'query').mockResolvedValue({
      MediaContainer: {
        Metadata: [{ Media: [{ Part: [{ key: 'https://other.example/file' }] }] }],
      },
    });
    const stream = vi.spyOn(server, 'stream');
    await expect(item.download().next()).rejects.toThrow('Download URL must belong');
    expect(stream).not.toHaveBeenCalled();
  });
});
