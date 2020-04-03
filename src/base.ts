import { PlexServer } from './server';

/**
 * Base class for all? Plex objects
 */
export abstract class PlexObject {
  /** xml element tag */
  static TAG: string | null = null;
  /** xml element type */
  static TYPE: string | null = null;
  /** plex relative url */
  key!: string;
  _details_key?: string;

  constructor(public readonly server: PlexServer, data: any, protected initpath?: string) {
    this._loadData(data);
  }

  /**
   * Reload the data for this object from self.key.
   */
  async reload(ekey?: string): Promise<void> {
    const key = ekey ?? this._details_key ?? this.key;
    if (!key) {
      throw new Error('Cannot reload an object not built from a URL');
    }

    const data = await this.server.query(key);
    const innerData = data.MediaContainer ? data.MediaContainer : data;
    this._loadData(innerData);
  }

  protected abstract _loadData(data: any): void;
}

export abstract class PartialPlexObject extends PlexObject {
  /**
   * load full data / reload the data for this object from self.key.
   */
  async reload(ekey?: string): Promise<void> {
    const key = ekey ?? this._details_key ?? this.key;
    if (!key) {
      throw new Error('Cannot reload an object not built from a URL');
    }

    this.initpath = key;
    const data = await this.server.query(key);
    const innerData = data.MediaContainer ? data.MediaContainer : data;
    this._loadFullData(innerData);
  }

  // async section(): Promise<any> {}

  get isFullObject(): boolean {
    return !this.key || this.key === this.initpath;
  }

  protected abstract _loadFullData(data: any): void;
}

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
  playlistItemID: any;

  get isFullObject(): boolean {
    return this._details_key === this.initpath || !this.key;
  }
}
