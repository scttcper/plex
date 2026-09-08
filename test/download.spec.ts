import { describe, expect, it, vi } from 'vitest';

import type { MediaDownload } from '../src/download.ts';
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

const multipart = {
  MediaContainer: {
    Metadata: [
      {
        key: '/library/metadata/10',
        Media: [
          {
            Part: [
              { key: '/parts/1', file: '/media/one.mkv' },
              { key: '/parts/2', file: '/media/two.mkv' },
            ],
          },
          { Part: [{ key: '/parts/3', file: '/media/three.mp4' }] },
        ],
      },
    ],
  },
};

describe('download cancellation and media versions', () => {
  it('downloads every part of the first version by default', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const item = new Movie(server, { key: '/library/metadata/10', ratingKey: '10' });
    vi.spyOn(server, 'query').mockResolvedValue(multipart);
    const stream = vi.spyOn(server, 'stream').mockImplementation(async () => new ReadableStream());
    const names = await downloadNames(item.download());
    expect(names).toEqual(['one.mkv', 'two.mkv']);
    expect(stream).toHaveBeenCalledTimes(2);
  });

  it('includes every version when requested', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const item = new Movie(server, { key: '/library/metadata/10', ratingKey: '10' });
    vi.spyOn(server, 'query').mockResolvedValue(multipart);
    vi.spyOn(server, 'stream').mockImplementation(async () => new ReadableStream());
    const names = await downloadNames(item.download({ allVersions: true }));
    expect(names).toEqual(['one.mkv', 'two.mkv', 'three.mp4']);
  });

  it('aborts a transfer on iterator return even while a reader holds the lock', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const item = new Movie(server, { key: '/library/metadata/10', ratingKey: '10' });
    vi.spyOn(server, 'query').mockResolvedValue(multipart);
    const body = new ReadableStream<Uint8Array>();
    const stream = vi.spyOn(server, 'stream').mockResolvedValue(body);
    const downloads = item.download();
    await downloads.next();
    const reader = body.getReader();
    await downloads.return();
    expect(stream.mock.calls[0][1]?.signal?.aborted).toBe(true);
    reader.releaseLock();
    await body.cancel();
  });

  it('propagates cancellation during a transfer and never opens the next part', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const item = new Movie(server, { key: '/library/metadata/10', ratingKey: '10' });
    vi.spyOn(server, 'query').mockResolvedValue(multipart);
    const stream = vi.spyOn(server, 'stream').mockImplementation(async () => new ReadableStream());
    const controller = new AbortController();
    const downloads = item.download({ signal: controller.signal });
    await downloads.next();
    controller.abort(new Error('stop download'));
    expect(stream.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await expect(downloads.next()).rejects.toThrow('stop download');
    expect(stream).toHaveBeenCalledTimes(1);
  });

  it('preserves a consumer failure when cancellation also fails', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const item = new Movie(server, { key: '/library/metadata/10', ratingKey: '10' });
    vi.spyOn(server, 'query').mockResolvedValue(multipart);
    vi.spyOn(server, 'stream').mockResolvedValue(
      new ReadableStream({
        cancel() {
          throw new Error('cleanup failed');
        },
      }),
    );
    const downloads = item.download();
    await downloads.next();
    const failure = new Error('consumer failed');
    await expect(downloads.throw(failure)).rejects.toBe(failure);
  });

  it('releases the request when opening a stream fails', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const item = new Movie(server, { key: '/library/metadata/10', ratingKey: '10' });
    vi.spyOn(server, 'query').mockResolvedValue(multipart);
    const failure = new Error('connection failed');
    const stream = vi.spyOn(server, 'stream').mockRejectedValue(failure);
    await expect(item.download().next()).rejects.toBe(failure);
    expect(stream.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
});

async function downloadNames(downloads: AsyncIterable<MediaDownload>): Promise<string[]> {
  const names: string[] = [];
  for await (const file of downloads) {
    names.push(file.filename);
  }
  return names;
}
