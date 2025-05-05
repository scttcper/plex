import { URLSearchParams } from 'url';

import { PartialPlexObject } from './base/partialPlexObject.js';
import { PlexObject } from './base/plexObject.js';
import { fetchItem, fetchItems } from './baseFunctionality.js';
import type { PlexServer } from './server.js';

/**
 * Base class for all audio objects including Artist, Album, and Track.
 */
export class Audio extends PartialPlexObject {
  /** Default metadata type for audio sync items. */
  static METADATA_TYPE = 'track';

  /** Hardcoded list type for filtering. */
  get listType(): 'audio' {
    return 'audio';
  }

  addedAt?: Date;
  art?: string;
  artBlurHash?: string;
  /** Sonic distance from a seed item, used in sonically similar results. */
  distance?: number;
  guid?: string;
  /** Plex index number (often the track number for tracks). */
  index?: number;
  lastRatedAt?: Date;
  lastViewedAt?: Date;
  /** Key of the library section this item belongs to. */
  librarySectionKey?: string;
  /** Title of the library section this item belongs to. */
  librarySectionTitle?: string;
  /** Plex music analysis version (1 indicates sonic analysis complete). */
  musicAnalysisVersion?: number;
  summary?: string;
  thumb?: string;
  thumbBlurHash?: string;
  /** Title used for sorting (defaults to title). */
  titleSort?: string;
  updatedAt?: Date;
  /** User rating (0.0-10.0). */
  userRating?: number;
  /** Count of times the item was played. */
  viewCount?: number;

  /** Store the raw data from the Plex API for lazy loading related items. */
  protected _data?: any;

  /**
   * @protected Should not be called directly. Use `server.fetchItem()`.
   * Initializes a new instance of the Audio class.
   * @param server The PlexServer instance used for communication.
   * @param data The raw data object received from the Plex API.
   * @param initpath The path used to fetch this item initially.
   */
  constructor(server: PlexServer, data: any, initpath?: string) {
    super(server, data, initpath);
    this._loadData(data);
  }

  // /** List of field objects. */
  // get fields(): Field[] {
  //   // Assumes fields are stored under the 'Field' key in the raw data
  //   return (
  //     this._data?.Field?.map((fieldData: any) => new (PlexObject as any)(this.server, fieldData)) ??
  //     []
  //   );
  // }

  // /** List of image objects. */
  // get images(): Image[] {
  //   // Assumes images are stored under the 'Image' key in the raw data
  //   // Instantiate actual Image objects
  //   return (
  //     this._data?.Image?.map((imageData: any) => new (PlexObject as any)(this.server, imageData)) ??
  //     []
  //   );
  // }

