import type { URL } from 'node:url';

import { Playable } from './base/playable.ts';
import { fetchItem, fetchItems } from './baseFunctionality.ts';
import { BadRequest } from './exceptions.ts';
import type { Libtype } from './library.ts';
import type { ExtrasData, FullShowData, MovieData, ShowData } from './library.types.ts';
import {
  Label,
  Field,
  Review,
  Chapter,
  Collection,
  CommonSenseMedia,
  Country,
  Director,
  Genre,
  Guid,
  Image,
  Marker,
  Media,
  Poster,
  Producer,
  Rating,
  Role,
  Similar,
  SubtitleStream,
  Writer,
} from './media.ts';
import type {
  StreamingAvailability,
  ReviewData,
  UltraBlurColorsData,
  CommonSenseMediaData,
} from './media.types.ts';
import type { MyPlexAccount } from './myplex.ts';
import type { Optimized } from './optimized.ts';
import type { OptimizeOptions, OptimizationState } from './optimized.types.ts';
import { parseOptionalDate, parseOptionalNumber, parsePlexBoolean } from './util.ts';
import type {
  MediaTagData,
  ChapterSource,
  EpisodeMetadata,
  FullMovieResponse,
  SubtitleSearchResponse,
} from './video.types.ts';

export type SubtitleSearchPreference = 0 | 1 | 2 | 3;

export interface SearchSubtitlesOptions {
  /** ISO 639-1 language code. */
  language?: string;
  /** 0 prefer non-SDH, 1 prefer SDH, 2 require SDH, 3 require non-SDH. */
  hearingImpaired?: SubtitleSearchPreference;
  /** 0 prefer non-forced, 1 prefer forced, 2 require forced, 3 require non-forced. */
  forced?: SubtitleSearchPreference;
}

export interface UploadSubtitleOptions {
  /** Subtitle file contents. */
  data: Uint8Array;
  /** Filename shown by Plex, usually including an extension. */
  title: string;
  /** Subtitle format such as `srt`; inferred from `title` when omitted. */
  format?: string;
}

export type RemoveSubtitleOptions =
  | { subtitle: SubtitleStream; id?: never; title?: never }
  | { subtitle?: never; id: number; title?: never }
  | { subtitle?: never; id?: never; title: string };

type VideoMetadataData = (MovieData | ShowData | EpisodeMetadata) & {
  CommonSenseMedia?: CommonSenseMediaData[];
  UltraBlurColors?: UltraBlurColorsData;
  parentGuid?: string;
  grandparentGuid?: string;
  Field?: Array<{ name: string; locked: boolean }>;
  Label?: MediaTagData[];
  Collection?: MediaTagData[];
  Rating?: MediaTagData[];
  Similar?: MediaTagData[];
  Role?: MediaTagData[];
  Producer?: MediaTagData[];

  Guid?: Array<{ id: string }>;
  Image?: Array<{ alt?: string; type?: string; url?: string }>;
  art?: string;
  guid?: string;
  lastRatedAt?: number;
  lastViewedAt?: number;
  librarySectionKey?: string;
  librarySectionTitle?: string;
  userRating?: number;
  playlistItemID?: number;
  artBlurHash?: string;
  thumbBlurHash?: string;
  editionTitle?: string;
  processingState?: OptimizationState;
};

export abstract class Video extends Playable {
  /** Datetime this item was added to the library. */
  declare addedAt: Date;
  /** Datetime item was last accessed. */
  declare lastViewedAt?: Date;
  /** Hardcoded as 'video' (useful for search filters). */
  listType = 'video' as const;
  /** Summary of the artist, track, or album. */
  declare summary: string;
  /** URL to thumbnail image. */
  declare thumb: string;
  /** Title to use when sorting (defaults to title). */
  declare titleSort?: string;
  /** Datetime this item was updated. */
  declare updatedAt?: Date;
  /** Count of times this item was accessed. */
  declare viewCount?: number;
  /** Datetime the user last rated this item. */
  declare lastRatedAt?: Date;
  /** Library section key (/library/sections/1). */
  declare librarySectionKey?: string;
  /** Library section title (Movies, TV Shows). */
  declare librarySectionTitle?: string;
  /** User rating (2.0; 8.0). */
  declare userRating?: number;
  declare art?: string;
  declare grandparentArt?: string;
  /** Plex GUID used to identify matching editions. */
  declare guid?: string;
  /** Edition shared by a movie or inherited from a show's hierarchy. */
  declare editionTitle?: string;
  /** Common Sense Media rating and advisory data, when returned by Plex. */
  declare commonSenseMedia?: CommonSenseMedia;
  /** External GUID objects for this video item. */
  declare guids: Guid[];
  /** Image tags for this video item. */
  declare images: Image[];
  /**
   * BlurHash string for artwork image.
   */
  declare parentGuid?: string;
  declare grandparentGuid?: string;
  declare fields: Field[];
  declare labels: Label[];
  declare collections: Collection[];
  declare ratings: Rating[];
  declare similar: Similar[];
  declare roles: Role[];
  declare producers: Producer[];
  declare ultraBlurColors?: UltraBlurColorsData;
  declare artBlurHash?: string;
  /**
   * BlurHash string for thumbnail image.
   */
  declare thumbBlurHash?: string;
  /** Current state while this item is being processed for an optimized-media group. */
  declare processingState?: OptimizationState;

