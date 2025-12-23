import { URLSearchParams } from 'url';

import { Playable } from './base/playable.js';
import { PlexObject } from './base/plexObject.js';

import type { AlbumData, ArtistData, TrackData } from './audio.types.js';
import { fetchItem, fetchItems } from './baseFunctionality.js';
import {
  Chapter,
  Collection,
  Country,
  Field,
  Format,
  Genre,
  Guid,
  Image,
  Label,
  Media,
  Mood,
  Similar,
  Style,
  Subformat,
} from './media.js';
import type { PlexServer } from './server.js';

/**
 * Base class for all audio objects including Artist, Album, and Track.
 */
export class Audio extends Playable {
  /** Default metadata type for audio sync items. */
  static METADATA_TYPE = 'track';

  /** Hardcoded list type for filtering. */
  get listType(): 'audio' {
    return 'audio';
  }

  declare addedAt?: Date;
  declare art?: string;
  declare artBlurHash?: string;
  /** Sonic distance from a seed item, used in sonically similar results. */
  declare distance?: number;
  declare guid?: string;
  /** Plex index number (often the track number for tracks). */
  declare index?: number;
  declare lastRatedAt?: Date;
  declare lastViewedAt?: Date;
  /** Key of the library section this item belongs to. */
  declare librarySectionKey?: string;
  /** Title of the library section this item belongs to. */
  declare librarySectionTitle?: string;
  /** Plex music analysis version (1 indicates sonic analysis complete). */
  declare musicAnalysisVersion?: number;
  declare summary?: string;
  declare thumb?: string;
  declare thumbBlurHash?: string;
  /** Title used for sorting (defaults to title). */
  declare titleSort?: string;
  declare updatedAt?: Date;
  /** User rating (0.0-10.0). */
  declare userRating?: number;
  /** Count of times the item was played. */
  declare viewCount?: number;

  /** Store the raw data from the Plex API for lazy loading related items. */
  declare protected _data?: any;

  /** List of field objects. */
  declare fields?: Field[];
  /** List of image objects. */
  declare images?: Image[];
  /** List of mood objects. */
  declare moods?: Mood[];

  /**
   * @protected Should not be called directly. Use `server.fetchItem()`.
   * Initializes a new instance of the Audio class.
   * @param server The PlexServer instance used for communication.
   * @param data The raw data object received from the Plex API.
   * @param initpath The path used to fetch this item initially.
   */
  constructor(
    server: PlexServer,
    data: any,
    initpath: string | undefined,
    parent: PlexObject | undefined,
  ) {
    super(server, data, initpath, parent);
    this._loadData(data);
  }

  /**
   * Returns the full URL for a given part (like a media stream) relative to the item's key.
   * Includes the authentication token.
   * @param part The relative path or resource identifier.
   * @returns The full URL string including the server address and token, or undefined if part is empty.
   */
  url(part: string): string | undefined {
    // This typically refers to sub-resources like media parts, not the main item URL (which is `key`)
    // The python version returns server.url(part), let's keep it consistent,
    // assuming `part` is something like `/transcode/universal/start?protocol=...` relative to server root,
    // or it might be used for things like `/tree`? The python `url` method seems rarely used directly.
    // For now, mirroring the python seems safest. If `part` is meant to be appended to `this.key`,
    // the logic would need changing.
    return part ? this.server.url(part, { includeToken: true })?.toString() : undefined;
  }

  /** Indicates if the audio item has undergone sonic analysis. */
  get hasSonicAnalysis(): boolean {
    // Version 1 indicates sonic analysis is complete
    return this.musicAnalysisVersion === 1;
  }

