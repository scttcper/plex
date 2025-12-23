import type { Playable } from './base/playable.js';
import { PlexObject } from './base/plexObject.js';

import { findItems } from './baseFunctionality.js';
import { BadRequest } from './exceptions.js';
import type { Playlist } from './playlist.js';
import type {
  AddPlayQueueItemOptions,
  CreatePlayQueueOptions,
  GetPlayQueueOptions,
  MovePlayQueueItemOptions,
  PlayQueueResponse,
} from './playqueue.types.js';
import type { PlexServer } from './server.js';

/**
 * Control a PlayQueue.
 *
 * A PlayQueue is a linear list of media items that can be played in sequence.
 * It represents the current playback queue and supports operations like adding,
 * removing, and reordering items.
 */
export class PlayQueue extends PlexObject {
  static override TAG = 'PlayQueue';
  static override TYPE = 'playqueue';

  /** PlayQueue identifier */
  declare identifier: string;
  /** Media tag prefix path */
  declare mediaTagPrefix: string;
  /** Media tag version number */
  declare mediaTagVersion: number;
  /** Unique ID of the PlayQueue */
  declare playQueueID: number;
  /** ID of the last added item, defines where "Up Next" region starts */
  declare playQueueLastAddedItemID?: number;
  /** The queue item ID of the currently selected item */
  declare playQueueSelectedItemID: number;
  /** The offset of the selected item in the PlayQueue */
  declare playQueueSelectedItemOffset: number;
  /** ID of the currently selected item, matches ratingKey */
  declare playQueueSelectedMetadataItemID: number;
  /** True if the PlayQueue is shuffled */
  declare playQueueShuffled: boolean;
  /** Original URI used to create the PlayQueue */
  declare playQueueSourceURI: string;
  /** Total number of items in the PlayQueue */
  declare playQueueTotalCount: number;
  /** Version of the PlayQueue, increments on changes */
  declare playQueueVersion: number;
  /** Total size of the PlayQueue (alias for playQueueTotalCount) */
  declare size: number;
  /** Media object for the currently selected item */
  declare selectedItem?: Playable;

  /** Cache of PlayQueue items */
  private _items: Playable[] | null = null;
  /** Raw data from server */
  declare private _data: any;