  /**
   * Returns True if this video is watched.
   */
  get isWatched(): boolean {
    if (this.viewCount === undefined) {
      return false;
    }

    return this.viewCount > 0;
  }

  /**
   * Return the first first thumbnail url starting on
   * the most specific thumbnail for that item.
   */
  get thumbUrl(): URL {
    const thumb = this.thumb ?? (this as any).parentThumb ?? (this as any).grandparentThumb;
    return this.server.url(thumb, { includeToken: true });
  }

  get artUrl(): URL {
    const art = this.art ?? this.grandparentArt;
    return this.server.url(art, { includeToken: true });
  }

  /** Return the other editions with the same Plex GUID. */
  async editions<T extends Video>(this: T): Promise<T[]> {
    const section = await this.section();
    const libtype = (this as T & { TYPE: Libtype }).TYPE;
    return section.search<T>(
      {
        libtype,
        filters: {
          guid: this.guid ?? '',
          'id!': this.ratingKey ?? '',
        },
      },
      this.constructor as new (...args: any[]) => T,
    );
  }

  /**
   * Mark video as watched.
   */
  async markWatched(): Promise<void> {
    const key = `/:/scrobble?key=${this.ratingKey}&identifier=com.plexapp.plugins.library`;
    await this.server.query({ path: key });
    await this.reload();
  }

  /**
   * Mark video as unwatched.
   */
  async markUnwatched(): Promise<void> {
    const key = `/:/unscrobble?key=${this.ratingKey}&identifier=com.plexapp.plugins.library`;
    await this.server.query({ path: key });
    await this.reload();
  }

  override get isPlayed(): boolean {
    return this.isWatched;
  }

  /** Create an optimized version using a built-in preset or explicit custom profile. */
  async optimize(options: OptimizeOptions): Promise<Optimized> {
    return this.server.createOptimizedVersion({ item: this, ...options });
  }

  /** Search Plex's on-demand subtitle providers for this video. */
  async searchSubtitles(options: SearchSubtitlesOptions = {}): Promise<SubtitleStream[]> {
    const { forced = 0, hearingImpaired = 0, language = 'en' } = options;
    const params = new URLSearchParams({
      language,
      hearingImpaired: hearingImpaired.toString(),
      forced: forced.toString(),
    });
    const key = `${this.key}/subtitles?${params.toString()}`;
    const data = await this.server.query<SubtitleSearchResponse>({ path: key });
    return (data.MediaContainer.Stream ?? []).map(
      stream => new SubtitleStream(this.server, stream, key),
    );
  }

  /** Start downloading an on-demand subtitle search result. */
  async downloadSubtitle(subtitle: SubtitleStream): Promise<this> {
    if (!subtitle.key) {
      throw new BadRequest('Cannot download a subtitle result without a key.');
    }
    const params = new URLSearchParams({ key: subtitle.key });
    await this.server.query({
      path: `${this.key}/subtitles?${params.toString()}`,
      method: 'put',
    });
    return this;
  }

  /** Upload an external subtitle file for this video. */
  async uploadSubtitle(options: UploadSubtitleOptions): Promise<this> {
    if (options.data.byteLength === 0) {
      throw new BadRequest('Cannot upload an empty subtitle file.');
    }
    const format = options.format ?? subtitleFormat(options.title);
    const params = new URLSearchParams({ title: options.title, format });
    await this.server.query({
      path: `${this.key}/subtitles?${params.toString()}`,
      method: 'post',
      headers: { Accept: 'text/plain, */*' },
      body: options.data,
    });
    return this;
  }

  /** Remove an uploaded or downloaded external subtitle. */
  async removeSubtitle(options: RemoveSubtitleOptions): Promise<this> {
    const subtitle =
      'subtitle' in options
        ? options.subtitle
        : this.subtitleStreams().find(stream =>
            'id' in options ? stream.id === options.id : stream.title === options.title,
          );
    if (!subtitle) {
      const selector = 'id' in options ? options.id : options.title;
      throw new BadRequest(`Subtitle stream "${selector}" was not found.`);
    }
    if (!subtitle.key || subtitle.key !== `/library/streams/${subtitle.id}`) {
      throw new BadRequest('Embedded subtitles cannot be removed.');
    }

    await this.server.query({ path: subtitle.key, method: 'delete' });
    for (const part of this.iterParts()) {
      part.streams = part.streams.filter(stream => stream.id !== subtitle.id);
    }
    return this;
  }

  /**
   * Returns list of available Poster objects.
   */
  async posters(): Promise<Poster[]> {
    return fetchItems(
      this.server,
      `/library/metadata/${this.ratingKey}/posters`,
      undefined,
      Poster,
    );
  }

  /**
   * Set the poster for a Plex object.
   * @param poster The poster object to select.
   */
  async setPoster(poster: Poster) {
    await poster.select();
    return this;
  }

  /**
   * I haven't tested this yet. It may not work.
   */
  async uploadPoster({
    url,
    file,
  }: {
    url?: string;
    file?: Uint8Array;
  } = {}): Promise<void> {
    if (url) {
      const key = `/library/metadata/${this.ratingKey}/posters?url=${encodeURIComponent(url)}`;
      await this.server.query({ path: key, method: 'post' });
    } else if (file) {
      const key = `/library/metadata/${this.ratingKey}/posters`;
      await this.server.query({
        path: key,
        method: 'post',
        body: file,
      });
    }
  }