  /**
   * Fetches a list of sonically similar audio items from the Plex server.
   * The returned items will be instances of the same class as the current item
   * (e.g., calling `sonicallySimilar` on a `Track` instance returns `Track[]`).
   * @param limit Maximum number of similar items to return. Server default is 50.
   * @param maxDistance Maximum sonic distance (0.0 - 1.0) between items. Server default is 0.25.
   * @param options Optional additional filters to apply to the results.
   * @returns A promise resolving to an array of sonically similar Audio items.
   */
  async sonicallySimilar(
    limit?: number,
    maxDistance?: number,
    options?: Record<string, string | number>,
  ): Promise<Audio[]> {
    if (!this.key) {
      throw new Error('Cannot fetch similar items for an object without a key.');
    }
    const baseKey = `${this.key}/nearest`;
    const params = new URLSearchParams();
    if (limit !== undefined) {
      params.append('limit', limit.toString());
    }
    if (maxDistance !== undefined) {
      params.append('maxDistance', maxDistance.toString());
    }

    const finalKey = params.toString() ? `${baseKey}?${params.toString()}` : baseKey;

    return fetchItems<Audio>(
      this.server,
      finalKey,
      options,
      this.constructor as typeof Audio,
      this,
    );
  }

  /**
   * Provides a default title for Sync operations based on the item's title.
   * @returns The item's title, or undefined if the title is not set.
   * @protected
   */
  protected _defaultSyncTitle(): string | undefined {
    return this.title;
  }

  /**
   * Populates the object's properties from the provided Plex API data.
   * This method is called by the constructor and _loadFullData.
   * @param data The raw data object from the Plex API.
   * @protected
   */
  protected _loadData(data: Record<string, any>): void {
    this._data = data;

    const addedAtTimestamp = data.addedAt ? parseInt(data.addedAt, 10) : NaN;
    this.addedAt = isNaN(addedAtTimestamp) ? undefined : new Date(addedAtTimestamp * 1000);
    this.art = data.art ? this.server.url(data.art, { includeToken: true })?.toString() : undefined;
    this.artBlurHash = data.artBlurHash;
    const distanceFloat = data.distance ? parseFloat(data.distance) : NaN;
    this.distance = isNaN(distanceFloat) ? undefined : distanceFloat;
    this.guid = data.guid;
    const indexInt = data.index ? parseInt(data.index, 10) : NaN;
    this.index = isNaN(indexInt) ? undefined : indexInt;
    this.key = data.key ?? this.key ?? '';
    const lastRatedAtTimestamp = data.lastRatedAt ? parseInt(data.lastRatedAt, 10) : NaN;
    this.lastRatedAt = isNaN(lastRatedAtTimestamp)
      ? undefined
      : new Date(lastRatedAtTimestamp * 1000);
    const lastViewedAtTimestamp = data.lastViewedAt ? parseInt(data.lastViewedAt, 10) : NaN;
    this.lastViewedAt = isNaN(lastViewedAtTimestamp)
      ? undefined
      : new Date(lastViewedAtTimestamp * 1000);
    const librarySectionIDInt = data.librarySectionID ? parseInt(data.librarySectionID, 10) : NaN;
    this.librarySectionID = isNaN(librarySectionIDInt)
      ? this.librarySectionID
      : librarySectionIDInt;
    this.librarySectionKey = data.librarySectionKey;
    this.librarySectionTitle = data.librarySectionTitle;
    // listType is handled by the getter
    const musicAnalysisVersionInt = data.musicAnalysisVersion
      ? parseInt(data.musicAnalysisVersion, 10)
      : NaN;
    this.musicAnalysisVersion = isNaN(musicAnalysisVersionInt)
      ? undefined
      : musicAnalysisVersionInt;
    this.playlistItemID = data.playlistItemID;
    this.ratingKey = data.ratingKey;
    const ratingKeyInt = data.ratingKey ? parseInt(data.ratingKey, 10) : NaN;
    this.ratingKey = isNaN(ratingKeyInt) ? this.ratingKey : ratingKeyInt.toString();
    this.summary = data.summary;
    this.thumb = data.thumb
      ? this.server.url(data.thumb, { includeToken: true })?.toString()
      : undefined;
    this.thumbBlurHash = data.thumbBlurHash;
    this.title = data.title ?? this.title;
    this.titleSort = data.titleSort ?? this.title;
    this.type = data.type ?? this.type;
    const updatedAtTimestamp = data.updatedAt ? parseInt(data.updatedAt, 10) : NaN;
    this.updatedAt = isNaN(updatedAtTimestamp) ? undefined : new Date(updatedAtTimestamp * 1000);
    const userRatingFloat = data.userRating ? parseFloat(data.userRating) : NaN;
    this.userRating = isNaN(userRatingFloat) ? undefined : userRatingFloat;
    const viewCountInt = data.viewCount !== undefined ? parseInt(data.viewCount, 10) : NaN;
    this.viewCount = isNaN(viewCountInt) ? 0 : viewCountInt;

    // Map tag arrays like video.ts does
    this.fields = data.Field?.map((d: unknown) => new Field(this.server, d, undefined, this)) ?? [];
    this.images = data.Image?.map((d: unknown) => new Image(this.server, d, undefined, this)) ?? [];
    this.moods = data.Mood?.map((d: unknown) => new Mood(this.server, d, undefined, this)) ?? [];
  }

