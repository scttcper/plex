import { URL } from 'url';

import { Playable } from './base';
import { fetchItem, fetchItems, findItems } from './baseFunctionality';
import { MovieData, ShowData } from './library.types';
import { PlexServer } from './server';
import { Director, Country, Writer, Chapter, Collection, Genre, Role } from './media';
import { FullMovieResponse, ChapterSource, EpisodeMetadata } from './video.types';
import { Preferences } from './settings';
import { MediaContainer } from './util';

abstract class Video extends Playable {
  /** API URL (/library/metadata/<ratingkey>) */
  key!: string;
  ing;
  /** Datetime this item was added to the library. */
  addedAt!: Date;
  /** Datetime item was last accessed. */
  lastViewedAt?: Date;
  /** Hardcoded as 'video' (useful for search filters). */
  listType = 'video' as const;
  /** Unique key identifying this item. */
  ratingKey!: string;
  /** Summary of the artist, track, or album. */
  summary!: string;
  /** URL to thumbnail image. */
  thumb!: string;
  /** Artist, Album or Track title. (Jason Mraz, We Sing, Lucky, etc.) */
  title!: string;
  /** Title to use when sorting (defaults to title). */
  titleSort?: string;
  /** 'artist', 'album', or 'track'. */
  type!: string;
  /** Datetime this item was updated. */
  updatedAt?: Date;
  /** Count of times this item was accessed. */
  viewCount?: number;

  constructor(
    public server: PlexServer,
    data: MovieData | EpisodeMetadata,
    initpath: string,
    parent?: any,
  ) {
    super(server, data, initpath, parent);
  }

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
    return this.server.url(thumb);
  }

  /**
   * Mark video as watched.
   */
  async markWatched(): Promise<void> {
    const key = `/:/scrobble?key=${this.ratingKey}&identifier=com.plexapp.plugins.library`;
    this.server.query(key);
    this.reload();
  }

  /**
   * Mark video as unwatched.
   */
  async markUnwatched(): Promise<void> {
    const key = `/:/unscrobble?key=${this.ratingKey}&identifier=com.plexapp.plugins.library`;
    this.server.query(key);
    this.reload();
  }

  protected _loadData(data: MovieData | ShowData | EpisodeMetadata): void {
    this.addedAt = new Date(data.addedAt * 1000);
    this.lastViewedAt = (data as MovieData).lastViewedAt
      ? new Date((data as MovieData).lastViewedAt! * 1000)
      : undefined;
    this.updatedAt = (data as MovieData).lastViewedAt ? new Date(data.updatedAt * 1000) : undefined;
    this.key = data.key;
    this.ratingKey = data.ratingKey;
    this.viewCount = (data as MovieData).viewCount ?? 0;
    this.title = data.title;
    this.summary = data.summary;
    this.thumb = data.thumb;
    this.title = data.title;
    this.titleSort = (data as MovieData).titleSort ?? this.title;
    this.type = data.type;
    this.viewCount = (data as MovieData).viewCount;
  }
}

export type VideoType = Movie | Show;

/**
 * Represents a single Movie.
 */
export class Movie extends Video {
  static include =
    '?checkFiles=1&includeExtras=1&includeRelated=1&includeOnDeck=1&includeChapters=1&includePopularLeaves=1&includeConcerts=1&includePreferences=1';

  TAG = 'Video';
  TYPE = 'movie';
  METADATA_TYPE = 'movie';

  /** Key to movie artwork (/library/metadata/<ratingkey>/art/<artid>) */
  art!: string;
  librarySectionID?: number;
  /** Audience rating (usually from Rotten Tomatoes). */
  audienceRating?: number;
  /** Key to audience rating image (rottentomatoes://image.rating.spilled) */
  audienceRatingImage?: string;
  /** Chapter source (agent; media; mixed). */
  chapterSource?: ChapterSource;
  /** Content rating (PG-13; NR; TV-G). */
  contentRating!: string;
  /** Duration of movie in milliseconds. */
  duration!: number;
  /** Original title, often the foreign title (転々; 엽기적인 그녀). */
  originalTitle?: string;
  /** Datetime movie was released. */
  originallyAvailableAt!: Date;
  /** Primary extra key (/library/metadata/66351). */
  primaryExtraKey!: string;
  /** Movie rating (7.9; 9.8; 8.1). */
  rating!: number;
  /** Key to rating image (rottentomatoes://image.rating.rotten). */
  ratingImage!: string;
  /** Studio that created movie (Di Bonaventura Pictures; 21 Laps Entertainment). */
  studio!: string;
  /** Movie tag line (Back 2 Work; Who says men can't change?). */
  tagline?: string;
  /** User rating (2.0; 8.0). */
  userRating?: number;
  /** View offset in milliseconds. */
  viewOffset!: number;
  /** Year movie was released. */
  year!: number;
  /** Plex GUID (com.plexapp.agents.imdb://tt4302938?lang=en) */
  guid!: string;
  directors!: Director[];
  countries!: Country[];
  writers!: Writer[];
  chapters?: Chapter[];
  collections?: Collection[];
  // fields (List<:class:`~plexapi.media.Field`>): List of field objects.
  // genres (List<:class:`~plexapi.media.Genre`>): List of genre objects.
  // media (List<:class:`~plexapi.media.Media`>): List of media objects.
  // producers (List<:class:`~plexapi.media.Producer`>): List of producers objects.
  // roles (List<:class:`~plexapi.media.Role`>): List of role objects.
  // similar (List<:class:`~plexapi.media.Similar`>): List of Similar objects.