  protected _loadData(data: MovieData | ShowData | EpisodeMetadata): void {
    const videoData = data as VideoMetadataData;
    this.key = data.key;
    this.ratingKey = data.ratingKey;
    this.title = data.title;
    this.summary = data.summary;
    this.thumb = data.thumb;
    this.title = data.title;
    this.type = data.type;
    this.librarySectionID = data.librarySectionID;
    this.librarySectionKey = videoData.librarySectionKey;
    this.librarySectionTitle = videoData.librarySectionTitle;
    this.addedAt = new Date(data.addedAt * 1000);
    this.art = videoData.art;
    this.guid = videoData.guid;
    this.lastRatedAt = parseOptionalDate(videoData.lastRatedAt);
    this.lastViewedAt = parseOptionalDate(videoData.lastViewedAt);
    this.updatedAt = parseOptionalDate(data.updatedAt);
    this.userRating = videoData.userRating;
    this.viewCount = (data as MovieData).viewCount ?? 0;
    this.titleSort = (data as MovieData).titleSort ?? this.title;
    this.playlistItemID = videoData.playlistItemID;
    this.editionTitle = videoData.editionTitle;
    this.processingState = videoData.processingState;
    this.parentGuid = videoData.parentGuid;
    this.grandparentGuid = videoData.grandparentGuid;
    this.fields = (videoData.Field ?? []).map(
      field => new Field(this.server, field, undefined, this),
    );
    this.ultraBlurColors = videoData.UltraBlurColors;
    this.labels = (videoData.Label ?? []).map(tag => new Label(this.server, tag, undefined, this));
    this.collections = (videoData.Collection ?? []).map(
      tag => new Collection(this.server, tag, undefined, this),
    );
    this.ratings = (videoData.Rating ?? []).map(
      tag => new Rating(this.server, tag, undefined, this),
    );
    this.similar = (videoData.Similar ?? []).map(
      tag => new Similar(this.server, tag, undefined, this),
    );
    this.roles = (videoData.Role ?? []).map(tag => new Role(this.server, tag, undefined, this));
    this.producers = (videoData.Producer ?? []).map(
      tag => new Producer(this.server, tag, undefined, this),
    );
    this.artBlurHash = videoData.artBlurHash;
    this.thumbBlurHash = videoData.thumbBlurHash;
    this.guids = videoData.Guid?.map(d => new Guid(this.server, d, undefined, this)) ?? [];
    this.images = videoData.Image?.map(d => new Image(this.server, d, undefined, this)) ?? [];
    const [commonSenseMedia] = videoData.CommonSenseMedia ?? [];
    this.commonSenseMedia = commonSenseMedia
      ? new CommonSenseMedia(this.server, commonSenseMedia, undefined, this)
      : undefined;
  }
}

function subtitleFormat(title: string): string {
  const separator = title.lastIndexOf('.');
  const format = separator !== -1 ? title.slice(separator + 1) : '';
  if (!format) {
    throw new BadRequest('Subtitle format is required when the title has no extension.');
  }
  return format.toLowerCase();
}

/**
 * Represents a single Movie.
 */
export class Movie extends Video {
  TAG = 'Video';
  TYPE = 'movie';
  METADATA_TYPE = 'movie';

  /** Audience rating (usually from Rotten Tomatoes). */
  declare audienceRating?: number;
  /** Key to audience rating image (rottentomatoes://image.rating.spilled) */
  declare audienceRatingImage?: string;
  /** Chapter source (agent; media; mixed). */
  declare chapterSource?: ChapterSource;
  /** Content rating (PG-13; NR; TV-G). */
  declare contentRating: string;
  /** Minimum age for the content rating, when Plex knows it. */
  declare contentRatingAge?: number;
  /** Duration of movie in milliseconds. */
  declare duration: number;
  /** Credits marker generation preference (-1 library default, 0 disabled, 1 enabled). */
  declare enableCreditsMarkerGeneration?: number;
  /** Language override for metadata, when set on this item. */
  declare languageOverride?: string;
  /** Original title, often the foreign title (転々; 엽기적인 그녀). */
  declare originalTitle?: string;
  /** YYYY-MM-DD movie was released. */
  declare originallyAvailableAt: string;
  /** Primary extra key (/library/metadata/66351). */
  declare primaryExtraKey: string;
  /** Movie rating (7.9; 9.8; 8.1). */
  declare rating: number;
  /** Key to rating image (rottentomatoes://image.rating.rotten). */
  declare ratingImage: string;
  /** URL slug used by Plex (big-buck-bunny). */
  declare slug?: string;
  /** Remote server URI for items from another server (ex: playlist items). */
  declare sourceURI?: string;
  /** Studio that created movie (Di Bonaventura Pictures; 21 Laps Entertainment). */
  declare studio: string;
  /** Movie tag line (Back 2 Work; Who says men can't change?). */
  declare tagline?: string;
  /** Key to theme resource (/library/metadata/<ratingkey>/theme/<themeid>). */
  declare theme?: string;
  /** Original title preference (-1 library default, 0 disabled, 1 enabled). */
  declare useOriginalTitle?: number;
  /** View offset in milliseconds. */
  declare viewOffset: number;
  /** Plex GUID (com.plexapp.agents.imdb://tt4302938?lang=en) */
  declare guid: string;
  declare directors: Director[];
  declare countries: Country[];
  declare writers: Writer[];
  declare chapters?: Chapter[];
  declare collections: Collection[];
  // fields (List<:class:`~plexapi.media.Field`>): List of field objects.
  declare genres: Genre[];
  // media (List<:class:`~plexapi.media.Media`>): List of media objects.
  declare producers: Producer[];
  declare roles: Role[];
  declare similar: Similar[];
  declare media: Media[];
  declare guids: Guid[];
  declare markers: Marker[];
  declare ratings: Rating[];