  /**
   * Overrides `PartialPlexObject._loadFullData` to apply Audio-specific attributes
   * after fetching the full item data.
   * @param data The raw data object representing the full item from the Plex API.
   * @protected
   */
  protected override _loadFullData(data: any): void {
    // Data is typically nested under 'Metadata' for single item fetches
    const metadataItem = Array.isArray(data.Metadata) ? data.Metadata[0] : data;
    if (metadataItem) {
      this._loadData(metadataItem);
    }
  }
}

/**
 * Represents a single Track.
 */
export class Track extends Audio {
  static override TAG = 'Track';
  static override TYPE = 'track';

  // Track specific properties
  declare audienceRating?: number;
  declare chapterSource?: string;
  // chapters defined via getter
  // collections defined via getter
  declare duration?: number;
  // genres defined via getter
  declare grandparentArt?: string;
  declare grandparentGuid?: string;
  declare grandparentKey?: string;
  declare grandparentRatingKey?: number;
  declare grandparentTheme?: string;
  declare grandparentThumb?: string;
  declare grandparentTitle?: string; // Artist Name
  // guids defined via getter
  // index inherited from Audio
  // labels defined via getter
  // media defined via getter
  declare originalTitle?: string; // Often the Artist Name again or original track title?
  declare parentGuid?: string;
  declare parentIndex?: number; // Disc Number
  declare parentKey?: string;
  declare parentRatingKey?: number;
  declare parentThumb?: string;
  declare parentTitle?: string; // Album Title
  declare primaryExtraKey?: string;
  declare rating?: number; // Inherited ratingKey exists from PlexObject base
  declare skipCount?: number;
  declare sourceURI?: string; // Remote playlist item
  // viewCount inherited from Audio
  // lastViewedAt inherited from Audio
  declare viewOffset?: number;
  declare chapters?: Chapter[];
  declare collections?: Collection[];
  declare genres?: Genre[];
  declare guids?: Guid[];
  declare labels?: Label[];
  declare media?: Media[];

  // Properties from Mixins (assuming, some might overlap with Audio)
  // userRating inherited from Audio
  // art inherited from Audio
  // thumb inherited from Audio (used as poster?)
  // theme inherited from Audio

  constructor(
    server: PlexServer,
    data: any,
    initpath: string | undefined,
    parent: PlexObject | undefined,
  ) {
    super(server, data, initpath, parent);
    this._loadData(data);
  }

  /**
   * @returns List of file paths where the track is found on disk.
   */
  get locations(): string[] {
    const parts = this.media?.flatMap(m => m.parts ?? []) ?? [];
    return parts.map(part => part.file).filter(Boolean);
  }

  /**
   * @returns The track number.
   */
  get trackNumber(): number | undefined {
    return this.index;
  }

  // /**
  //  * @returns File paths for all parts of this media item.
  //  */
  // iterParts(): Part[] {
  //   return this.media?.flatMap(media => media.Part ?? []) ?? [];
  // }

  /**
   * @returns A filename for use in download.
   */
  prettyfilename(): string {
    const trackNum = String(this.trackNumber ?? '00').padStart(2, '0');
    // Use optional chaining for potentially undefined properties
    return `${this.grandparentTitle ?? 'Unknown Artist'} - ${this.parentTitle ?? 'Unknown Album'} - ${trackNum} - ${this.title ?? 'Unknown Track'}`;
  }

  /**
   * Return the track's Album.
   */
  async album(): Promise<Album> {
    if (!this.parentKey) {
      throw new Error('Missing parentKey to fetch album');
    }
    const data = await fetchItem(this.server, this.parentKey);
    return new Album(this.server, data, this.parentKey, this);
  }

