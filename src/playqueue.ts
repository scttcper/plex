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
  PlayQueueContainerResponse,
  PlayQueueResponse,
} from './playqueue.types.js';
import type { PlexServer } from './server.js';

type QueueItem = Playable & { playQueueItemID?: number };
type PlaylistLike = Playlist & { playlistType: string; ratingKey: string; type?: string };
type PlayQueuePlayable = Playable & {
  key: string;
  listType: string;
  ratingKey: string;
  section: () => Promise<{ uuid: string }>;
};

function hasPlaylistShape(item: Playable | Playlist): item is PlaylistLike {
  return (item as { type?: unknown }).type === 'playlist';
}

function asPlayQueuePlayable(item: Playable): PlayQueuePlayable {
  const playable = item as Playable & {
    key?: unknown;
    listType?: unknown;
    ratingKey?: unknown;
    section?: unknown;
  };
  if (
    typeof playable.key !== 'string' ||
    typeof playable.listType !== 'string' ||
    typeof playable.ratingKey !== 'string' ||
    typeof playable.section !== 'function'
  ) {
    throw new BadRequest('Item is missing required playback metadata');
  }

  return playable as PlayQueuePlayable;
}

function playQueueItemID(item: Playable): number | undefined {
  const id = (item as { playQueueItemID?: unknown }).playQueueItemID;
  return typeof id === 'number' ? id : undefined;
}

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
  private _items: QueueItem[] | null = null;
  /** Raw data from server */
  declare private _data: PlayQueueResponse;

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
    for (const [paramKey, value] of Object.entries(args)) {
      params.set(paramKey, value.toString());
    }
    const path = `/playQueues/${playQueueID}?${params.toString()}`;
    const data = await server.query<PlayQueueContainerResponse>({ path });
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
      const playableItems = items.map(asPlayQueuePlayable);
      const itemKeys = playableItems.map(x => x.ratingKey).join(',');
      const uriArgs = encodeURIComponent(`/library/metadata/${itemKeys}`);
      args.uri = `library:///directory/${uriArgs}`;
      args.type = playableItems[0].listType;
    } else if (hasPlaylistShape(items)) {
      args.type = items.playlistType;
      args.playlistID = items.ratingKey;
    } else {
      const item = asPlayQueuePlayable(items);
      args.type = item.listType;
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
    const data = await server.query<PlayQueueContainerResponse>({ path, method: 'post' });
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
    for (const [paramKey, value] of Object.entries(args)) {
      params.set(paramKey, value.toString());
    }
    const path = `/playQueues?${params.toString()}`;
    const data = await server.query<PlayQueueContainerResponse>({ path, method: 'post' });
    const playQueue = new PlayQueue(server, data.MediaContainer, path);
    return playQueue;
  }

  /**
   * Get items in the PlayQueue.
   */
  get items(): QueueItem[] {
    if (this._items === null) {
      this._items = findItems(
        this._data?.Metadata ?? [],
        {},
        undefined,
        this.server,
        this,
      ) as QueueItem[];

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
    return this.items.some(x => playQueueItemID(x) === playQueueItemID(media));
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

    if (hasPlaylistShape(item)) {
      args.playlistID = item.ratingKey;
    } else {
      const playableItem = asPlayQueuePlayable(item);
      const section = await playableItem.section();
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
    const data = await this.server.query<PlayQueueContainerResponse>({ path, method: 'put' });
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
      const afterItemID = playQueueItemID(afterItem);
      if (afterItemID === undefined) {
        throw new BadRequest(`${after.title} is missing a PlayQueue item id`);
      }

      args.after = afterItemID;
    }

    const queueItemID = playQueueItemID(queueItem);
    if (queueItemID === undefined) {
      throw new BadRequest(`${item.title} is missing a PlayQueue item id`);
    }

    let path = `/playQueues/${this.playQueueID}/items/${queueItemID}/move`;
    if (Object.keys(args).length > 0) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(args)) {
        params.set(key, value.toString());
      }
      path += `?${params.toString()}`;
    }
    const data = await this.server.query<PlayQueueContainerResponse>({ path, method: 'put' });
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

    const queueItemID = playQueueItemID(queueItem);
    if (queueItemID === undefined) {
      throw new BadRequest(`${item.title} is missing a PlayQueue item id`);
    }

    const path = `/playQueues/${this.playQueueID}/items/${queueItemID}`;
    const data = await this.server.query<PlayQueueContainerResponse>({ path, method: 'delete' });
    this._invalidateCacheAndLoadData(data.MediaContainer);
    return this;
  }

  /**
   * Remove all items from the PlayQueue.
   */
  async clear(): Promise<PlayQueue> {
    const path = `/playQueues/${this.playQueueID}/items`;
    const data = await this.server.query<PlayQueueContainerResponse>({ path, method: 'delete' });
    this._invalidateCacheAndLoadData(data.MediaContainer);
    return this;
  }

  /**
   * Refresh the PlayQueue from the Plex server.
   */
  override async refresh(): Promise<void> {
    const path = `/playQueues/${this.playQueueID}`;
    const data = await this.server.query<PlayQueueContainerResponse>({ path });
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

  private _invalidateCacheAndLoadData(data: PlayQueueResponse): void {
    this._items = null; // Clear cached items
    this._loadData(data);
  }
}