  async reviews(): Promise<Review[]> {
    const data = await this.server.query<{
      MediaContainer: { Metadata?: Array<{ Review?: ReviewData[] }> };
    }>({
      path: this._buildQueryKey(this.key, { includeReviews: 1 }),
    });
    return (data.MediaContainer.Metadata?.[0]?.Review ?? []).map(
      review => new Review(this.server, review, undefined, this),
    );
  }

  get actors() {
    return this.roles;
  }

  async streamingServices(
    account: MyPlexAccount = this.server.myPlexAccount(),
  ): Promise<StreamingAvailability[]> {
    return account.streamingServices(this);
  }

  async onWatchlist(account: MyPlexAccount): Promise<boolean> {
    return account.onWatchlist(this);
  }

  async addToWatchlist(account: MyPlexAccount): Promise<void> {
    await account.addToWatchlist(this);
  }

  async removeFromWatchlist(account: MyPlexAccount): Promise<void> {
    await account.removeFromWatchlist(this);
  }

  async locations(): Promise<string[]> {
    if (!this.isFullObject) {
      await this.reload();
    }

    const parts = (this.media?.map(media => media.parts) ?? []).flat();
    return parts
      .map(part => part.file)
      .filter((file): file is string => typeof file === 'string' && file.length > 0);
  }

  /**
   * Returns True if this movie has an intro marker
   */
  async hasIntroMarker(): Promise<boolean> {
    if (!this.isFullObject) {
      await this.reload();
    }

    return this.markers.some(marker => marker.type === 'intro');
  }

  /**
   * Returns True if this movie has a credits marker
   */
  async removeFromContinueWatching(): Promise<void> {
    const params = new URLSearchParams({ ratingKey: this.ratingKey });
    await this.server.query({
      path: `/actions/removeFromContinueWatching?${params}`,
      method: 'put',
    });
  }

  async hasCreditsMarker(): Promise<boolean> {
    if (!this.isFullObject) {
      await this.reload();
    }

    return this.markers.some(marker => marker.type === 'credits');
  }

  protected override _loadData(data: MovieData): void {
    super._loadData(data);
    this.art = data.art;
    this.audienceRating = data.audienceRating;
    this.audienceRatingImage = data.audienceRatingImage;
    this.chapterSource = data.chapterSource;
    this.contentRating = data.contentRating;
    this.contentRatingAge = parseOptionalNumber(data.contentRatingAge);
    this.duration = data.duration;
    this.enableCreditsMarkerGeneration = parseOptionalNumber(data.enableCreditsMarkerGeneration);
    this.guid = data.guid;
    this.languageOverride = data.languageOverride;
    this.originalTitle = data.originalTitle;
    this.originallyAvailableAt = data.originallyAvailableAt;
    this.primaryExtraKey = data.primaryExtraKey;
    this.rating = data.rating;
    this.ratingImage = data.ratingImage;
    this.slug = data.slug;
    this.sourceURI = data.source;
    this.studio = data.studio;
    this.tagline = data.tagline;
    this.theme = data.theme;
    this.useOriginalTitle = parseOptionalNumber(data.useOriginalTitle);
    this.viewOffset = data.viewOffset ?? 0;
    this.year = data.year;
    this.librarySectionID = data.librarySectionID;
    this.directors = data.Director?.map(d => new Director(this.server, d, undefined, this)) ?? [];
    this.countries = data.Country?.map(d => new Country(this.server, d, undefined, this)) ?? [];
    this.writers = data.Writer?.map(d => new Writer(this.server, d, undefined, this)) ?? [];
    this.collections =
      data.Collection?.map(d => new Collection(this.server, d, undefined, this)) ?? [];
    this.roles = data.Role?.map(d => new Role(this.server, d, undefined, this)) ?? [];
    this.similar = data.Similar?.map(d => new Similar(this.server, d, undefined, this)) ?? [];
    this.genres = data.Genre?.map(d => new Genre(this.server, d, undefined, this)) ?? [];
    this.producers = data.Producer?.map(d => new Producer(this.server, d, undefined, this)) ?? [];
    this.media = data.Media?.map(d => new Media(this.server, d, undefined, this)) ?? [];
    this.guids = data.Guid?.map(d => new Guid(this.server, d, undefined, this)) ?? [];
    this.markers = data.Marker?.map(d => new Marker(this.server, d, undefined, this)) ?? [];
    this.ratings = data.Rating?.map(d => new Rating(this.server, d, undefined, this)) ?? [];
  }