  /**
   * Return the track's Artist.
   */
  async artist(): Promise<Artist> {
    if (!this.grandparentKey) {
      throw new Error('Missing grandparentKey to fetch artist');
    }
    const data = await fetchItem(this.server, this.grandparentKey);
    return new Artist(this.server, data, this.grandparentKey, this);
  }

  /**
   * @returns Default title for a new syncItem.
   */
  override _defaultSyncTitle(): string {
    // Use optional chaining for potentially undefined properties
    return `${this.grandparentTitle ?? 'Unknown Artist'} - ${this.parentTitle ?? 'Unknown Album'} - ${this.title ?? 'Unknown Track'}`;
  }

  /**
   * Returns the Plex Web URL pointing to the album details page for this track.
   */
  override getWebURL({ base }: { base?: string } = {}): string {
    if (this.parentKey) {
      const params = new URLSearchParams();
      params.append('key', this.parentKey);
      return this.server._buildWebURL({ base, endpoint: 'details', params });
    }

    return super.getWebURL({ base });
  }

  // metadataDirectory property requires Path module and filesystem access, which is
  // complex in node/browser. Omitting for now, might need specific implementation.
  // get metadataDirectory(): string { ... }

  /**
   * Returns a sonic adventure from the current track to the specified track.
   * @param to The target track for the sonic adventure.
   */
  async sonicAdventure(to: Track): Promise<Track[]> {
    const section = await this.section();
    type MusicSectionLike = { sonicAdventure: (start: Track, end: Track) => Promise<Track[]> };
    const hasSonicAdventure = (s: unknown): s is MusicSectionLike =>
      typeof (s as { sonicAdventure?: unknown }).sonicAdventure === 'function';

    if (!hasSonicAdventure(section)) {
      throw new Error('Section does not support sonicAdventure');
    }

    return section.sonicAdventure(this, to);
  }

  // /**
  //  * @returns The LibrarySection this item belongs to.
  //  */
  // override section(): LibrarySection | undefined {
  //   let parent = this._parent; // Access protected _parent from base
  //   // Navigate up until we find a LibrarySection or hit the top
  //   while (parent) {
  //     // Basic check based on key structure, might need refinement
  //     if (parent instanceof PlexObject && parent.key?.startsWith('/library/sections/')) {
  //       return parent as LibrarySection;
  //     }
  //     // Check if parent has a _parent property to continue traversal
  //     if (!('_parent' in parent) || !parent._parent) {
  //       break;
  //     }
  //     parent = parent._parent as PlexObject | undefined;
  //   }
  //   return undefined;
  // }

  /**
   * Populates the object's properties from the provided Plex API data,
   * overriding the base Audio class method to add Track-specific attributes.
   * @param data The raw data object from the Plex API.
   * @protected
   */
  override _loadData(data: TrackData): void {
    super._loadData(data);

    // Assign directly, assuming data properties are already numbers
    this.audienceRating = data.audienceRating;
    this.chapterSource = data.chapterSource;
    this.duration = data.duration;
    this.grandparentArt = data.grandparentArt;
    this.grandparentGuid = data.grandparentGuid;
    this.grandparentKey = data.grandparentKey;
    this.grandparentRatingKey = data.grandparentRatingKey;
    this.grandparentTheme = data.grandparentTheme;
    this.grandparentThumb = data.grandparentThumb;
    this.grandparentTitle = data.grandparentTitle;
    this.originalTitle = data.originalTitle;
    this.parentGuid = data.parentGuid;
    this.parentIndex = data.parentIndex; // Disc Number
    this.parentKey = data.parentKey;
    this.parentRatingKey = data.parentRatingKey;
    this.parentThumb = data.parentThumb;
    this.parentTitle = data.parentTitle;
    this.primaryExtraKey = data.primaryExtraKey;
    this.rating = data.rating;
    this.skipCount = data.skipCount;
    this.sourceURI = data.source; // remote playlist item
    this.viewOffset = data.viewOffset ?? 0;
    this.year = data.year;

    // ratingKey, index, title, etc., are loaded by super._loadData or PlexObject base
    this.chapters = data.Chapter?.map(d => new Chapter(this.server, d, undefined, this));
    this.collections = data.Collection?.map(d => new Collection(this.server, d, undefined, this));
    this.genres = data.Genre?.map(d => new Genre(this.server, d, undefined, this));
    this.guids = data.Guid?.map(d => new Guid(this.server, d, undefined, this));
    this.labels = data.Label?.map(d => new Label(this.server, d, undefined, this));
    this.media = data.Media?.map(d => new Media(this.server, d, undefined, this));
  }
}