  // /** List of mood objects. */
  // get moods(): Mood[] {
  //   // Assumes moods are stored under the 'Mood' key in the raw data
  //   // Instantiate actual Mood objects
  //   return (
  //     this._data?.Mood?.map((moodData: any) => new (PlexObject as any)(this.server, moodData)) ?? []
  //   );
  // }

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
    return part ? this.server.url(part, true)?.toString() : undefined;
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
  protected _loadData(data: any): void {
    this._data = data; // Store raw data for potential lazy loading

    const addedAtTimestamp = data.addedAt ? parseInt(data.addedAt, 10) : NaN;
    this.addedAt = isNaN(addedAtTimestamp) ? undefined : new Date(addedAtTimestamp * 1000);
    this.art = data.art ? this.server.url(data.art, true)?.toString() : undefined;
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
    const ratingKeyInt = data.ratingKey ? parseInt(data.ratingKey, 10) : NaN;
    this.ratingKey = isNaN(ratingKeyInt) ? this.ratingKey : ratingKeyInt.toString();
    this.summary = data.summary;
    this.thumb = data.thumb ? this.server.url(data.thumb, true)?.toString() : undefined;
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
  audienceRating?: number;
  // chapters defined via getter
  chapterSource?: string;
  // collections defined via getter
  duration?: number;
  // genres defined via getter
  grandparentArt?: string;
  grandparentGuid?: string;
  grandparentKey?: string;
  grandparentRatingKey?: number;
  grandparentTheme?: string;
  grandparentThumb?: string;
  grandparentTitle?: string; // Artist Name
  // guids defined via getter
  // index inherited from Audio
  // labels defined via getter
  // media defined via getter
  originalTitle?: string; // Often the Artist Name again or original track title?
  parentGuid?: string;
  parentIndex?: number; // Disc Number
  parentKey?: string;
  parentRatingKey?: number;
  parentThumb?: string;
  parentTitle?: string; // Album Title
  primaryExtraKey?: string;
  rating?: number; // Inherited ratingKey exists from PlexObject base
  skipCount?: number;
  sourceURI?: string; // Remote playlist item
  // viewCount inherited from Audio
  // lastViewedAt inherited from Audio
  viewOffset?: number;

  // Properties from Mixins (assuming, some might overlap with Audio)
  // userRating inherited from Audio
  // art inherited from Audio
  // thumb inherited from Audio (used as poster?)
  // theme inherited from Audio

  // Constructor calls super and _loadData
  constructor(server: PlexServer, data: any, initpath?: string, parent?: PlexObject) {
    super(server, data, initpath);
    // this._parent = parent;
    // Ensure _loadData is called after constructor logic completes
    // super constructor already calls _loadData, but we need to override it
    // to load Track specific data AFTER Audio data is loaded.
    // We call it again here, potentially duplicating some work but ensuring override.
    this._loadData(data);
  }

  // // Public Getters/Methods first
  // get chapters(): Chapter[] {
  //   return findItems(this._data, undefined, PlexObject as any);
  // }

  // get collections(): Collection[] {
  //   return findItems(this._data, undefined, PlexObject as any);
  // }

  // get genres(): Genre[] {
  //   return findItems(this._data, undefined, PlexObject as any);
  // }

  // get guids(): Guid[] {
  //   return findItems(this._data, undefined, PlexObject as any);
  // }

  // get labels(): Label[] {
  //   return findItems(this._data, undefined, PlexObject as any);
  // }

  // get media(): Media[] {
  //   return findItems(this._data, undefined, PlexObject as any);
  // }

  // /**
  //  * @returns List of file paths where the track is found on disk.
  //  */
  // get locations(): string[] {
  //   const parts: Part[] = this.iterParts();
  //   return parts.map(part => part.file).filter(Boolean);
  // }

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
    // Rely on inference, cast result if needed
    return fetchItem(this.server, this.parentKey, undefined, PlexObject as any);
  }

  /**
   * Return the track's Artist.
   */
  async artist(): Promise<Artist> {
    if (!this.grandparentKey) {
      throw new Error('Missing grandparentKey to fetch artist');
    }
    // Rely on inference, cast result if needed
    return fetchItem(this.server, this.grandparentKey, undefined, PlexObject as any);
  }

  /**
   * @returns Default title for a new syncItem.
   */
  override _defaultSyncTitle(): string {
    // Use optional chaining for potentially undefined properties
    return `${this.grandparentTitle ?? 'Unknown Artist'} - ${this.parentTitle ?? 'Unknown Album'} - ${this.title ?? 'Unknown Track'}`;
  }

  // /**
  //  * @returns The Plex Web URL for the album details page.
  //  */
  // override getWebURL(base?: string): string | undefined {
  //   if (!this.parentKey) {
  //     return undefined; // Use parentKey for the web URL target
  //   }
  //   // Keep 4 args assuming TS _buildWebURL matches Python version
  //   return this.server._buildWebURL(base, 'details', undefined, this.parentKey);
  // }

  // metadataDirectory property requires Path module and filesystem access, which is
  // complex in node/browser. Omitting for now, might need specific implementation.
  // get metadataDirectory(): string { ... }