  protected _loadFullData(data: FullMovieResponse): void {
    const metadata = data.Metadata[0];
    this._loadData(metadata as any);
    this.librarySectionID = metadata.librarySectionID;
    this.chapters = metadata.Chapter?.map(chapter => new Chapter(this.server, chapter));
    this.collections =
      metadata.Collection?.map(
        collection => new Collection(this.server, collection, undefined, this),
      ) ?? [];
  }
}

/**
 * Represents a single Show (including all seasons and episodes).
 */
export class Show extends Video {
  TAG = 'Directory';
  TYPE = 'show';
  METADATA_TYPE = 'episode';

  declare locations: string[];
  /** Audience rating (usually from Rotten Tomatoes). */
  declare audienceRating?: number;
  /** Key to audience rating image (rottentomatoes://image.rating.spilled). */
  declare audienceRatingImage?: string;
  /** Preferred audio language for this show, when set. */
  declare audioLanguage?: string;
  /** Delete unwatched episodes preference, when set on this show. */
  declare autoDeletionItemPolicyUnwatchedLibrary?: number;
  /** Delete watched episodes preference, when set on this show. */
  declare autoDeletionItemPolicyWatchedLibrary?: number;
  /** Key to banner artwork (/library/metadata/<ratingkey>/banner/<bannerid>) */
  declare banner: string;
  /** Number of seasons, including specials. */
  declare childCount: number;
  /** Content rating (PG-13; NR; TV-G). */
  declare contentRating: string;
  /** Minimum age for the content rating, when Plex knows it. */
  declare contentRatingAge?: number;
  /** Credits marker generation preference (-1 library default, 0 disabled, 1 enabled). */
  declare enableCreditsMarkerGeneration?: number;
  /** Episode sort preference (-1 library default, 0 oldest first, 1 newest first). */
  declare episodeSort?: number;
  /** Season display preference (-1 library default, 0 show, 1 hide). */
  declare flattenSeasons?: number;
  /** Language override for metadata, when set on this item. */
  declare languageOverride?: string;
  /** TV network that aired the show. */
  declare network?: string;
  /** Original title, often the foreign title. */
  declare originalTitle?: string;
  /** Number of seasons. Falls back to childCount when Plex omits it. */
  declare seasonCount: number;
  /** Episode ordering for the show (ex: aired, dvd, absolute), when set. */
  declare showOrdering?: string;
  /** URL slug used by Plex. */
  declare slug?: string;
  /** Preferred subtitle language for this show, when set. */
  declare subtitleLanguage?: string;
  /** Subtitle mode preference, when set on this show. */
  declare subtitleMode?: number;
  /** Show tag line. */
  declare tagline?: string;
  /** Original title preference (-1 library default, 0 disabled, 1 enabled). */
  declare useOriginalTitle?: number;
  /** <:class:`~plexapi.media.Collection`>): List of collections this media belongs. */
  // collections: List;
  /** Duration of show in milliseconds. */
  declare duration: number;
  /** Plex GUID (com.plexapp.agents.imdb://tt4302938?lang=en). */
  declare guid: string;
  /** Plex index (?) */
  declare index: number;
  /** Unknown. */
  declare leafCount: number;
  /** Datetime show was released. */
  declare originallyAvailableAt?: Date;
  /** Show rating (7.9; 9.8; 8.1). */
  declare rating: number;
  /** Studio that created show (Di Bonaventura Pictures; 21 Laps Entertainment). */
  declare studio: string;
  /** Key to theme resource (/library/metadata/<ratingkey>/theme/<themeid>) */
  declare theme: string;
  /** Unknown. */
  declare viewedLeafCount: number;
  /** List of genre objects. */
  declare genres: Genre[];
  /** List of role objects. */
  declare roles: Role[];
  /** <:class:`~plexapi.media.Similar`>): List of Similar objects. */
  // similar: List;

  /**
   * Alias of {@link Show.roles}
   */
  get actors(): Role[] {
    return this.roles;
  }

  async streamingServices(
    account: MyPlexAccount = this.server.myPlexAccount(),
  ): Promise<StreamingAvailability[]> {
    return account.streamingServices(this);
  }

  async onWatchlist(account: MyPlexAccount): Promise<boolean> {
    return account.onWatchlist(this);
  }

  async addToWatchlist(account: MyPlexAccount): Promise<void> {
    await account.addToWatchlist(this);
  }

  async removeFromWatchlist(account: MyPlexAccount): Promise<void> {
    await account.removeFromWatchlist(this);
  }

  /** @returns True if this show is fully watched. */
  override get isWatched(): boolean {
    return this.viewedLeafCount === this.leafCount;
  }

  async season(titleOrIndex: string | number): Promise<Season> {
    const key = this._buildQueryKey(`/library/metadata/${this.ratingKey}/children`, {
      excludeAllLeaves: 1,
    });
    const query =
      typeof titleOrIndex === 'string' ? { title__iexact: titleOrIndex } : { index: titleOrIndex };
    return fetchItem(this.server, key, query, Season, this);
  }

  async seasons(query?: Record<string, string | number>): Promise<Season[]> {
    const key = this._buildQueryKey(`/library/metadata/${this.ratingKey}/children`, {
      excludeAllLeaves: 1,
    });
    return fetchItems(this.server, key, query, Season, this);
  }