  protected _loadData(data: MovieData): void {
    super._loadData(data);
    this._details_key = this.key + Movie.include;
    this.art = data.art;
    this.audienceRating = data.audienceRating;
    this.audienceRatingImage = data.audienceRatingImage;
    this.chapterSource = data.chapterSource;
    this.contentRating = data.contentRating;
    this.duration = data.duration;
    this.guid = data.guid;
    this.originalTitle = data.originalTitle;
    this.originallyAvailableAt = new Date(data.originallyAvailableAt);
    this.primaryExtraKey = data.primaryExtraKey;
    this.rating = data.rating;
    this.ratingImage = data.ratingImage;
    this.studio = data.studio;
    this.tagline = data.tagline;
    this.userRating = data.userRating;
    this.viewOffset = data.viewOffset ?? 0;
    this.year = data.year;
    this.librarySectionID = data.librarySectionID;
    this.directors =
      data.Director?.map(data => new Director(this.server, data, undefined, this)) ?? [];
    this.countries =
      data.Country?.map(data => new Country(this.server, data, undefined, this)) ?? [];
    this.writers = data.Writer?.map(data => new Writer(this.server, data, undefined, this)) ?? [];
  }

  protected _loadFullData(data: FullMovieResponse): void {
    const metadata = data.Metadata[0];
    this._loadData(metadata);
    this.key = this._details_key as string;
    this.librarySectionID = metadata.librarySectionID;
    this.chapters = metadata.Chapter?.map(chapter => new Chapter(this.server, chapter));
    this.collections = metadata.Collection?.map(
      collection => new Collection(this.server, collection, undefined, this),
    );
    // this.cha
  }
}

/**
 * Represents a single Show (including all seasons and episodes).
 */
export class Show extends Video {
  static include =
    '?checkFiles=1&includeExtras=1&includeRelated=1&includeOnDeck=1&includeChapters=1&includePopularLeaves=1&includeMarkers=1&includeConcerts=1&includePreferences=1';

  TAG = 'Directory';
  TYPE = 'show';
  METADATA_TYPE = 'episode';

  /** Key to show artwork (/library/metadata/<ratingkey>/art/<artid>) */
  art!: string;
  /** Key to banner artwork (/library/metadata/<ratingkey>/art/<artid>) */
  banner!: string;
  /** Unknown. */
  childCount!: number;
  /** Content rating (PG-13; NR; TV-G). */
  contentRating!: string;
  /** <:class:`~plexapi.media.Collection`>): List of collections this media belongs. */
  // collections: List;
  /** Duration of show in milliseconds. */
  duration!: number;
  /** Plex GUID (com.plexapp.agents.imdb://tt4302938?lang=en). */
  guid!: string;
  /** Plex index (?) */
  index!: number;
  /** Unknown. */
  leafCount!: number;
  /** List of locations paths. */
  locations?: string[];
  /** Datetime show was released. */
  originallyAvailableAt!: Date;
  /** Show rating (7.9; 9.8; 8.1). */
  rating!: number;
  /** Studio that created show (Di Bonaventura Pictures; 21 Laps Entertainment). */
  studio!: string;
  /** Key to theme resource (/library/metadata/<ratingkey>/theme/<themeid>) */
  theme!: string;
  /** Unknown. */
  viewedLeafCount!: number;
  /** Year the show was released. */
  year!: number;
  /** List of genre objects. */
  genres!: Genre[];
  /** List of role objects. */
  roles!: Role[];
  /** <:class:`~plexapi.media.Similar`>): List of Similar objects. */
  // similar: List;

  /**
   * Alias of {@link Show.roles}
   */
  get actors(): Role[] {
    return this.roles;
  }

  /** @returns True if this show is fully watched. */
  get isWatched(): boolean {
    return this.viewedLeafCount === this.leafCount;
  }

  // async preferences(): Promise<Preferences[]> {
  //   const data = await this.server.query<MediaContainer<ShowPreferences>>(this._details_key as string);
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