/**
 * Represents a single Artist.
 */
export class Artist extends Audio {
  /* implements AdvancedSettingsMixin, SplitMergeMixin, UnmatchMatchMixin, ExtrasMixin, HubsMixin, RatingMixin, ArtMixin, PosterMixin, ThemeMixin, ArtistEditMixins */
  static override TAG = 'Directory';
  static override TYPE = 'artist';

  // Artist specific properties
  declare albumSort?: number; // -1: Library default, 0: Newest, 1: Oldest, 2: Name
  declare audienceRating?: number;
  declare rating?: number;
  declare theme?: string;
  declare countries?: Country[];
  declare genres?: Genre[];
  declare guids?: Guid[];
  declare labels?: Label[];
  declare similar?: Similar[];
  declare styles?: Style[];
  declare collections?: Collection[];

  get locations(): string[] {
    // Replicate listAttrs logic (assuming Location tag with path attribute)
    return this._data?.Location?.map((loc: { path?: string }) => loc.path).filter(Boolean) ?? [];
  }

  // Constructor calls super and _loadData
  constructor(
    server: PlexServer,
    data: any,
    initpath?: string,
    parent?: PlexObject, // Allow parent like LibrarySection
  ) {
    super(server, data, initpath, parent);
    // super constructor already calls _loadData, call again to apply Artist specifics
    this._loadData(data);
  }

  /**
   * Returns a list of Album objects by the artist.
   * @param options Additional search options.
   */
  async albums(options: Record<string, unknown> = {}): Promise<Album[]> {
    if (!this.librarySectionID) {
      await this.reload();
    }

    const section = await this.section();
    if (!section || typeof section.search !== 'function') {
      console.error('Cannot search for albums without a valid section');
      return [];
    }
    // Combine artist filter with any provided filters
    const filters = {
      ...(options.filters as Record<string, string | number | boolean>),
      'artist.id': this.ratingKey,
    };
    const { filters: _ignored, ...rest } = options as Record<string, unknown>;
    return section.search({ libtype: 'album', ...rest, filters }, Album);
  }

  /**
   * Returns the Album that matches the specified title for this artist.
   * Case-insensitive exact match on title.
   */
  async album(title: string): Promise<Album | undefined> {
    if (!this.librarySectionID) {
      await this.reload();
    }

    const section = await this.section();
    if (!section || typeof section.search !== 'function') {
      return undefined;
    }

    const filters = { 'artist.id': this.ratingKey } as Record<string, string | number | boolean>;
    const results = await section.search(
      { libtype: 'album', title__iexact: title, filters },
      Album,
    );
    return results[0];
  }

  /**
   * Returns the Track that matches the specified criteria.
   * @param title Title of the track.
   * @param album Album name (required if title not specified).
   * @param track Track number (required if title not specified).
   */
  async track(
    args: { title: string } | { album: string; track: number },
  ): Promise<Track | undefined> {
    const key = `${this.key}/allLeaves`;
    let query: Record<string, any> = {};

    if ('title' in args) {
      query = { title__iexact: args.title };
    } else if ('album' in args && 'track' in args) {
      query = { parentTitle__iexact: args.album, index: args.track };
    } else {
      throw new Error('Missing argument: title or album and track are required');
    }

    try {
      // fetchItem might throw NotFound, return undefined in that case
      const data = await fetchItem(this.server, key, query);
      return new Track(this.server, data, key, this);
    } catch (e) {
      if (e.constructor.name === 'NotFound') {
        return undefined;
      }
      throw e;
    }
  }

  /**
   * Returns a list of Track objects by the artist.
   * @param options Additional fetch options.
   */
  async tracks(options: Record<string, string | number> = {}): Promise<Track[]> {
    const key = `${this.key}/allLeaves`;
    return fetchItems(this.server, key, options, Track, this);
  }