  async episode(args: { title: string } | { season: number; episode: number }): Promise<Episode> {
    const key = this._buildQueryKey(`/library/metadata/${this.ratingKey}/allLeaves`);
    const query =
      'title' in args
        ? { title__iexact: args.title }
        : { parentIndex: args.season, index: args.episode };
    return fetchItem(this.server, key, query, Episode, this);
  }

  async episodes(query?: Record<string, string | number>): Promise<Episode[]> {
    const key = this._buildQueryKey(`/library/metadata/${this.ratingKey}/allLeaves`);
    const episodes = await fetchItems(this.server, key, query);
    return episodes.map(episode => new Episode(this.server, episode, key, this));
  }

  /** Return episodes with at least one view. */
  async watched(): Promise<Episode[]> {
    return (await this.episodes()).filter(episode => episode.viewCount > 0);
  }

  /** Return episodes that have not been viewed. */
  async unwatched(): Promise<Episode[]> {
    return (await this.episodes()).filter(episode => episode.viewCount === 0);
  }

  /** Return the episode Plex currently considers on deck for this show. */
  async onDeck(): Promise<Episode | undefined> {
    const key = this._buildQueryKey(this.key, { includeOnDeck: true });
    const data = await this.server.query<{ MediaContainer: { Metadata?: ShowData[] } }>({
      path: key,
    });
    const episode = data.MediaContainer.Metadata?.[0]?.OnDeck?.Metadata;
    return episode ? new Episode(this.server, episode, key, this) : undefined;
  }

  protected override _loadData(data: ShowData): void {
    super._loadData(data);
    this.key = (data.key ?? '').replace('/children', '');
    this.locations = (data.Location ?? []).map(location => location.path);
    this.audienceRating = data.audienceRating;
    this.audienceRatingImage = data.audienceRatingImage;
    this.audioLanguage = data.audioLanguage;
    this.autoDeletionItemPolicyUnwatchedLibrary = parseOptionalNumber(
      data.autoDeletionItemPolicyUnwatchedLibrary,
    );
    this.autoDeletionItemPolicyWatchedLibrary = parseOptionalNumber(
      data.autoDeletionItemPolicyWatchedLibrary,
    );
    this.banner = data.banner;
    this.childCount = data.childCount;
    this.contentRating = data.contentRating;
    this.contentRatingAge = parseOptionalNumber(data.contentRatingAge);
    this.duration = data.duration;
    this.enableCreditsMarkerGeneration = parseOptionalNumber(data.enableCreditsMarkerGeneration);
    this.episodeSort = parseOptionalNumber(data.episodeSort);
    this.flattenSeasons = parseOptionalNumber(data.flattenSeasons);
    this.index = data.index;
    this.languageOverride = data.languageOverride;
    this.leafCount = data.leafCount;
    this.network = data.network;
    this.originalTitle = data.originalTitle;
    this.originallyAvailableAt = parseOptionalDate(data.originallyAvailableAt);
    this.rating = data.rating;
    this.seasonCount = parseOptionalNumber(data.seasonCount) ?? data.childCount;
    this.showOrdering = data.showOrdering;
    this.slug = data.slug;
    this.studio = data.studio;
    this.subtitleLanguage = data.subtitleLanguage;
    this.subtitleMode = parseOptionalNumber(data.subtitleMode);
    this.tagline = data.tagline;
    this.theme = data.theme;
    this.useOriginalTitle = parseOptionalNumber(data.useOriginalTitle);
    this.viewedLeafCount = data.viewedLeafCount;
    this.year = data.year;
    this.genres = data.Genre?.map(genre => new Genre(this.server, genre, undefined, this)) ?? [];
    this.roles = data.Role?.map(role => new Role(this.server, role, undefined, this)) ?? [];
  }

  protected _loadFullData(data: FullShowData): void {
    this._loadData(data.Metadata[0]);
  }
}

/**
 * Represents a single Show Season (including all episodes).
 */
export class Season extends Video {
  TAG = 'Directory';
  TYPE = 'season';
  METADATA_TYPE = 'episode';

  /** Audience rating of the season. */
  declare audienceRating?: number;
  /** Preferred audio language for this season, when set. */
  declare audioLanguage?: string;
  /** Season number */
  declare index: number;
  /** Number of episodes in season. */
  declare leafCount: number;
  /** Show index, when Plex provides it. */
  declare parentIndex?: number;
  /** Key to the show this season belongs to. */
  declare parentKey: string;
  /** Rating key of the show this season belongs to */
  declare parentRatingKey: string;
  /** URL slug of the show. */
  declare parentSlug?: string;
  /** Studio of the show. */
  declare parentStudio?: string;
  /** Key to the show theme. */
  declare parentTheme?: string;
  /** Key to the show thumbnail. */
  declare parentThumb?: string;
  /** Show title */
  declare parentTitle: string;
  /** Year the show was released. */
  declare parentYear?: number;
  /** Preferred subtitle language for this season, when set. */
  declare subtitleLanguage?: string;
  /** Subtitle mode preference, when set on this season. */
  declare subtitleMode?: number;
  /** Number of watched episodes in season */
  declare viewedLeafCount: number;

  /** Returns season number */
  get seasonNumber(): number {
    return this.index;
  }

