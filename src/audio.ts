import type { AlbumData, ArtistData, TrackData } from './audio.types.ts';
import { Playable } from './base/playable.ts';
import { fetchItem, fetchItems } from './baseFunctionality.ts';
import { BadRequest, NotFound } from './exceptions.ts';
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
} from './media.ts';
import type { UltraBlurColorsData } from './media.types.ts';
import { Playlist } from './playlist.ts';
import type { PlaylistResponse } from './playlist.types.ts';

type MusicSectionLike = {
  sonicAdventure: (start: Track | number, end: Track | number) => Promise<Track[]>;
};
const hasSonicAdventure = (s: unknown): s is MusicSectionLike =>
  typeof (s as { sonicAdventure?: unknown }).sonicAdventure === 'function';

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
  declare viewCount: number;

  /** Store the raw data from the Plex API for lazy loading related items. */
  declare protected _data?: Record<string, any>;

  /** List of field objects. */
  declare fields: Field[];
  declare ultraBlurColors?: UltraBlurColorsData;
  /** List of image objects. */
  declare images: Image[];
  /** List of mood objects. */
  declare moods: Mood[];

  /** Build an authenticated server URL for a path such as a media part key. */
  url(part: string): string | undefined {
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
    const finalKey = this._buildQueryKey(`${this.key}/nearest`, {
      limit,
      maxDistance,
    });

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

    const addedAtTimestamp = data.addedAt ? Number.parseInt(data.addedAt, 10) : Number.NaN;
    this.addedAt = Number.isNaN(addedAtTimestamp) ? undefined : new Date(addedAtTimestamp * 1000);
    this.art = data.art ? this.server.url(data.art, { includeToken: true })?.toString() : undefined;
    this.artBlurHash = data.artBlurHash;
    const distanceFloat = data.distance ? Number.parseFloat(data.distance) : Number.NaN;
    this.distance = Number.isNaN(distanceFloat) ? undefined : distanceFloat;
    this.guid = data.guid;
    const indexInt = data.index ? Number.parseInt(data.index, 10) : Number.NaN;
    this.index = Number.isNaN(indexInt) ? undefined : indexInt;
    this.key = data.key ?? this.key ?? '';
    const lastRatedAtTimestamp = data.lastRatedAt
      ? Number.parseInt(data.lastRatedAt, 10)
      : Number.NaN;
    this.lastRatedAt = Number.isNaN(lastRatedAtTimestamp)
      ? undefined
      : new Date(lastRatedAtTimestamp * 1000);
    const lastViewedAtTimestamp = data.lastViewedAt
      ? Number.parseInt(data.lastViewedAt, 10)
      : Number.NaN;
    this.lastViewedAt = Number.isNaN(lastViewedAtTimestamp)
      ? undefined
      : new Date(lastViewedAtTimestamp * 1000);
    const librarySectionIDInt = data.librarySectionID
      ? Number.parseInt(data.librarySectionID, 10)
      : Number.NaN;
    this.librarySectionID = Number.isNaN(librarySectionIDInt)
      ? this.librarySectionID
      : librarySectionIDInt;
    this.librarySectionKey = data.librarySectionKey;
    this.librarySectionTitle = data.librarySectionTitle;
    const musicAnalysisVersionInt = data.musicAnalysisVersion
      ? Number.parseInt(data.musicAnalysisVersion, 10)
      : Number.NaN;
    this.musicAnalysisVersion = Number.isNaN(musicAnalysisVersionInt)
      ? undefined
      : musicAnalysisVersionInt;
    this.playlistItemID = data.playlistItemID;
    this.ratingKey = data.ratingKey;
    const ratingKeyInt = data.ratingKey ? Number.parseInt(data.ratingKey, 10) : Number.NaN;
    this.ratingKey = Number.isNaN(ratingKeyInt) ? this.ratingKey : ratingKeyInt.toString();
    this.summary = data.summary;
    this.thumb = data.thumb
      ? this.server.url(data.thumb, { includeToken: true })?.toString()
      : undefined;
    this.thumbBlurHash = data.thumbBlurHash;
    this.title = data.title ?? this.title;
    this.titleSort = data.titleSort ?? this.title;
    this.type = data.type ?? this.type;
    const updatedAtTimestamp = data.updatedAt ? Number.parseInt(data.updatedAt, 10) : Number.NaN;
    this.updatedAt = Number.isNaN(updatedAtTimestamp)
      ? undefined
      : new Date(updatedAtTimestamp * 1000);
    const userRatingFloat = data.userRating ? Number.parseFloat(data.userRating) : Number.NaN;
    this.userRating = Number.isNaN(userRatingFloat) ? undefined : userRatingFloat;
    const viewCountInt =
      data.viewCount !== undefined ? Number.parseInt(data.viewCount, 10) : Number.NaN;
    this.viewCount = Number.isNaN(viewCountInt) ? 0 : viewCountInt;

    this.ultraBlurColors = data.UltraBlurColors;
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

  declare audienceRating?: number;
  declare chapterSource?: string;
  declare duration?: number;
  declare grandparentArt?: string;
  declare grandparentGuid?: string;
  declare grandparentKey?: string;
  declare grandparentRatingKey?: number | string;
  declare grandparentTheme?: string;
  declare grandparentThumb?: string;
  /** Artist name. */
  declare grandparentTitle?: string;
  /** Track artist when it differs from the album artist. */
  declare originalTitle?: string;
  declare parentGuid?: string;
  /** Disc number. */
  declare parentIndex?: number;
  declare parentKey?: string;
  declare parentRatingKey?: number | string;
  declare parentStudio?: string;
  declare parentThumb?: string;
  /** Album title. */
  declare parentTitle?: string;
  declare parentYear?: number | string;
  declare primaryExtraKey?: string;
  declare rating?: number;
  declare ratingCount?: number | string;
  declare skipCount?: number;
  /** Remote server URI for items from another server (ex: playlist items). */
  declare sourceURI?: string;
  declare viewOffset?: number;
  declare chapters?: Chapter[];
  declare collections?: Collection[];
  declare genres?: Genre[];
  declare guids?: Guid[];
  declare labels?: Label[];
  declare media?: Media[];

  /**
   * @returns List of file paths where the track is found on disk.
   */
  get locations(): string[] {
    const parts = this.media?.flatMap(m => m.parts ?? []) ?? [];
    return parts.map(part => part.file).filter((file): file is string => Boolean(file));
  }

  /**
   * @returns The track number.
   */
  get trackNumber(): number | undefined {
    return this.index;
  }

  /**
   * @returns A filename for use in download.
   */
  prettyfilename(): string {
    const trackNum = String(this.trackNumber ?? '00').padStart(2, '0');
    return `${this.grandparentTitle ?? 'Unknown Artist'} - ${this.parentTitle ?? 'Unknown Album'} - ${trackNum} - ${this.title ?? 'Unknown Track'}`;
  }

  /**
   * Return the track's Album.
   */
  async album(): Promise<Album> {
    if (!this.parentKey) {
      throw new Error('Missing parentKey to fetch album');
    }
    const key = this._buildQueryKey(this.parentKey);
    return fetchItem(this.server, key, undefined, Album, this);
  }

  /**
   * Return the track's Artist.
   */
  async artist(): Promise<Artist> {
    if (!this.grandparentKey) {
      throw new Error('Missing grandparentKey to fetch artist');
    }
    const key = this._buildQueryKey(this.grandparentKey);
    return fetchItem(this.server, key, undefined, Artist, this);
  }

  /**
   * @returns Default title for a new syncItem.
   */
  override _defaultSyncTitle(): string {
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

  /**
   * Returns a sonic adventure from the current track to the specified track.
   * @param to The target track for the sonic adventure.
   */
  async sonicAdventure(to: Track): Promise<Track[]> {
    const section = await this.section();

    if (!hasSonicAdventure(section)) {
      throw new Error('Section does not support sonicAdventure');
    }

    return section.sonicAdventure(this, to);
  }

  /**
   * Populates the object's properties from the provided Plex API data,
   * overriding the base Audio class method to add Track-specific attributes.
   * @param data The raw data object from the Plex API.
   * @protected
   */
  override _loadData(data: TrackData): void {
    super._loadData(data);

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
    this.parentStudio = data.parentStudio;
    this.parentThumb = data.parentThumb;
    this.parentTitle = data.parentTitle;
    this.parentYear = data.parentYear;
    this.primaryExtraKey = data.primaryExtraKey;
    this.rating = data.rating;
    this.ratingCount = data.ratingCount;
    this.skipCount = data.skipCount;
    this.sourceURI = data.source; // remote playlist item
    this.viewOffset = data.viewOffset ?? 0;
    this.year = data.year;

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

  /**
   * Returns a list of Album objects by the artist.
   * @param options Additional search options.
   */
  /** Return the artist radio station when the server provides one. */
  async station(): Promise<Playlist | undefined> {
    const data = await this.server.query<{
      MediaContainer: {
        Metadata?: Array<{
          Stations?: { Metadata?: PlaylistResponse[] };
        }>;
      };
    }>({
      path: this._buildQueryKey(this.key, { includeStations: 1 }),
    });
    const station = data.MediaContainer.Metadata?.[0]?.Stations?.Metadata?.[0];
    return station ? new Playlist(this.server, station, undefined, this) : undefined;
  }

  async albums(options: Record<string, unknown> = {}): Promise<Album[]> {
    if (!this.librarySectionID) {
      await this.reload();
    }
    if (!this.ratingKey) {
      throw new BadRequest('Listing albums requires an artist rating key.');
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
    const key = this._buildQueryKey(`${this.key}/allLeaves`);
    let query: Record<string, any> = {};

    if ('title' in args) {
      query = { title__iexact: args.title };
    } else if ('album' in args && 'track' in args) {
      query = { parentTitle__iexact: args.album, index: args.track };
    } else {
      throw new Error('Missing argument: title or album and track are required');
    }

    try {
      return await fetchItem(this.server, key, query, Track, this);
    } catch (e) {
      if (e instanceof NotFound) {
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
    const key = this._buildQueryKey(`${this.key}/allLeaves`);
    return fetchItems(this.server, key, options, Track, this);
  }

  /** Alias of track(). */
  async get(
    args: { title: string } | { album: string; track: number },
  ): Promise<Track | undefined> {
    return this.track(args);
  }

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

  /**
   * Load attribute values from Plex XML response.
   * @protected
   */
  override _loadData(data: ArtistData): void {
    super._loadData(data);
    const albumSortInt = data.albumSort ? Number.parseInt(String(data.albumSort), 10) : Number.NaN;
    this.albumSort = Number.isNaN(albumSortInt) ? -1 : albumSortInt;
    const audienceRatingFloat =
      data.audienceRating !== undefined
        ? Number.parseFloat(String(data.audienceRating))
        : Number.NaN;
    this.audienceRating = Number.isNaN(audienceRatingFloat) ? undefined : audienceRatingFloat;
    this.key = data.key?.replace('/children', '');
    const ratingFloat =
      data.rating !== undefined ? Number.parseFloat(String(data.rating)) : Number.NaN;
    this.rating = Number.isNaN(ratingFloat) ? undefined : ratingFloat;
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

  declare audienceRating?: number;
  declare collections?: Collection[];
  declare formats?: Format[];
  declare genres?: Genre[];
  declare guids?: Guid[];
  declare labels?: Label[];
  declare leafCount?: number;
  declare loudnessAnalysisVersion?: number | string;
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
  declare parentRatingKey?: number | string;
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

  /**
   * Returns a list of Track objects in the album.
   * @param options Additional fetch options.
   */
  /** Find a track by title or its track and optional disc number. */
  async track(options: { title: string } | { track: number; disc?: number }): Promise<Track> {
    const tracks = await this.tracks();
    const track = tracks.find(candidate =>
      'title' in options
        ? candidate.title?.toLowerCase() === options.title.toLowerCase()
        : candidate.index === options.track &&
          (options.disc === undefined || candidate.parentIndex === options.disc),
    );
    if (!track) {
      throw new NotFound('Track not found in album.');
    }
    return track;
  }

  async tracks(options: Record<string, string | number> = {}): Promise<Track[]> {
    const key = this._buildQueryKey(`${this.key}/children`);
    return fetchItems(this.server, key, options, Track, this);
  }

  /**
   * Return the album's Artist.
   */
  async artist(): Promise<Artist> {
    if (!this.parentKey) {
      throw new Error('Missing parentKey to fetch artist');
    }
    const key = this._buildQueryKey(this.parentKey);
    return fetchItem(this.server, key, undefined, Artist, this);
  }

  /**
   * Returns the default title for a sync item.
   */
  override _defaultSyncTitle(): string {
    return `${this.parentTitle ?? 'Unknown Artist'} - ${this.title ?? 'Unknown Album'}`;
  }

  /**
   * Load attribute values from Plex XML response.
   * @protected
   */
  override _loadData(data: AlbumData): void {
    super._loadData(data);

    this.audienceRating = data.audienceRating;
    this.key = data.key?.replace('/children', ''); // Apply FIX_BUG_50
    this.leafCount = data.leafCount;
    this.loudnessAnalysisVersion = data.loudnessAnalysisVersion;
    try {
      this.originallyAvailableAt = data.originallyAvailableAt
        ? new Date(data.originallyAvailableAt)
        : undefined;
      // Check if the date is valid
      if (this.originallyAvailableAt && Number.isNaN(this.originallyAvailableAt.getTime())) {
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
