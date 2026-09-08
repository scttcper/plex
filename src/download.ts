import { win32 } from 'node:path';

import type { PartialPlexObject } from './base/partialPlexObject.ts';
import { BadRequest } from './exceptions.ts';
import type { PlexServer } from './server.ts';

export interface DownloadOptions {
  signal?: AbortSignal;
  /** Download all media versions. Defaults to the first version only. */
  allVersions?: boolean;
}

export interface MediaDownload {
  /** Original filename without any server directory components. */
  filename: string;
  /** Metadata item this file belongs to. */
  key: string;
  /** Consume this stream before requesting the next file. */
  body: ReadableStream<Uint8Array>;
}

interface DownloadMetadata {
  key?: string;
  title?: string;
  type?: string;
  Media?: Array<{ Part?: Array<{ key?: string; file?: string }> }>;
}

interface DownloadContainer {
  totalSize?: number;
  size?: number;
  Metadata?: DownloadMetadata[];
  Directory?: DownloadMetadata[];
  Video?: DownloadMetadata[];
  Track?: DownloadMetadata[];
  Photo?: DownloadMetadata[];
}

/** Stream original files for an item or its descendants without buffering them in memory. */
export async function* downloadMedia(
  item: PartialPlexObject,
  options: DownloadOptions = {},
): AsyncGenerator<MediaDownload, void> {
  const visited = new Set<string>();
  const server = item.server;
  async function* visit(path: string): AsyncGenerator<MediaDownload, void> {
    options.signal?.throwIfAborted();
    if (visited.has(path)) {
      return;
    }
    visited.add(path);
    for await (const metadata of downloadMetadata(server, path, options.signal)) {
      if (metadata.Media?.length) {
        const media = options.allVersions ? metadata.Media : metadata.Media.slice(0, 1);
        for (const part of media.flatMap(version => version.Part ?? [])) {
          if (!part.key) {
            continue;
          }
          const url = server.url(part.key);
          if (url.origin !== new URL(server.baseurl).origin) {
            throw new BadRequest('Download URL must belong to the Plex server.');
          }
          url.searchParams.set('download', '1');
          const body = await server.stream(url.toString(), { signal: options.signal });
          try {
            yield {
              filename: win32.basename(part.file ?? part.key),
              key: metadata.key ?? path,
              body,
            };
          } finally {
            if (!body.locked) {
              await body.cancel();
            }
          }
        }
      } else if (metadata.key) {
        const base = metadata.key.replace(/\/(?:children|items)$/, '');
        const suffix = metadata.type === 'playlist' ? 'items' : 'children';
        yield* visit(`${base}/${suffix}`);
      }
    }
  }
  yield* visit(item.key);
}

async function* downloadMetadata(
  server: PlexServer,
  path: string,
  signal?: AbortSignal,
): AsyncGenerator<DownloadMetadata> {
  let offset = 0;
  while (true) {
    const url = server.url(path);
    url.searchParams.set('X-Plex-Container-Start', String(offset));
    url.searchParams.set('X-Plex-Container-Size', '100');
    const { MediaContainer: data } = await server.query<{ MediaContainer: DownloadContainer }>({
      path: url.toString(),
      signal,
    });
    const items = [
      ...(data.Metadata ?? []),
      ...(data.Directory ?? []),
      ...(data.Video ?? []),
      ...(data.Track ?? []),
      ...(data.Photo ?? []),
    ];
    yield* items;
    offset += items.length;
    if (items.length === 0 || data.totalSize === undefined || offset >= data.totalSize) {
      return;
    }
  }
}