  /** Returns season number */
  override get isWatched(): boolean {
    return this.viewedLeafCount === this.leafCount;
  }

  /**
   * @returns a list of :class:`~plexapi.video.Episode` objects.
   */
  async episode(titleOrIndex: string | number): Promise<Episode> {
    const key = this._buildQueryKey(`/library/metadata/${this.ratingKey}/children`);
    const query =
      typeof titleOrIndex === 'string' ? { title__iexact: titleOrIndex } : { index: titleOrIndex };
    return fetchItem(this.server, key, query, Episode, this);
  }

  async episodes(query?: Record<string, string | number>): Promise<Episode[]> {
    const key = this._buildQueryKey(`/library/metadata/${this.ratingKey}/children`);
    const episodes = await fetchItems<EpisodeMetadata>(this.server, key, query);
    return episodes.map(episode => new Episode(this.server, episode, key, this));
  }

  /** Return episodes with at least one view. */
  async watched(): Promise<Episode[]> {
    return (await this.episodes()).filter(episode => episode.viewCount > 0);
  }

  /** Return episodes that have not been viewed. */
  async unwatched(): Promise<Episode[]> {
    return (await this.episodes()).filter(episode => episode.viewCount === 0);
  }

  /** Return the parent show. */
  async show(): Promise<Show> {
    const key = this._buildQueryKey(this.parentKey);
    return fetchItem(this.server, key, undefined, Show, this);
  }

  /** Return the episode Plex currently considers on deck for this season. */
  async onDeck(): Promise<Episode | undefined> {
    const key = this._buildQueryKey(this.key, { includeOnDeck: true });
    const data = await this.server.query<{ MediaContainer: { Metadata?: ShowData[] } }>({
      path: key,
    });
    const episode = data.MediaContainer.Metadata?.[0]?.OnDeck?.Metadata;
    return episode ? new Episode(this.server, episode, key, this) : undefined;
  }

  protected override _loadData(data: ShowData): void {
    super._loadData(data);
    this.key = (data.key || '').replace('/children', '');
    this.audienceRating = data.audienceRating;
    this.audioLanguage = data.audioLanguage;
    this.index = data.index;
    this.leafCount = data.leafCount;
    this.parentIndex = parseOptionalNumber(data.parentIndex);
    this.parentKey = data.parentKey ?? '';
    this.parentRatingKey = data.parentRatingKey ?? '';
    this.parentSlug = data.parentSlug;
    this.parentStudio = data.parentStudio;
    this.parentTheme = data.parentTheme;
    this.parentThumb = data.parentThumb;
    this.parentTitle = data.parentTitle ?? '';
    this.parentYear = parseOptionalNumber(data.parentYear);
    this.subtitleLanguage = data.subtitleLanguage;
    this.subtitleMode = parseOptionalNumber(data.subtitleMode);
    this.viewedLeafCount = data.viewedLeafCount;
  }

  protected _loadFullData(data: FullShowData): void {
    this._loadData(data.Metadata[0]);
  }
}

export class Episode extends Video {
  static override TAG = 'Video';
  TYPE = 'episode';
  METADATA_TYPE = 'episode';

  /** Unknown (media). */
  declare chapterSource?: string;
  /** Audience rating (usually from Rotten Tomatoes). */
  declare audienceRating?: number;
  /** Key to audience rating image. */
  declare audienceRatingImage?: string;
  /** Content rating (PG-13; NR; TV-G). */
  declare contentRating: string;
  /**  Duration of episode in milliseconds. */
  declare duration: number;
  /** Key to this episodes :class:`~plexapi.video.Show`. */
  declare grandparentKey: string;
  /** Unique key for this episodes :class:`~plexapi.video.Show`. */
  declare grandparentRatingKey: string;
  /** URL slug of the show. */
  declare grandparentSlug?: string;
  /** Key to this episodes :class:`~plexapi.video.Show` theme. */
  declare grandparentTheme: string;
  /** Key to this episodes :class:`~plexapi.video.Show` thumb. */
  declare grandparentThumb: string;
  /** Title of this episodes :class:`~plexapi.video.Show`. */
  declare grandparentTitle: string;
  /** Plex GUID (com.plexapp.agents.imdb://tt4302938?lang=en). */
  declare guid: string;
  /**  Episode number. */
  declare index: number;
  /**  Datetime episode was released. */
  declare originallyAvailableAt?: Date;
  /** Season number of episode. */
  declare parentIndex: number;
  /** Key to this episodes :class:`~plexapi.video.Season`. */
  declare parentKey: string;
  /**  Unique key for this episodes :class:`~plexapi.video.Season`. */
  declare parentRatingKey: string;
  /** Key to this episodes thumbnail. */
  declare parentThumb: string;
  /** Name of this episode's season */
  declare parentTitle: string;
  /** Year of the season, when Plex provides it. */
  declare parentYear?: number;
  /** Movie rating (7.9; 9.8; 8.1). */
  declare rating: number;
  /** True if the show hides seasons and this episode skips its season. */
  declare skipParent: boolean;
  /** Remote server URI for items from another server (ex: playlist items). */
  declare sourceURI?: string;
  /**  View offset in milliseconds. */
  declare viewOffset?: number;
  declare writers: Writer[];
  declare directors: Director[];
  declare media: Media[];
  declare collections: Collection[];
  declare chapters: Chapter[];
  declare markers: Marker[];

