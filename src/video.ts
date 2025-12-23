import type { URL } from 'node:url';

import { Playable } from './base/playable.js';

import { fetchItem, fetchItems, findItems } from './baseFunctionality.js';
import type { ExtrasData, FullShowData, MovieData, ShowData } from './library.types.js';
import {
  Chapter,
  Collection,
  Country,
  Director,
  Genre,
  Guid,
  Marker,
  Media,
  Poster,
  Producer,
  Rating,
  Role,
  Similar,
  Writer,
} from './media.js';
import type { ChapterSource, EpisodeMetadata, FullMovieResponse } from './video.types.js';

abstract class Video extends Playable {
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
  declare art?: string;
  declare grandparentArt?: string;
  /**
   * BlurHash string for artwork image.
   */
  declare artBlurHash?: string;
  /**
   * BlurHash string for thumbnail image.
   */
  declare thumbBlurHash?: string;

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
    const thumb = this.thumb ?? (this as any).parentThumb ?? (this as any).granparentThumb;
    return this.server.url(thumb, true);
  }

  get artUrl(): URL {
    const art = this.art ?? this.grandparentArt;
    return this.server.url(art, true);
  }

  /**
   * Mark video as watched.
   */
  async markWatched(): Promise<void> {
    const key = `/:/scrobble?key=${this.ratingKey}&identifier=com.plexapp.plugins.library`;
    await this.server.query(key);
    await this.reload();
  }

  /**
   * Mark video as unwatched.
   */
  async markUnwatched(): Promise<void> {
    const key = `/:/unscrobble?key=${this.ratingKey}&identifier=com.plexapp.plugins.library`;
    await this.server.query(key);
    await this.reload();
  }

  async rate(rate: number): Promise<void> {
    const key = `/:/rate?key=${this.ratingKey}&identifier=com.plexapp.plugins.library&rating=${rate}`;
    await this.server.query(key);
    await this.reload();
  }

  async extras(): Promise<Extra[]> {
    const data = await this.server.query(this._detailsKey);
    return findItems(
      data.MediaContainer.Metadata[0].Extras?.Metadata,
      undefined,
      Extra,
      this.server,
      this,
    );
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
  async uploadPoster(url?: string, file?: Uint8Array): Promise<void> {
    if (url) {
      const key = `/library/metadata/${this.ratingKey}/posters?url=${encodeURIComponent(url)}`;
      await this.server.query(key, 'post');
    } else if (file) {
      const key = `/library/metadata/${this.ratingKey}/posters`;
      await this.server.query(key, 'post', {
        body: file,
      });
    }
  }

  protected _loadData(data: MovieData | ShowData | EpisodeMetadata): void {
    this.key = data.key;
    this.ratingKey = data.ratingKey;
    this.title = data.title;
    this.summary = data.summary;
    this.thumb = data.thumb;
    this.title = data.title;
    this.type = data.type;
    this.librarySectionID = data.librarySectionID;
    this.addedAt = new Date(data.addedAt * 1000);
    this.lastViewedAt = (data as MovieData).lastViewedAt
      ? new Date((data as MovieData).lastViewedAt * 1000)
      : undefined;
    this.updatedAt = (data as MovieData).lastViewedAt ? new Date(data.updatedAt * 1000) : undefined;
    this.viewCount = (data as MovieData).viewCount ?? 0;
    this.titleSort = (data as MovieData).titleSort ?? this.title;
    this.viewCount = (data as MovieData).viewCount;
    this.playlistItemID = (data as any).playlistItemID;
    // todo: update one of them with this property
    this.artBlurHash = (data as any).artBlurHash;
    this.thumbBlurHash = (data as any).thumbBlurHash;
  }
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
  /** Duration of movie in milliseconds. */
  declare duration: number;
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
  /** Studio that created movie (Di Bonaventura Pictures; 21 Laps Entertainment). */
  declare studio: string;
  /** Movie tag line (Back 2 Work; Who says men can't change?). */
  declare tagline?: string;
  /** User rating (2.0; 8.0). */
  declare userRating?: number;
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
  declare ratings?: Rating[];

  get actors() {
    return this.roles;
  }

  async locations(): Promise<string[]> {
    if (!this.isFullObject) {
      await this.reload();
    }

    const parts = (this.media?.map(media => media.parts) ?? []).flat();
    return parts.map(part => part.file);
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
    this.duration = data.duration;
    this.guid = data.guid;
    this.originalTitle = data.originalTitle;
    this.originallyAvailableAt = data.originallyAvailableAt;
    this.primaryExtraKey = data.primaryExtraKey;
    this.rating = data.rating;
    this.ratingImage = data.ratingImage;
    this.studio = data.studio;
    this.tagline = data.tagline;
    this.userRating = data.userRating;
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

  /** Key to banner artwork (/library/metadata/<ratingkey>/art/<artid>) */
  declare banner: string;
  /** Unknown. */
  declare childCount: number;
  /** Content rating (PG-13; NR; TV-G). */
  declare contentRating: string;
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
  declare originallyAvailableAt: Date;
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

  /** @returns True if this show is fully watched. */
  override get isWatched(): boolean {
    return this.viewedLeafCount === this.leafCount;
  }

  // async preferences(): Promise<Preferences[]> {
  //   const data = await this.server.query<MediaContainer<ShowPreferences>>(this._detailsKey as string);
  //   // return data.MediaContainer;
  //   // for (item in data.iter('Preferences')) {
  //   //   for (elem in item) {
  //   //     items.append(settings.Preferences(data = elem, server = self._server));
  //   //   }
  //   // }

  //   // return items;
  // }

  async seasons(query?: Record<string, string | number>): Promise<Season[]> {
    const key = `/library/metadata/${this.ratingKey}/children?excludeAllLeaves=1`;
    return fetchItems(this.server, key, query, Season, this);
  }

  async episodes(query?: Record<string, string | number>): Promise<Episode[]> {
    const key = `/library/metadata/${this.ratingKey}/allLeaves`;
    const episodes = await fetchItems(this.server, key, query);
    return episodes.map(episode => new Episode(this.server, episode, key, this));
  }

  protected override _loadData(data: ShowData): void {
    super._loadData(data);
    this.key = (data.key ?? '').replace('/children', '');
    this.art = data.art;
    this.banner = data.banner;
    this.childCount = data.childCount;
    this.contentRating = data.contentRating;
    // this.collections = self.findItems(data, media.Collection);
    this.duration = data.duration;
    this.guid = data.guid;
    this.index = data.index;
    this.leafCount = data.leafCount;
    this.originallyAvailableAt = new Date(data.originallyAvailableAt);
    this.rating = data.rating;
    this.studio = data.studio;
    this.theme = data.theme;
    this.viewedLeafCount = data.viewedLeafCount;
    this.year = data.year;
    this.genres = data.Genre?.map(genre => new Genre(this.server, genre)) ?? [];
    this.roles = data.Role?.map(role => new Role(this.server, role)) ?? [];
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

  /** Season number */
  declare index: number;
  /** Number of episodes in season. */
  declare leafCount: number;
  /** Key to this season */
  declare parentKey: string;
  /** Rating key of the show this season belongs to */
  declare parentRatingKey: string;
  /** Show title */
  declare parentTitle: string;
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
  async episodes(query?: Record<string, string | number>): Promise<Episode[]> {
    const key = `/library/metadata/${this.ratingKey}/children`;
    const episodes = await fetchItems<EpisodeMetadata>(this.server, key, query);
    return episodes.map(episode => new Episode(this.server, episode, key, this));
  }

  protected override _loadData(data: ShowData): void {
    super._loadData(data);
    this.key = (data.key || '').replace('/children', '');
    this.index = data.index;
    this.leafCount = data.leafCount;
    this.viewedLeafCount = data.viewedLeafCount;
  }

  protected _loadFullData(data: ShowData): void {
    this._loadData(data);
  }
}

export class Episode extends Video {
  static override TAG = 'Video';
  TYPE = 'episode';
  METADATA_TYPE = 'episode';

  /** Unknown (media). */
  declare chapterSource?: string;
  /** Content rating (PG-13; NR; TV-G). */
  declare contentRating: string;
  /**  Duration of episode in milliseconds. */
  declare duration: number;
  /** Key to this episodes :class:`~plexapi.video.Show`. */
  declare grandparentKey: string;
  /** Unique key for this episodes :class:`~plexapi.video.Show`. */
  declare grandparentRatingKey: string;
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
  declare originallyAvailableAt: Date;
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
  /** Movie rating (7.9; 9.8; 8.1). */
  declare rating: number;
  /**  View offset in milliseconds. */
  declare viewOffset?: number;
  declare writers: Writer[];
  declare directors: Director[];
  declare media: Media[];
  declare collections: Collection[];
  declare chapters: Chapter[];
  declare markers: Marker[];

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
    const data = await fetchItem(this.server, this.parentKey);
    return new Season(this.server, data, this.parentKey, this);
  }

  async show(): Promise<Show> {
    const data = await fetchItem(this.server, this.grandparentKey);
    return new Show(this.server, data, this.grandparentKey, this);
  }

  locations(): string[] {
    const parts = (this.media?.map(media => media.parts) ?? []).flat();
    return parts.map(part => part.file);
  }

  /**
   * Returns True if this episode has an intro marker
   */
  async hasIntroMarker(): Promise<boolean> {
    if (!this.isFullObject) {
      await this.reload();
    }

    return this.markers.some(marker => marker.type === 'intro');
  }

  /**
   * Returns True if this episode has a credits marker
   */
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
    this.art = data.art;
    this.chapterSource = data.chapterSource;
    this.contentRating = data.contentRating;
    this.duration = data.duration;
    this.grandparentArt = data.grandparentArt;
    this.grandparentKey = data.grandparentKey;
    this.grandparentRatingKey = data.grandparentRatingKey;
    this.grandparentTheme = data.grandparentTheme;
    this.grandparentThumb = data.grandparentThumb;
    this.grandparentTitle = data.grandparentTitle;
    this.guid = data.guid;
    this.index = data.index;
    // TODO: might need to parse date ex - '2011-04-17'
    this.originallyAvailableAt = new Date(data.originallyAvailableAt);
    this.parentIndex = data.parentIndex;
    this.parentKey = data.parentKey;
    this.parentRatingKey = data.parentRatingKey;
    this.parentThumb = data.parentThumb;
    this.parentTitle = data.parentTitle;
    this.rating = data.rating;
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

  protected override _loadData(data: any): void {
    super._loadData(data);
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
