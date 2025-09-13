import { PlayQueue } from '../playqueue.js';
import type { PlayQueue as PlayQueueType } from '../playqueue.js';
import type { CreatePlayQueueOptions } from '../playqueue.types.js';

import { PartialPlexObject } from './partialPlexObject.js';

/**
 * This is a general place to store functions specific to media that is Playable.
 * Things were getting mixed up a bit when dealing with Shows, Season, Artists,
 * Albums which are all not playable.
 */
export abstract class Playable extends PartialPlexObject {
  /** (int): Active session key. */
  sessionKey: any;
  /** (str): Username of the person playing this item (for active sessions). */
  usernames: any;
  /** (:class:`~plexapi.client.PlexClient`): Client objects playing this item (for active sessions). */
  players: any;
  /** (:class:`~plexapi.media.Session`): Session object, for a playing media file. */
  session: any;
  /** (:class:`~plexapi.media.TranscodeSession`): Transcode Session object if item is being transcoded (None otherwise). */
  transcodeSessions: any;
  /** (datetime): Datetime item was last viewed (history). */
  viewedAt: any;
  /** (int): Playlist item ID (only populated for :class:`~plexapi.playlist.Playlist` items). */
  playlistItemID?: number;

  /**
   * Returns a new PlayQueue from this media item.
   *
   * @param options Options for creating the PlayQueue
   * @returns New PlayQueue instance
   */
  async createPlayQueue(options: CreatePlayQueueOptions = {}): Promise<PlayQueueType> {
    return PlayQueue.create(this.server, this, options);
  }
}