  protected _loadData(data: ShowData): void {
    super._loadData(data);
    this._details_key = this.key + Show.include;
    this.key = this.key.replace('/children', '');
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

  protected _loadFullData(data: ShowData): void {
    this._loadData(data);
    this.key = this._details_key as string;
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
  index!: number;
  /** Number of episodes in season. */
  leafCount!: number;
  /** Key to this season */
  parentKey!: string;
  /** Rating key of the show this season belongs to */
  parentRatingKey!: string;
  /** Show title */
  parentTitle!: string;
  /** Number of watched episodes in season */
  viewedLeafCount!: number;

  /** Returns season number */
  get seasonNumber(): number {
    return this.index;
  }

  /** Returns season number */
  get isWatched(): boolean {
    return this.viewedLeafCount === this.leafCount;
  }

  /**
   * @returns a list of :class:`~plexapi.video.Episode` objects.
   */
  async episodes(query?: Record<string, string | number>) {
    const key = `/library/metadata/${this.ratingKey}/children`;
    const episodes = await fetchItems<EpisodeMetadata>(this.server, key, query);
    return episodes.map(episode => new Episode(this.server, episode, key, this));
  }

  protected _loadData(data: ShowData): void {
    super._loadData(data);
    this._details_key = this.key + Show.include;
    this.key = this.key.replace('/children', '');
    this.index = data.index;
    this.leafCount = data.leafCount;
    this.viewedLeafCount = data.viewedLeafCount;
  }

  protected _loadFullData(data: ShowData): void {
    this._loadData(data);
    this.key = this._details_key as string;
  }
}

class Episode extends Video {
  static include =
    '?checkFiles=1&includeExtras=1&includeRelated=1&includeOnDeck=1&includeChapters=1&includePopularLeaves=1&includeMarkers=1&includeConcerts=1&includePreferences=1';

  static TAG = 'Video';
  TYPE = 'episode';
  METADATA_TYPE = 'episode';

  /**
   * Name of this Episode
   */
  title!: string;
  /** Key to episode artwork (/library/metadata/<ratingkey>/art/<artid>) */
  art!: string;
  /** Unknown (media). */
  chapterSource?: string;
  /** Content rating (PG-13; NR; TV-G). */
  contentRating!: string;
  /**  Duration of episode in milliseconds. */
  duration!: number;
  /** Key to this episodes :class:`~plexapi.video.Show` artwork. */
  grandparentArt!: string;
  /** Key to this episodes :class:`~plexapi.video.Show`. */
  grandparentKey!: string;
  /** Unique key for this episodes :class:`~plexapi.video.Show`. */
  grandparentRatingKey!: string;
  /** Key to this episodes :class:`~plexapi.video.Show` theme. */
  grandparentTheme!: string;
  /** Key to this episodes :class:`~plexapi.video.Show` thumb. */
  grandparentThumb!: string;
  /** Title of this episodes :class:`~plexapi.video.Show`. */
  grandparentTitle!: string;
  /** Plex GUID (com.plexapp.agents.imdb://tt4302938?lang=en). */
  guid!: string;
  /**  Episode number. */
  index!: number;
  /**  Datetime episode was released. */
  originallyAvailableAt!: Date;
  /** Season number of episode. */
  parentIndex!: number;
  /** Key to this episodes :class:`~plexapi.video.Season`. */
  parentKey!: string;
  /**  Unique key for this episodes :class:`~plexapi.video.Season`. */
  parentRatingKey!: string;
  /** Key to this episodes thumbnail. */
  parentThumb!: string;
  /** Name of this episode's season */
  parentTitle!: string;
  /** Movie rating (7.9; 9.8; 8.1). */
  rating!: number;
  /**  View offset in milliseconds. */
  viewOffset!: number;
  /**  Year episode was released. */
  year!: number;
  writers!: Writer[];
  // directors: (List<:class:`~plexapi.media.Director`>): List of director objects.
  // media: (List<:class:`~plexapi.media.Media`>): List of media objects.

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

  // /**
  //  * Returns True if this episode has an intro marker
  //  */
  // async hasIntroMarker(): Promise<any> {
  //   if (!this.isFullObject) {
  //     await this.reload();
  //   }
  //   // return any(marker.type == 'intro' for marker in self.markers)
  // }

  protected _loadData(data: EpisodeMetadata): void {
    super._loadData(data);
    this._details_key = this.key + Episode.include;
    this.key = this.key.replace('/children', '');
    this.title = data.title;
    // this._seasonNumber = null; // cached season number
    this.art = data.art;
    // this.chapterSource = data.chapterSource;
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
    // this.viewOffset = data.viewOffset;
    this.year = data.year;
    // this.directors = data.di
    this.writers = data.Writer?.map(writer => new Writer(this.server, writer)) ?? [];
    // this.media = self.findItems(data, media.Media);
    // this.labels = self.findItems(data, media.Label);
    // this.collections = self.findItems(data, media.Collection);
    // this.chapters = self.findItems(data, media.Chapter);
    // this.markers = self.findItems(data, media.Marker);
  }

  protected _loadFullData(data: EpisodeMetadata): void {
    this._loadData(data);
    this.key = this._details_key as string;
  }
}
