import { PlexServer } from './server';
import { URLSearchParams } from 'url';

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
  _details_key: string;
  _INCLUDES?: Record<string, string | number>;
  /**
   * WeakRef to the parent object that this object is built from.
   */
  public readonly parent?: WeakRef<any>;
  protected initpath: string;

  constructor(
    public readonly server: PlexServer,
    data: any,
    initpath?: string,
    parent?: PlexObject,
  ) {
    this.initpath = initpath ?? this.key;
    this.parent = parent ? new WeakRef(parent) : undefined;
    this._loadData(data);
    this._details_key = this._buildDetailsKey();
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

  isChildOf(cls: any): boolean {
    const parent = this.parent?.deref();
    return (parent && parent.constructor === cls.constructor) || false;
  }

  protected _buildDetailsKey(args: Record<string, boolean | number> = {}) {
    let details_key = this.key;
    if (details_key && this._INCLUDES !== undefined) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(this._INCLUDES)) {
        let value = args[k] ?? v;
        if (![false, 0, '0'].includes(value)) {
          params.set(k, (value === true ? 1 : value).toString());
        }
      }

      if ([...params.keys()].length) {
        details_key += '?' + params.toString();
      }
    }

    return details_key;
  }

  protected abstract _loadData(data: any): void;
}

export abstract class PartialPlexObject extends PlexObject {
  _INCLUDES = {
    checkFiles: 1,
    includeAllConcerts: 1,
    includeBandwidths: 1,
    includeChapters: 1,
    includeChildren: 1,
    includeConcerts: 1,
    includeExternalMedia: 1,
    includeExtras: 1,
    includeFields: 'thumbBlurHash,artBlurHash',
    includeGeolocation: 1,
    includeLoudnessRamps: 1,
    includeMarkers: 1,
    includeOnDeck: 1,
    includePopularLeaves: 1,
    includePreferences: 1,
    includeRelated: 1,
    includeRelatedCount: 1,
    includeReviews: 1,
    includeStations: 1,
  };

  _details_key = this._buildDetailsKey();

  /**
   * load full data / reload the data for this object from self.key.
   */
  async reload(ekey?: string, args?: any): Promise<void> {
    const detailsKey = this._buildDetailsKey(args);
    const key = ekey ?? detailsKey ?? this.key;
    if (!key) {
      throw new Error('Cannot reload an object not built from a URL');
    }

    this.initpath = key;
    const data = await this.server.query(key);
    const innerData = data.MediaContainer ? data.MediaContainer : data;
    this._loadFullData(innerData);
  }

  /**
   * Retruns True if this is already a full object. A full object means all attributes
   * were populated from the api path representing only this item. For example, the
   * search result for a movie often only contain a portion of the attributes a full
   * object (main url) for that movie would contain.
   */
  get isFullObject(): boolean {
    return !this.key || (this._details_key || this.key) === this.initpath;
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
}
