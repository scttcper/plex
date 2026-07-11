import { URLSearchParams } from 'node:url';

import { Album, Artist, Track } from './audio.ts';
import { Playable } from './base/playable.ts';
import { fetchItems } from './baseFunctionality.ts';
import { BadRequest, NotFound } from './exceptions.ts';
import type { LibrarySection, Libtype, SearchClassForLibtype } from './library.ts';
import { Photo, Photoalbum } from './photo.ts';
import type {
  PlaylistContainerResponse,
  PlaylistItemData,
  PlaylistResponse,
} from './playlist.types.ts';
import { searchType } from './search.ts';
import type { PlexServer } from './server.ts';
import { Episode, Movie, Season, Show } from './video.ts';

/**
 * Map media types to their respective class
 */
function createPlaylistContent(
  server: PlexServer,
  data: PlaylistItemData,
  key: string,
  parent: Playlist,
): PlaylistItem {
  switch (data.type) {
    case 'episode': {
      return new Episode(server, data, key, parent) as PlaylistItem;
    }
    case 'movie': {
      return new Movie(server, data, key, parent) as PlaylistItem;
    }
    case 'show': {
      return new Show(server, data, key, parent) as PlaylistItem;
    }
    case 'season': {
      return new Season(server, data, key, parent) as PlaylistItem;
    }
    case 'track': {
      return new Track(server, data, key, parent) as PlaylistItem;
    }
    case 'album': {
      return new Album(server, data, key, parent) as PlaylistItem;
    }
    case 'artist': {
      return new Artist(server, data, key, parent) as PlaylistItem;
    }
    case 'photoalbum': {
      return new Photoalbum(server, data, key, parent) as PlaylistItem;
    }
    case 'photo': {
      return new Photo(server, data, key, parent) as PlaylistItem;
    }
    default: {
      throw new Error(`Media type '${data.type}' not implemented`);
    }
  }
}

export interface CreateRegularPlaylistOptions {
  /** True to create a smart playlist */
  smart?: false;
  /** Regular playlists only */
  items: PlaylistContent[];
}

export interface CreateSmartPlaylistOptions {
  /** True to create a smart playlist */
  smart: true;
  /** Smart playlists only, the library section to create the playlist in. */
  section?: LibrarySection<unknown>;
  /** Smart playlists only, limit the number of items in the playlist. */
  limit?: number;
  /**
   * Smart playlists only, a string of comma separated sort fields
   * or a list of sort fields in the format ``column:dir``.
   * See {@link Section.search}  for more info.
   */
  sort?: string;
  /**
   * Smart playlists only, a dictionary of advanced filters.
   * See {@link Section.search}  for more info.
   */
  filters?: Record<string, boolean | number | string>;
}

export type CreatePlaylistOptions = CreateRegularPlaylistOptions | CreateSmartPlaylistOptions;
type PlaylistContent =
  | Album
  | Artist
  | Episode
  | Movie
  | Photo
  | Photoalbum
  | Season
  | Show
  | Track;
type PlaylistItem = PlaylistContent & { playlistItemID?: number };

export type PlaylistItemLibtype = Exclude<Libtype, 'clip' | 'collection'>;

export interface PlaylistItemsOptions<T extends PlaylistItemLibtype = PlaylistItemLibtype> {
  /** Return playlist contents grouped as a specific Plex library type. */
  libtype: T;
}

export interface UpdatePlaylistOptions {
  /** New title for the playlist */
  title?: string;
  /** New summary/description for the playlist */
  summary?: string;
}

export class Playlist extends Playable {
  static override TAG = 'Playlist';

  static async create(server: PlexServer, title: string, options: CreatePlaylistOptions) {
    if (!('items' in options)) {
      return this._createSmart(server, title, options);
    }

    return this._create(server, title, options.items);
  }