  get actors(): Role[] {
    return this.roles;
  }

  get episodeNumber(): number {
    return this.index;
  }

  /**
   * Returns this episodes season number.
   */
  async seasonNumber(): Promise<number> {
    if (this.parentIndex) {
      return this.parentIndex;
    }

    const season = await this.season();
    return season.seasonNumber;
  }

  async seasonEpisode(): Promise<string> {
    const seasonNumber = `${await this.seasonNumber()}`.padStart(2, '0');
    const episodeNumber = `${this.index}`.padStart(2, '0');
    return `s${seasonNumber}e${episodeNumber}`;
  }

  async season(): Promise<Season> {
    const key = this._buildQueryKey(this.parentKey);
    return fetchItem(this.server, key, undefined, Season, this);
  }

  async show(): Promise<Show> {
    const key = this._buildQueryKey(this.grandparentKey);
    return fetchItem(this.server, key, undefined, Show, this);
  }

  locations(): string[] {
    const parts = (this.media?.map(media => media.parts) ?? []).flat();
    return parts
      .map(part => part.file)
      .filter((file): file is string => typeof file === 'string' && file.length > 0);
  }

  /**
   * Returns True if this episode has an intro marker
   */
  async hasCommercialMarker(): Promise<boolean> {
    if (!this.isFullObject) {
      await this.reload();
    }
    return this.markers.some(marker => marker.type === 'commercial');
  }

  async hasIntroMarker(): Promise<boolean> {
    if (!this.isFullObject) {
      await this.reload();
    }

    return this.markers.some(marker => marker.type === 'intro');
  }

  /**
   * Returns True if this episode has a credits marker
   */
  async removeFromContinueWatching(): Promise<void> {
    const params = new URLSearchParams({ ratingKey: this.ratingKey });
    await this.server.query({
      path: `/actions/removeFromContinueWatching?${params}`,
      method: 'put',
    });
  }

  async hasCreditsMarker(): Promise<boolean> {
    if (!this.isFullObject) {
      await this.reload();
    }

    return this.markers.some(marker => marker.type === 'credits');
  }

  protected override _loadData(data: EpisodeMetadata): void {
    super._loadData(data);
    this.key = (data.key || '').replace('/children', '');
    this.title = data.title;
    this.audienceRating = data.audienceRating;
    this.audienceRatingImage = data.audienceRatingImage;
    this.chapterSource = data.chapterSource;
    this.contentRating = data.contentRating;
    this.duration = data.duration;
    this.grandparentArt = data.grandparentArt;
    this.grandparentKey = data.grandparentKey;
    this.grandparentRatingKey = data.grandparentRatingKey;
    this.grandparentSlug = data.grandparentSlug;
    this.grandparentTheme = data.grandparentTheme;
    this.grandparentThumb = data.grandparentThumb;
    this.grandparentTitle = data.grandparentTitle;
    this.index = data.index;
    this.originallyAvailableAt = parseOptionalDate(data.originallyAvailableAt);
    this.parentIndex = data.parentIndex;
    this.parentKey = data.parentKey;
    this.parentRatingKey = data.parentRatingKey;
    this.parentThumb = data.parentThumb;
    this.parentTitle = data.parentTitle;
    this.parentYear = parseOptionalNumber(data.parentYear);
    this.rating = data.rating;
    this.skipParent = parsePlexBoolean(data.skipParent);
    this.sourceURI = data.source;
    this.viewOffset = data.viewOffset;
    this.year = data.year;
    this.directors = data.Director?.map(d => new Director(this.server, d, undefined, this)) ?? [];
    this.writers = data.Writer?.map(d => new Writer(this.server, d, undefined, this)) ?? [];
    this.media = data.Media?.map(d => new Media(this.server, d, undefined, this));
    this.collections =
      data.Collection?.map(d => new Collection(this.server, d, undefined, this)) ?? [];
    this.chapters = data.Chapter?.map(d => new Chapter(this.server, d, undefined, this)) ?? [];
    this.markers = data.Marker?.map(d => new Marker(this.server, d, undefined, this)) ?? [];
  }

  protected _loadFullData(data: { Metadata: EpisodeMetadata[] }): void {
    this._loadData(data.Metadata[0]);
  }
}

export class Clip extends Video {
  static override TAG = 'Video';
  TYPE = 'clip';
  METADATA_TYPE = 'clip';

  declare media: Media[];

  locations(): string[] {
    return this.iterParts()
      .map(part => part.file)
      .filter((file): file is string => typeof file === 'string' && file.length > 0);
  }

  protected override _loadData(data: any): void {
    super._loadData(data);
    this.media = (data.Media ?? []).map(
      (media: import('./video.types.ts').MediaData) =>
        new Media(this.server, media, undefined, this),
    );
  }

  protected _loadFullData(data: any): void {
    this._loadData(data.Metadata[0]);
  }
}

/**
 * Represents a single Extra (trailer, behindTheScenes, etc).
 */
export class Extra extends Clip {
  protected override _loadData(data: ExtrasData): void {
    super._loadData(data);
  }

  protected override _loadFullData(data: any): void {
    this._loadData(data.Metadata[0]);
  }
}
