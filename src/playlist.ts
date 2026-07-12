import { URLSearchParams } from 'node:url';

import { Album, Artist, Track } from './audio.ts';
import { Playable } from './base/playable.ts';
import { fetchItems } from './baseFunctionality.ts';
import { BadRequest, NotFound, Unsupported } from './exceptions.ts';
import { createPlexItem } from './itemFactory.ts';
import type {
  AdvancedSearchFilters,
  LibrarySection,
  Libtype,
  SearchArgs,
  SearchClassForLibtype,
  SearchFilterValue,
  Section,
} from './library.ts';
import { Photo, Photoalbum } from './photo.ts';
import type {
  PlaylistContainerResponse,
  PlaylistItemData,
  PlaylistResponse,
} from './playlist.types.ts';
import { searchType } from './search.ts';
import type { PlexServer } from './server.ts';
import { parsePlexBoolean } from './util.ts';
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
  if (data.type === 'clip') {
    throw new Unsupported('Clips are not supported as playlist content.');
  }

  return createPlexItem(server, data, key, parent) as PlaylistItem;
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
  /** Smart playlists only, override the section's default media type. */
  libtype?: PlaylistItemLibtype;
  /**
   * Smart playlists only, a dictionary of advanced filters.
   * See {@link Section.search}  for more info.
   */
  filters?: AdvancedSearchFilters;
  /** Additional validated library search options. */
  search?: SmartPlaylistSearchOptions;
}

export type CreatePlaylistOptions = CreateRegularPlaylistOptions | CreateSmartPlaylistOptions;
export type PlaylistContent =
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
export type PlaylistContentType = 'audio' | 'photo' | 'video';
export type PlaylistMetadataType = 'movie' | 'photo' | 'track';
export interface SmartPlaylistSearchOptions {
  /** Advanced nested `and`/`or` filters. */
  filters?: AdvancedSearchFilters;
  /** Include Plex GUID metadata in the persisted search. */
  includeGuids?: boolean;
  /** Media type searched by the smart playlist. */
  libtype?: PlaylistItemLibtype;
  /** Maximum number of matching items. */
  limit?: number;
  /** One or more validated Plex sort fields. */
  sort?: SearchArgs['sort'];
  /** Simple field filters such as `{ year: 2026, genre: 'Comedy' }`. */
  where?: Record<string, SearchFilterValue>;
}

function smartPlaylistSearchArgs(options: SmartPlaylistSearchOptions): Partial<SearchArgs> {
  const { where = {}, ...search } = options;
  return { ...where, ...search };
}

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

export interface MovePlaylistItemOptions {
  /** Place the item after this playlist item. Omit to move it to the beginning. */
  after?: PlaylistContent;
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
    const { section, limit, sort, filters, libtype, search = {} } = options;
    if (!section) {
      throw new BadRequest('A section is required to create a smart playlist.');
    }

    const searchKey = await section.buildSearchKey({
      ...smartPlaylistSearchArgs(search),
      filters: search.filters ?? filters,
      libtype: search.libtype ?? libtype ?? section.METADATA_TYPE,
      limit: search.limit ?? limit,
      sort: search.sort ?? sort,
    });
    const uri = `${server._uriRoot()}${searchKey}`;

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
    const playlist = new Playlist(server, data.MediaContainer.Metadata[0], key);
    // Plex's create response omits the persisted content URI needed by smart helpers.
    await playlist.reload();
    return playlist;
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
  declare content?: string;
  declare icon?: string;
  declare librarySectionKey?: string;
  declare librarySectionTitle?: string;
  declare radio: boolean;
  declare allowSync?: boolean;
  declare duration?: number;
  declare durationInSeconds?: number;
  /** Artist that a personalized "Mix For You" playlist is centered on. */
  declare centroid?: Artist;
  /** Cache of playlist items */
  private _items: PlaylistItem[] | null = null;

  get isVideo(): boolean {
    return this.playlistType === 'video';
  }

  get isAudio(): boolean {
    return this.playlistType === 'audio';
  }

  get isPhoto(): boolean {
    return this.playlistType === 'photo';
  }

  get metadataType(): PlaylistMetadataType {
    if (this.isVideo) {
      return 'movie';
    }
    if (this.isAudio) {
      return 'track';
    }
    if (this.isPhoto) {
      return 'photo';
    }

    throw new Unsupported(`Unexpected playlist type: ${this.playlistType}`);
  }

  /** Return the library section associated with a smart playlist. */
  override async section(): Promise<Section> {
    if (!this.smart) {
      throw new BadRequest('Regular playlists are not associated with a library.');
    }

    const content = decodeURIComponent(this.content ?? '');
    const sectionMatch = /\/library\/sections\/(\d+)\/all/.exec(content);
    if (sectionMatch) {
      return (await this.server.library()).sectionByID(sectionMatch[1]);
    }

    const [item] = await this.items();
    if (item) {
      return item.section();
    }

    throw new Unsupported('Unable to determine the smart playlist library section.');
  }

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
  async addItems(items: PlaylistContent[]): Promise<this> {
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
    this._items = null;
    return this;
  }

  /** Remove an item from a playlist. */
  async removeItems(items: PlaylistContent[]): Promise<this> {
    if (this.smart) {
      throw new BadRequest('Cannot remove items to a smart playlist.');
    }

    for (const item of items) {
      const playlistItemId = await this._getPlaylistItemID(item);
      const key = `${this.key}/items/${playlistItemId}`;

      await this.server.query({ path: key, method: 'delete' });
    }

    this._items = null;
    return this;
  }

  /** Move an item within a regular playlist. */
  async moveItem(item: PlaylistContent, { after }: MovePlaylistItemOptions = {}): Promise<this> {
    if (this.smart) {
      throw new BadRequest('Cannot move items in a smart playlist.');
    }

    const playlistItemID = await this._getPlaylistItemID(item);
    const params = new URLSearchParams();
    if (after) {
      params.set('after', (await this._getPlaylistItemID(after)).toString());
    }

    const search = params.toString();
    const key = `${this.key}/items/${playlistItemID}/move${search ? `?${search}` : ''}`;
    await this.server.query({ path: key, method: 'put' });
    this._items = null;
    return this;
  }

  /** Replace the validated search behind a smart playlist. */
  async updateFilters(options: SmartPlaylistSearchOptions = {}): Promise<this> {
    if (!this.smart) {
      throw new BadRequest('Cannot update filters for a regular playlist.');
    }

    const section = await this.section();
    const searchKey = await section.buildSearchKey({
      ...smartPlaylistSearchArgs(options),
      libtype: options.libtype ?? section.METADATA_TYPE,
    });
    const uri = `${this.server._uriRoot()}${searchKey}`;
    const key = `${this.key}/items?${new URLSearchParams({ uri }).toString()}`;
    await this.server.query({ path: key, method: 'put' });
    this._items = null;
    await this.reload();
    return this;
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
    this.smart = parsePlexBoolean(data.smart);
    this.leafCount = data.leafCount;
    this.content = data.content;
    this.icon = data.icon;
    this.librarySectionID = data.librarySectionID;
    this.librarySectionKey = data.librarySectionKey;
    this.librarySectionTitle = data.librarySectionTitle;
    this.radio = parsePlexBoolean(data.radio);

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
