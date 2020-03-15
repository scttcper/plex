import { PlexServer } from './server';
import { MediaContainer } from './util';
import { MediaItems, MediaItem } from './libraryInterfaces';

const OPERATORS = {
  exact: (v: string | number, q: string | number) => v === q,
  iexact: (v: string, q: string) => v.toLowerCase() === q.toLowerCase(),
  contains: (v: string, q: string) => q.includes(v),
  icontains: (v: string, q) => q.toLowerCase().includes(v.toLowerCase()),
  ne: (v: string, q: string) => v !== q,
  in: (v: string, q) => v in q,
  gt: (v: number, q: number) => v > q,
  gte: (v: number, q: number) => v >= q,
  lt: (v: number, q: number) => v < q,
  lte: (v: number, q: number) => v <= q,
  startswith: (v: string, q: string) => v.startsWith(q),
  istartswith: (v: string, q: string) => v.toLowerCase().startsWith(q),
  endswith: (v: string, q: string) => v.endsWith(q),
  iendswith: (v: string, q: string) => v.toLowerCase().endsWith(q),
  // 'exists': (v: string, q) => v is not None if q else v is None,
  // 'regex': (v: string, q) => re.match(q, v),
  // 'iregex': (v: string, q) => re.match(q, v, flags=re.IGNORECASE),
} as const;

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

  /**
   * Load the specified key to find and build the first item with the
   * specified tag and attrs. If no tag or attrs are specified then
   * the first item in the result set is returned.
   *
   * @param ekey Path in Plex to fetch items from. If an int is passed
   * in, the key will be translated to /library/metadata/<key>. This allows
   * fetching an item only knowing its key-id.
   */
  async fetchItem(
    ekey: string | number,
    options?: Record<string, string | number>,
    cls?: any,
  ): Promise<MediaItem> {
    const key = typeof ekey === 'number' ? `/library/metadata/${ekey.toString()}` : ekey;
    const response = await this.server.query<MediaContainer<MediaItems>>(key);
    const elems = response.MediaContainer.Metadata;
    for (const elem of elems) {
      if (this._checkAttrs(elem, options)) {
        return elem;
      }
    }

    throw new Error('Unable to find item');
  }

  /**
   * Load the specified key to find and build all items with the specified tag
   * and attrs. See :func:`~plexapi.base.PlexObject.fetchItem` for more details
   * on how this is used.
   */
  async fetchItems(
    ekey: string,
    options?: Record<string, string | number>,
    cls?: any,
  ): Promise<any> {
    const data = await this.server.query(ekey);
    const items = this.findItems(data, options, cls);
    return items;
  }

  /**
   * Load the specified data to find and build all items with the specified tag
   * and attrs. See :func:`~plexapi.base.PlexObject.fetchItem` for more details
   * on how this is used.
   */
  findItems(data: any[], options: Record<string, string | number> = {}, cls?: any): any[] {
    if (cls?.TAG && !('tag' in options)) {
      options.etag = cls.TAG;
    }

    if (cls?.TYPE && !('type' in options)) {
      options.type = cls.TYPE;
    }

    const items: any[] = [];
    for (const elem of data) {
      if (this._checkAttrs(elem, options)) {
        items.push(elem);
      }
    }

    return items;
  }

  private _getAttrOperator(attr: string): [string, keyof typeof OPERATORS, (a: any, b: any) => boolean] {
    // OPERATORS
    for (const [op, operator] of Object.entries(OPERATORS)) {
      if (attr.endsWith(`__${op}`)) {
        const key = attr.split('__', 1)[0];
        return [key, op as keyof typeof OPERATORS, operator];
      }
    }

    return [attr, 'exact', OPERATORS.exact];
  }

  private _checkAttrs(elem: MediaItem, obj: Record<string, string | number> = {}): boolean {
    const attrsFound: Record<string, boolean> = {};
    for (const [attr, query] of Object.entries(obj)) {
      const [key, op, operator] = this._getAttrOperator(attr);
      const value = elem[key] as string;
      attrsFound[key] = operator(value, query);
    }

    return Object.values(attrsFound).every(x => x);
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
    console.log({ key });
    const data = await this.server.query(key);
    const innerData = data.MediaContainer ? data.MediaContainer : data;
    this._loadFullData(innerData);
  }

  async section(): Promise<any> {

  }

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
    console.log('_details_key', this._details_key);
    console.log('initpath', this.initpath);
    return this._details_key === this.initpath || !this.key;
  }
}