  /** Alias of track(). */
  async get(
    args: { title: string } | { album: string; track: number },
  ): Promise<Track | undefined> {
    return this.track(args);
  }

  // /**
  //  * Returns a list of popular tracks by the artist.
  //  */
  async popularTracks(): Promise<Track[]> {
    const section = await this.section();
    if (!section || typeof section.search !== 'function') {
      return [];
    }
    return section.search<Track>(
      {
        libtype: 'track',
        'album.subformat!': 'Compilation,Live',
        'artist.id': this.ratingKey,
        group: 'title',
        'ratingCount>>': 0,
        sort: 'ratingCount:desc',
        limit: 100,
      },
      Track,
    );
  }

  // /**
  //  * Returns the artist radio station Playlist or undefined.
  //  */
  // async station(): Promise<Playlist | undefined> {
  //   const key = `${this.key}?includeStations=1`;
  //   try {
  //     const stations = await fetchItems(
  //       this.server,
  //       key,
  //       undefined,
  //       PlexObject as any,
  //       this,
  //       'Stations',
  //     );
  //     return stations[0]; // fetchItems with rtag extracts the items under that tag
  //   } catch (e) {
  //     console.error('Failed to fetch artist station', e);
  //     return undefined;
  //   }
  // }

  // // Known Linter Issue: Signature mismatch / override requirement incorrectly reported.
  // section(): LibrarySection | undefined {
  //   // Known Linter Issue: Linter incorrectly flags _parent access.
  //   let parent = this._parent;
  //   while (parent) {
  //     if (parent instanceof PlexObject && parent.key?.startsWith('/library/sections/')) {
  //       return parent as LibrarySection;
  //     }
  //     if (!('_parent' in parent) || !parent._parent) {
  //       break;
  //     }
  //     parent = parent._parent as PlexObject | undefined;
  //   }
  //   return undefined;
  // }

  /**
   * Load attribute values from Plex XML response.
   * @protected
   */
  override _loadData(data: ArtistData): void {
    super._loadData(data);
    const albumSortInt = data.albumSort ? parseInt(String(data.albumSort), 10) : NaN;
    this.albumSort = isNaN(albumSortInt) ? -1 : albumSortInt;
    const audienceRatingFloat =
      data.audienceRating !== undefined ? parseFloat(String(data.audienceRating)) : NaN;
    this.audienceRating = isNaN(audienceRatingFloat) ? undefined : audienceRatingFloat;
    this.key = data.key?.replace('/children', '');
    const ratingFloat = data.rating !== undefined ? parseFloat(String(data.rating)) : NaN;
    this.rating = isNaN(ratingFloat) ? undefined : ratingFloat;
    this.theme = data.theme;
    this.countries = data.Country?.map(d => new Country(this.server, d, undefined, this));
    this.genres = data.Genre?.map(d => new Genre(this.server, d, undefined, this));
    this.guids = data.Guid?.map(d => new Guid(this.server, d, undefined, this));
    this.labels = data.Label?.map(d => new Label(this.server, d, undefined, this));
    this.similar = data.Similar?.map(d => new Similar(this.server, d, undefined, this));
    this.styles = data.Style?.map(d => new Style(this.server, d, undefined, this));
    this.collections = data.Collection?.map(d => new Collection(this.server, d, undefined, this));
  }
}

/**
 * Represents a single Album.
 */
export class Album extends Audio {
  static override TAG = 'Directory';
  static override TYPE = 'album';

  // Album specific properties
  declare audienceRating?: number;
  // mapped arrays
  declare collections?: Collection[];
  declare formats?: Format[];
  declare genres?: Genre[];
  declare guids?: Guid[];
  // key inherited from Audio
  declare labels?: Label[];
  declare leafCount?: number;
  declare loudnessAnalysisVersion?: number;
  declare originallyAvailableAt?: Date;
  /**
   * Artist GUID
   */
  declare parentGuid?: string;
  /**
   * Artist Key
   */
  declare parentKey?: string;
  /**
   * Artist Rating Key
   */
  declare parentRatingKey?: number;
  /**
   * Artist Theme
   */
  declare parentTheme?: string;
  /**
   * Artist Thumb
   */
  declare parentThumb?: string;
  /**
   * Artist Title
   */
  declare parentTitle?: string;
  declare rating?: number;
  declare studio?: string;
  declare styles?: Style[];
  declare subformats?: Subformat[];
  declare viewedLeafCount?: number;