  /**
   * Returns a sonic adventure from the current track to the specified track.
   * @param to The target track for the sonic adventure.
   */
  async sonicAdventure(to: Track): Promise<Track[]> {
    const section = this.section();
    // Ensure the section has the sonicAdventure method (which MusicSection should)
    if (typeof (section as any).sonicAdventure !== 'function') {
      throw new Error('Section does not support sonicAdventure');
    }
    return (section as any).sonicAdventure(this, to);
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

  // Protected methods last
  /**
   * Populates the object's properties from the provided Plex API data,
   * overriding the base Audio class method to add Track-specific attributes.
   * @param data The raw data object from the Plex API.
   * @protected
   */
  override _loadData(data: any): void {
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
  albumSort?: number; // -1: Library default, 0: Newest, 1: Oldest, 2: Name
  audienceRating?: number;
  // collections defined via getter
  // countries defined via getter
  // get countries(): Country[] {
  //   return findItems(this._data, undefined, PlexObject as any);
  // }

  // // genres defined via getter
  // get genres(): Genre[] {
  //   return findItems(this._data, undefined, PlexObject as any);
  // }

  // // guids defined via getter
  // get guids(): Guid[] {
  //   return findItems(this._data, undefined, PlexObject as any);
  // }

  // // key inherited from Audio
  // // labels defined via getter
  // get labels(): Label[] {
  //   return findItems(this._data, undefined, PlexObject as any);
  // }

  // locations defined via getter
  get locations(): string[] {
    // Replicate listAttrs logic (assuming Location tag with path attribute)
    return this._data?.Location?.map((loc: any) => loc.path).filter(Boolean) ?? [];
  }

  // get similar(): Similar[] {
  //   return findItems(this._data, undefined, PlexObject as any);
  // }

  // get styles(): Style[] {
  //   return findItems(this._data, undefined, PlexObject as any);
  // }

  // get ultraBlurColors(): UltraBlurColors | undefined {
  //   // findItem returns a single item or undefined
  //   return findItems(this._data, undefined, PlexObject as any)[0];
  // }

  // theme inherited from Audio?
  // ultraBlurColors defined via getter

  // Constructor calls super and _loadData
  constructor(
    server: PlexServer,
    data: any,
    initpath?: string,
    parent?: PlexObject, // Allow parent like LibrarySection
  ) {
    super(server, data, initpath);
    // // Known Linter Issue: Linter incorrectly flags _parent access.
    // this._parent = parent;
    // super constructor already calls _loadData, call again to apply Artist specifics
    this._loadData(data);
  }

  // get collections(): Collection[] {
  //   return findItems(this._data, undefined, PlexObject as any);
  // }

  /**
   * Returns the Album that matches the specified title for this artist.
   * @param title Title of the album to return.
   */
  async album(title: string): Promise<Album | undefined> {
    const section = await this.section();
    if (!section || typeof (section as any).search !== 'function') {
      console.error('Cannot search for album without a valid section');
      return undefined;
    }
    const results = await (section as any).search(
      { libtype: 'album', title, 'artist.id': this.ratingKey }, // Using simplistic title match, might need refinement
      PlexObject as any, // Placeholder for Album class
    );
    // Assuming search returns an array, find exact match if needed
    return results.find((alb: Album) => alb.title === title);
  }

  /**
   * Returns a list of Album objects by the artist.
   * @param kwargs Additional search options.
   */
  async albums(kwargs: Record<string, any> = {}): Promise<Album[]> {
    const section = await this.section();
    if (!section || typeof (section as any).search !== 'function') {
      console.error('Cannot search for albums without a valid section');
      return [];
    }
    // Combine artist filter with any provided filters
    const filters = { ...(kwargs.filters ?? {}), 'artist.id': this.ratingKey };
    delete kwargs.filters;
    return (section as any).search(
      { libtype: 'album', ...kwargs, filters },
      PlexObject as any, // Placeholder for Album class
    );
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
      return await fetchItem(this.server, key, query, PlexObject as any); // Placeholder for Track class
    } catch (e: any) {
      if (e.constructor.name === 'NotFound') {
        return undefined;
      }
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw e;
    }
  }

  /**
   * Returns a list of Track objects by the artist.
   * @param kwargs Additional fetch options.
   */
  async tracks(kwargs: Record<string, any> = {}): Promise<Track[]> {
    const key = `${this.key}/allLeaves`;
    return fetchItems(this.server, key, kwargs, PlexObject as any, this); // Placeholder for Track class
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
  // async popularTracks(): Promise<Track[]> {
  //   const section = await this.section();
  //   if (!section || typeof (section as any).search !== 'function') {
  //     console.error('Cannot search for popular tracks without a valid section');
  //     return [];
  //   }
  //   const filters = {
  //     'album.subformat!': 'Compilation,Live',
  //     'artist.id': this.ratingKey,
  //     group: 'title',
  //     'ratingCount>>': 0,
  //   };
  //   return (section as any).search(
  //     { libtype: 'track', filters, sort: 'ratingCount:desc', limit: 100 },
  //     PlexObject as any, // Placeholder for Track class
  //   );
  // }

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
  override _loadData(data: any): void {
    super._loadData(data);
    this.albumSort = data.albumSort ?? -1;
    this.audienceRating = data.audienceRating;
    this.key = data.key?.replace('/children', '');
    // this.rating = data.rating;
  }
}

/**
 * Represents a single Album.
 */
export class Album extends Audio {
  /* implements SplitMergeMixin, UnmatchMatchMixin, RatingMixin, ArtMixin, PosterMixin, ThemeUrlMixin, AlbumEditMixins */
  static override TAG = 'Directory';
  static override TYPE = 'album';

  // Album specific properties
  audienceRating?: number;
  // collections defined via getter
  // formats defined via getter
  // get formats(): Format[] {
  //   return findItems(this._data, undefined, PlexObject as any);
  // }

  // get genres(): Genre[] {
  //   return findItems(this._data, undefined, PlexObject as any);
  // }

  // get guids(): Guid[] {
  //   return findItems(this._data, undefined, PlexObject as any);
  // }

  // key inherited from Audio
  // labels defined via getter
  leafCount?: number;
  loudnessAnalysisVersion?: number;
  originallyAvailableAt?: Date;
  parentGuid?: string; // Artist GUID
  parentKey?: string; // Artist Key
  parentRatingKey?: number; // Artist Rating Key
  parentTheme?: string; // Artist Theme
  parentThumb?: string; // Artist Thumb
  parentTitle?: string; // Artist Title
  rating?: number;
  studio?: string;
  // styles defined via getter
  // subformats defined via getter
  // ultraBlurColors defined via getter
  viewedLeafCount?: number;

  // Constructor calls super and _loadData
  constructor(
    server: PlexServer,
    data: any,
    initpath?: string,
    parent?: PlexObject, // Allow parent like LibrarySection or Artist
  ) {
    super(server, data, initpath);
    // this._parent = parent;
    // super constructor already calls _loadData, call again to apply Album specifics
    this._loadData(data);
  }

  // get collections(): Collection[] {
  //   return findItems(this._data, undefined, PlexObject as any);
  // }

  // get labels(): Label[] {
  //   return findItems(this._data, undefined, PlexObject as any);
  // }

  // override get styles(): Style[] {
  //   return findItems(this._data, undefined, PlexObject as any);
  // }

  // get subformats(): Subformat[] {
  //   return findItems(this._data, undefined, PlexObject as any);
  // }

  // override get ultraBlurColors(): UltraBlurColors | undefined {
  //   // findItem returns a single item or undefined
  //   return findItems(this._data, undefined, PlexObject as any)[0];
  // }

  /**
   * Returns the Track that matches the specified criteria.
   * @param titleOrIndex Title of the track (string) or track number (number).
   * @param track Track number (optional, only used if titleOrIndex is not a number).
   */
  async track(titleOrIndex: string | number, track?: number): Promise<Track | undefined> {
    const key = `${this.key}/children`;
    let query: Record<string, any> = {};

    if (typeof titleOrIndex === 'string') {
      query = { title__iexact: titleOrIndex };
      // Allow specifying track number even with title, though less common
      if (track !== undefined) {
        query.index = track;
      }
    } else if (typeof titleOrIndex === 'number') {
      query = { index: titleOrIndex };
    } else {
      throw new Error('Missing argument: title or track number is required');
    }

    try {
      // Add parentTitle filter for robustness? Python version does for index lookup.
      // query.parentTitle__iexact = this.title;
      return await fetchItem(this.server, key, query, PlexObject as any); // Placeholder for Track class
    } catch (e: any) {
      if (e.constructor.name === 'NotFound') {
        return undefined;
      }
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw e;
    }
  }

  /**
   * Returns a list of Track objects in the album.
   * @param kwargs Additional fetch options.
   */
  async tracks(kwargs: Record<string, any> = {}): Promise<Track[]> {
    const key = `${this.key}/children`;
    return fetchItems(this.server, key, kwargs, PlexObject as any, this); // Placeholder for Track class
  }

  /** Alias of track(). */
  async get(titleOrIndex: string | number, track?: number): Promise<Track | undefined> {
    return this.track(titleOrIndex, track);
  }

  /**
   * Return the album's Artist.
   */
  async artist(): Promise<Artist> {
    if (!this.parentKey) {
      throw new Error('Missing parentKey to fetch artist');
    }
    return fetchItem(this.server, this.parentKey, undefined, PlexObject as any) as Promise<Artist>;
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
  override _loadData(data: any): void {
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
  }
}