  /**
   * Retrieve an existing PlayQueue by identifier.
   */
  static async get(
    server: PlexServer,
    playQueueID: number,
    options: GetPlayQueueOptions = {},
  ): Promise<PlayQueue> {
    const { own = false, center, window = 50, includeBefore = true, includeAfter = true } = options;

    const args: Record<string, string | number> = {
      own: own ? 1 : 0,
      window,
      includeBefore: includeBefore ? 1 : 0,
      includeAfter: includeAfter ? 1 : 0,
    };

    if (center !== undefined) {
      args.center = center;
    }

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(args)) {
      params.set(key, value.toString());
    }
    const path = `/playQueues/${playQueueID}?${params.toString()}`;
    const data = await server.query(path, 'get');
    const playQueue = new PlayQueue(server, data.MediaContainer, path);
    return playQueue;
  }

  /**
   * Create and return a new PlayQueue.
   */
  static async create(
    server: PlexServer,
    items: Playable | Playable[] | Playlist,
    options: CreatePlayQueueOptions = {},
  ): Promise<PlayQueue> {
    const {
      startItem,
      shuffle = false,
      repeat = false,
      includeChapters = true,
      includeRelated = true,
      continuous = false,
    } = options;

    const args: Record<string, string | number> = {
      includeChapters: includeChapters ? 1 : 0,
      includeRelated: includeRelated ? 1 : 0,
      repeat: repeat ? 1 : 0,
      shuffle: shuffle ? 1 : 0,
      continuous: continuous ? 1 : 0,
    };

    if (Array.isArray(items)) {
      const itemKeys = items.map(x => x.ratingKey).join(',');
      const uriArgs = encodeURIComponent(`/library/metadata/${itemKeys}`);
      args.uri = `library:///directory/${uriArgs}`;
      args.type = (items[0] as any).listType;
    } else if ((items as any).type === 'playlist') {
      const playlist = items as any;
      args.type = playlist.playlistType;
      args.playlistID = playlist.ratingKey;
    } else {
      const item = items as Playable;
      args.type = (item as any).listType;
      const library = await server.library();
      args.uri = `server://${server.machineIdentifier}/${library.identifier}${item.key}`;
    }

    if (startItem) {
      args.key = startItem.key;
    }

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(args)) {
      params.set(key, value.toString());
    }
    const path = `/playQueues?${params.toString()}`;
    const data = await server.query(path, 'post');
    const playQueue = new PlayQueue(server, data.MediaContainer, path);
    return playQueue;
  }

  /**
   * Create and return a new PlayQueue from a station key.
   * This is a convenience method for radio stations.
   */
  static async fromStationKey(server: PlexServer, key: string): Promise<PlayQueue> {
    const library = await server.library();
    const args = {
      type: 'audio',
      uri: `server://${server.machineIdentifier}/${library.identifier}${key}`,
    };

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(args)) {
      params.set(key, value.toString());
    }
    const path = `/playQueues?${params.toString()}`;
    const data = await server.query(path, 'post');
    const playQueue = new PlayQueue(server, data.MediaContainer, path);
    return playQueue;
  }

  /**
   * Get items in the PlayQueue.
   */
  get items(): Playable[] {
    if (this._items === null) {
      this._items = findItems(
        this._data?.Metadata ?? [],
        {},
        undefined,
        this.server,
        this,
      ) as Playable[];

      // Set selectedItem based on the offset now that items are loaded
      if (
        this.playQueueSelectedItemOffset >= 0 &&
        this._items.length > this.playQueueSelectedItemOffset &&
        !this.selectedItem
      ) {
        this.selectedItem = this._items[this.playQueueSelectedItemOffset];
      }
    }
    return this._items;
  }

  /**
   * Get item at specific index.
   */
  getItem(index: number): Playable | null {
    return this.items[index] || null;
  }

  /**
   * Get the length of the PlayQueue.
   */
  get length(): number {
    return this.playQueueTotalCount;
  }

  /**
   * Check if the PlayQueue contains the provided media item.
   */
  contains(media: Playable): boolean {
    return this.items.some(x => (x as any).playQueueItemID === (media as any).playQueueItemID);
  }

  /**
   * Get a similar object from this PlayQueue.
   * Useful for looking up playQueueItemIDs using items from the Library.
   */
  getQueueItem(item: Playable): Playable {
    const matches = this.items.filter(x => x.ratingKey === item.ratingKey);

    if (matches.length === 1) {
      return matches[0];
    } else if (matches.length > 1) {
      throw new BadRequest(
        `${item.title} occurs multiple times in this PlayQueue, provide exact item`,
      );
    } else {
      throw new BadRequest(`${item.title} not valid for this PlayQueue`);
    }
  }

  /**
   * Append an item to the "Up Next" section of the PlayQueue.
   */
  async addItem(
    item: Playable | Playlist,
    options: AddPlayQueueItemOptions = {},
  ): Promise<PlayQueue> {
    const { playNext = false, refresh = true } = options;

    if (refresh) {
      await this.refresh();
    }

    const args: Record<string, string | number> = {};

    if ((item as any).type === 'playlist') {
      const playlist = item as any;
      args.playlistID = playlist.ratingKey;
    } else {
      const playableItem = item as Playable;
      const section = await (playableItem as any).section();
      args.uri = `library://${section.uuid}/item${playableItem.key}`;
    }

    if (playNext) {
      args.next = 1;
    }

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(args)) {
      params.set(key, value.toString());
    }
    const path = `/playQueues/${this.playQueueID}?${params.toString()}`;
    const data = await this.server.query(path, 'put');
    this._invalidateCacheAndLoadData(data.MediaContainer);
    return this;
  }

  /**
   * Move an item to the beginning of the PlayQueue.
   * If 'after' is provided, the item will be placed immediately after the specified item.
   */
  async moveItem(item: Playable, options: MovePlayQueueItemOptions = {}): Promise<PlayQueue> {
    const { after, refresh = true } = options;

    if (refresh) {
      await this.refresh();
    }

    const args: Record<string, string | number> = {};

    let queueItem = item;
    if (!this.contains(item)) {
      queueItem = this.getQueueItem(item);
    }

    if (after) {
      let afterItem = after;
      if (!this.contains(after)) {
        afterItem = this.getQueueItem(after);
      }
      args.after = (afterItem as any).playQueueItemID;
    }

    let path = `/playQueues/${this.playQueueID}/items/${(queueItem as any).playQueueItemID}/move`;
    if (Object.keys(args).length > 0) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(args)) {
        params.set(key, value.toString());
      }
      path += `?${params.toString()}`;
    }
    const data = await this.server.query(path, 'put');
    this._invalidateCacheAndLoadData(data.MediaContainer);
    return this;
  }

  /**
   * Remove an item from the PlayQueue.
   */
  async removeItem(item: Playable, refresh = true): Promise<PlayQueue> {
    if (refresh) {
      await this.refresh();
    }

    let queueItem = item;
    if (!this.contains(item)) {
      queueItem = this.getQueueItem(item);
    }

    const path = `/playQueues/${this.playQueueID}/items/${(queueItem as any).playQueueItemID}`;
    const data = await this.server.query(path, 'delete');
    this._invalidateCacheAndLoadData(data.MediaContainer);
    return this;
  }

  /**
   * Remove all items from the PlayQueue.
   */
  async clear(): Promise<PlayQueue> {
    const path = `/playQueues/${this.playQueueID}/items`;
    const data = await this.server.query(path, 'delete');
    this._invalidateCacheAndLoadData(data.MediaContainer);
    return this;
  }

  /**
   * Refresh the PlayQueue from the Plex server.
   */
  override async refresh(): Promise<void> {
    const path = `/playQueues/${this.playQueueID}`;
    const data = await this.server.query(path, 'get');
    this._invalidateCacheAndLoadData(data.MediaContainer);
  }

  protected _loadData(data: PlayQueueResponse): void {
    this._data = data; // Store raw data for items access
    this.identifier = data.identifier;
    this.mediaTagPrefix = data.mediaTagPrefix;
    this.mediaTagVersion = data.mediaTagVersion;
    this.playQueueID = data.playQueueID;
    this.playQueueLastAddedItemID = data.playQueueLastAddedItemID;
    this.playQueueSelectedItemID = data.playQueueSelectedItemID;
    this.playQueueSelectedItemOffset = data.playQueueSelectedItemOffset;
    this.playQueueSelectedMetadataItemID = data.playQueueSelectedMetadataItemID;
    this.playQueueShuffled = data.playQueueShuffled;
    this.playQueueSourceURI = data.playQueueSourceURI;
    this.playQueueTotalCount = data.playQueueTotalCount;
    this.playQueueVersion = data.playQueueVersion;
    this.size = data.size > 0 ? data.size : this.playQueueTotalCount;

    // selectedItem will be set lazily when accessing items
  }

  private _invalidateCacheAndLoadData(data: any): void {
    this._items = null; // Clear cached items
    this._loadData(data);
  }
}