  constructor(
    server: PlexServer,
    data: any,
    initpath: string | undefined,
    parent: PlexObject | undefined,
  ) {
    super(server, data, initpath, parent);
    this._loadData(data);
  }

  // TODO: not sure why this isn't working yet
  // /**
  //  * Returns the Track that matches the specified criteria.
  //  * @param titleOrIndex Title of the track (string) or track number (number).
  //  * @param track Track number (optional, only used if titleOrIndex is not a number).
  //  */
  // async track(titleOrIndex: string | number, track?: number): Promise<Track | undefined> {
  //   const key = `${this.key}/children`;
  //   let query: Record<string, any> = {};

  //   if (typeof titleOrIndex === 'string') {
  //     query = { title__iexact: titleOrIndex };
  //     // Allow specifying track number even with title, though less common
  //     if (track !== undefined) {
  //       query.index = track;
  //     }
  //   } else if (typeof titleOrIndex === 'number') {
  //     query = { index: titleOrIndex };
  //   } else {
  //     throw new Error('Missing argument: title or track number is required');
  //   }

  //   return fetchItem(this.server, key, query, Track);
  // }

  /**
   * Returns a list of Track objects in the album.
   * @param options Additional fetch options.
   */
  async tracks(options: Record<string, string | number> = {}): Promise<Track[]> {
    const key = `${this.key}/children`;
    return fetchItems(this.server, key, options, Track, this);
  }

  /**
   * Return the album's Artist.
   */
  async artist(): Promise<Artist> {
    if (!this.parentKey) {
      throw new Error('Missing parentKey to fetch artist');
    }
    const data = await fetchItem(this.server, this.parentKey);
    return new Artist(this.server, data, this.parentKey, this);
  }

  /**
   * Returns the default title for a sync item.
   */
  override _defaultSyncTitle(): string {
    return `${this.parentTitle ?? 'Unknown Artist'} - ${this.title ?? 'Unknown Album'}`;
  }

  // section() method - Albums typically don't directly need this,
  // but could be inherited or implemented if needed to find parent section.

  /**
   * Load attribute values from Plex XML response.
   * @protected
   */
  override _loadData(data: AlbumData): void {
    super._loadData(data);

    // Assign directly, assuming data properties have correct types
    this.audienceRating = data.audienceRating;
    this.key = data.key?.replace('/children', ''); // Apply FIX_BUG_50
    this.leafCount = data.leafCount;
    this.loudnessAnalysisVersion = data.loudnessAnalysisVersion;
    // Attempt direct Date parsing for originallyAvailableAt
    try {
      this.originallyAvailableAt = data.originallyAvailableAt
        ? new Date(data.originallyAvailableAt)
        : undefined;
      // Check if the date is valid
      if (this.originallyAvailableAt && isNaN(this.originallyAvailableAt.getTime())) {
        this.originallyAvailableAt = undefined;
      }
    } catch {
      this.originallyAvailableAt = undefined;
    }
    this.parentGuid = data.parentGuid;
    this.parentKey = data.parentKey;
    this.parentRatingKey = data.parentRatingKey;
    this.parentTheme = data.parentTheme;
    this.parentThumb = data.parentThumb;
    this.parentTitle = data.parentTitle;
    this.rating = data.rating;
    this.studio = data.studio;
    this.viewedLeafCount = data.viewedLeafCount;
    this.year = data.year;
    this.collections = data.Collection?.map(d => new Collection(this.server, d, undefined, this));
    this.formats = data.Format?.map(d => new Format(this.server, d, undefined, this));
    this.genres = data.Genre?.map(d => new Genre(this.server, d, undefined, this));
    this.guids = data.Guid?.map((d: any) => new Guid(this.server, d, undefined, this));
    this.labels = data.Label?.map(d => new Label(this.server, d, undefined, this));
    this.styles = data.Style?.map(d => new Style(this.server, d, undefined, this));
    this.subformats = data.Subformat?.map(d => new Subformat(this.server, d, undefined, this));
  }
}