  /**
   * Update a playlist's metadata by ratingKey without fetching the full playlist first.
   *
   * @param server - The Plex server instance
   * @param ratingKey - The playlist's ratingKey
   * @param options - Fields to update (title and/or summary)
   *
   * @example
   * ```typescript
   * await Playlist.update(server, '12345', {
   *   title: 'My Updated Playlist',
   *   summary: 'A new description'
   * });
   * ```
   */
  static async update(
    server: PlexServer,
    ratingKey: string,
    options: UpdatePlaylistOptions,
  ): Promise<void> {
    if (!options.title && !options.summary) {
      return;
    }

    const params = new URLSearchParams();
    if (options.title) {
      params.set('title', options.title);
    }
    if (options.summary) {
      params.set('summary', options.summary);
    }

    const key = `/playlists/${ratingKey}?${params.toString()}`;
    await server.query({ path: key, method: 'put' });
  }

  /** Create a smart playlist. */
  private static async _createSmart(
    server: PlexServer,
    title: string,
    options: CreateSmartPlaylistOptions,
  ): Promise<Playlist> {
    const { section, limit, sort, filters } = options;
    if (!section) {
      throw new BadRequest('A section is required to create a smart playlist.');
    }

    // Build the content URI for the smart playlist filter
    const sectionType = searchType(section.type);
    const filterParams = new URLSearchParams();
    filterParams.set('type', sectionType.toString());

    if (sort) {
      filterParams.set('sort', sort);
    }

    if (limit !== undefined) {
      filterParams.set('limit', limit.toString());
    }

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        filterParams.set(key, String(value));
      }
    }

    const uri = `${server._uriRoot()}/library/sections/${section.key}/all?${filterParams.toString()}`;

    // Determine playlist type from section content type
    const playlistType = section.CONTENT_TYPE ?? 'video';

    const params = new URLSearchParams({
      type: playlistType,
      title,
      smart: '1',
      uri,
    });

    const key = `/playlists?${params.toString()}`;
    const data = await server.query<PlaylistContainerResponse>({ path: key, method: 'post' });
    return new Playlist(server, data.MediaContainer.Metadata[0], key);
  }

  private static async _create(
    server: PlexServer,
    title: string,
    items: PlaylistContent[],
  ): Promise<Playlist> {
    if (!items || items.length === 0) {
      throw new BadRequest('Must include items to add when creating new playlist.');
    }

    const { listType } = items[0];
    const ratingKeys = items.map(item => {
      if (!item.ratingKey) {
        throw new BadRequest(`Cannot add item without a ratingKey to playlist "${title}".`);
      }

      return item.ratingKey;
    });
    const uri = `${server._uriRoot()}/library/metadata/${ratingKeys.join(',')}`;
    const params = new URLSearchParams({
      uri,
      type: listType,
      title,
      smart: '0',
    });
    const key = `/playlists?${params.toString()}`;
    const data = await server.query<PlaylistContainerResponse>({ path: key, method: 'post' });
    return new Playlist(server, data.MediaContainer.Metadata[0], key);
  }

  TYPE = 'playlist';

  declare addedAt: Date;
  declare updatedAt: Date;
  declare composite: string;
  declare guid: string;
  declare leafCount: number;
  declare playlistType: string;
  declare smart: boolean;
  declare summary: string;
  declare allowSync?: boolean;
  declare duration?: number;
  declare durationInSeconds?: number;
  /** Artist that a personalized "Mix For You" playlist is centered on. */
  declare centroid?: Artist;
  /** Cache of playlist items */
  private _items: PlaylistItem[] | null = null;

  async _edit(args: { title?: string; summary?: string }) {
    const searchparams = new URLSearchParams(args);
    const key = `${this.key}?${searchparams.toString()}`;
    await this.server.query({ path: key, method: 'put' });
  }

  override async edit(changeObj: { title?: string; summary?: string }) {
    await this._edit(changeObj);
  }

  /**
   * @returns the item in the playlist that matches the specified title.
   */
  async item(title: string): Promise<PlaylistContent | null> {
    const items = await this.items();
    const matched = items.find(item => item.title?.toLowerCase() === title.toLowerCase());
    return matched ?? null;
  }

  async items<T extends PlaylistContent = PlaylistContent>(): Promise<T[]>;
  async items<T extends PlaylistItemLibtype>(
    options: PlaylistItemsOptions<T>,
  ): Promise<Array<SearchClassForLibtype<T>>>;
  async items<T extends PlaylistItemLibtype>(
    options?: PlaylistItemsOptions<T>,
  ): Promise<PlaylistContent[] | Array<SearchClassForLibtype<T>>> {
    const key = this._buildQueryKey(`/playlists/${this.ratingKey}/items`, {
      type: options ? searchType(options.libtype) : undefined,
    });
    if (options) {
      const items = await fetchItems<PlaylistItemData>(this.server, key);
      return items.map(data => createPlaylistContent(this.server, data, key, this)) as Array<
        SearchClassForLibtype<T>
      >;
    }

    if (this._items === null) {
      const items = await fetchItems<PlaylistItemData>(this.server, key);
      this._items = items.map(data => createPlaylistContent(this.server, data, key, this));
    }

    return this._items;
  }

  /** Add items to a playlist. */
  async addItems(items: PlaylistContent[]) {
    if (this.smart) {
      throw new BadRequest('Cannot add items to a smart playlist.');
    }

    const isInvalidType = items.some(x => x.listType !== this.playlistType);
    if (isInvalidType) {
      throw new BadRequest('Can not mix media types when building a playlist');
    }

    const ratingKeys = items.map(x => x.ratingKey);
    const params = new URLSearchParams({
      uri: `${this.server._uriRoot()}/library/metadata/${ratingKeys.join(',')}`,
    });

    const key = `${this.key}/items?${params.toString()}`;
    await this.server.query({ path: key, method: 'put' });
  }

  /** Remove an item from a playlist. */
  async removeItems(items: PlaylistContent[]) {
    if (this.smart) {
      throw new BadRequest('Cannot remove items to a smart playlist.');
    }

    for (const item of items) {
      const playlistItemId = await this._getPlaylistItemID(item);
      const key = `${this.key}/items/${playlistItemId}`;

      await this.server.query({ path: key, method: 'delete' });
    }
  }

  /** Delete the playlist. */
  override async delete() {
    await this.server.query({ path: this.key, method: 'delete' });
  }

  protected _loadData(data: PlaylistResponse) {
    this.key = data.key.replace('/items', '');
    this.ratingKey = data.ratingKey;
    this.title = data.title;
    this.type = data.type;
    this.addedAt = new Date(data.addedAt);
    this.updatedAt = new Date(data.updatedAt);
    this.composite = data.composite;
    this.guid = data.guid;
    this.playlistType = data.playlistType;
    this.summary = data.summary;
    this.smart = data.smart;
    this.leafCount = data.leafCount;

    // TODO: verify these. Possibly audio playlist related
    this.allowSync = data.allowSync;
    this.duration = data.duration;
    this.durationInSeconds = data.durationInSeconds;
    const centroid = data.Directory?.find(item => [true, 1, '1'].includes(item.centroid ?? false));
    this.centroid = centroid ? new Artist(this.server, centroid, undefined, this) : undefined;
  }

  protected _loadFullData(data: { Metadata: PlaylistResponse[] }) {
    this._loadData(data.Metadata[0]);
  }

  private async _getPlaylistItemID(item: PlaylistContent): Promise<number> {
    const items = await this.items<PlaylistItem>();
    const playlistItem = items.find(i => i.ratingKey === item.ratingKey);
    if (!playlistItem) {
      throw new NotFound(`Item with title "${item.title}" not found in the playlist`);
    }

    if (playlistItem.playlistItemID === undefined) {
      throw new NotFound(`Item with title "${item.title}" is missing a playlist item id`);
    }

    return playlistItem.playlistItemID;
  }
}
