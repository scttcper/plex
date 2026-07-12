import type { Class } from 'type-fest';

import { Album, Artist, Track } from './audio.ts';
import { Playable } from './base/playable.ts';
import type { PlexObject } from './base/plexObject.ts';
import type { PlexItemData } from './baseFunctionality.ts';
import { Unsupported } from './exceptions.ts';
import { Photo, Photoalbum } from './photo.ts';
import type { PlexServer } from './server.ts';
import { Clip, Episode, Movie, Season, Show } from './video.ts';

export type HydratedPlexItem =
  | Album
  | Artist
  | Clip
  | Episode
  | Movie
  | Photo
  | Photoalbum
  | Season
  | Show
  | Track;

const ITEM_CLASSES = {
  album: Album,
  artist: Artist,
  clip: Clip,
  episode: Episode,
  movie: Movie,
  photo: Photo,
  photoalbum: Photoalbum,
  season: Season,
  show: Show,
  track: Track,
} satisfies Record<string, Class<HydratedPlexItem>>;

export function classForPlexType(type: string): Class<HydratedPlexItem> | undefined {
  return Object.hasOwn(ITEM_CLASSES, type)
    ? ITEM_CLASSES[type as keyof typeof ITEM_CLASSES]
    : undefined;
}

export function createPlexItem(
  server: PlexServer,
  data: { type?: unknown },
  initpath?: string,
  parent?: PlexObject,
): HydratedPlexItem {
  const type = typeof data.type === 'string' ? data.type : '';
  const Cls = classForPlexType(type);
  if (!Cls) {
    throw new Unsupported(`Unsupported Plex item type: ${String(data.type)}`);
  }

  const item = new Cls(server, data as PlexItemData, initpath, parent);
  if (
    item instanceof Playable &&
    'playQueueItemID' in data &&
    typeof data.playQueueItemID === 'number'
  ) {
    item.playQueueItemID = data.playQueueItemID;
  }

  return item;
}
