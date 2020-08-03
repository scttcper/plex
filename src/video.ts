import { Playable } from './base';
import { MovieData, ShowData } from './libraryInterfaces';
import { PlexServer } from './server';
import { Director, Country, Writer, Chapter, Collection } from './media';
import { FullMovieResponse, ChapterSource, FullShowResponse } from './videoInterfaces';

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

  constructor(public server: PlexServer, data: MovieData, initpath: string) {
    super(server, data, initpath);
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

  protected _loadData(data: MovieData | ShowData): void {
    this.addedAt = new Date(data.addedAt * 1000);
    this.lastViewedAt = (data as MovieData).lastViewedAt ? new Date((data as MovieData).lastViewedAt! * 1000) : undefined;
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
  static include = '?checkFiles=1&includeExtras=1&includeRelated=1&includeOnDeck=1&includeChapters=1&includePopularLeaves=1&includeConcerts=1&includePreferences=1';
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
    this.directors = data.Director?.map(data => new Director(this.server, data)) ?? [];
    this.countries = data.Country?.map(data => new Country(this.server, data)) ?? [];
    this.writers = data.Writer?.map(data => new Writer(this.server, data)) ?? [];
  }

  protected _loadFullData(data: FullMovieResponse): void {
    const metadata = data.Metadata[0];
    this._loadData(metadata);
    this.librarySectionID = metadata.librarySectionID;
    this.chapters = metadata.Chapter?.map(chapter => new Chapter(this.server, chapter));
    this.collections = metadata.Collection?.map(collection => new Collection(this.server, collection));
    // this.cha
  }
}

/**
 * Represents a single Show (including all seasons and episodes).
 */
export class Show extends Video {
  static include = '?checkFiles=1&includeExtras=1&includeRelated=1&includeOnDeck=1&includeChapters=1&includePopularLeaves=1&includeMarkers=1&includeConcerts=1&includePreferences=1';
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
  /** ): Datetime show was released. */
  originallyAvailableAt!: Date;
  /** ): Show rating (7.9; 9.8; 8.1). */
  rating!: number;
  /** ): Studio that created show (Di Bonaventura Pictures; 21 Laps Entertainment). */
  studio!: string;
  /** ): Key to theme resource (/library/metadata/<ratingkey>/theme/<themeid>) */
  theme!: string;
  /** ): Unknown. */
  viewedLeafCount!: number;
  /** ): Year the show was released. */
  year!: number;
  /** <:class:`~plexapi.media.Genre`>): List of genre objects. */
  // genres: List;
  /** <:class:`~plexapi.media.Role`>): List of role objects. */
  // roles: List;
  /** <:class:`~plexapi.media.Similar`>): List of Similar objects. */
  // similar: List;

  /** Returns season number */
  get seasonNumber(): number {
    return this.index;
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
  }

  protected _loadFullData(data: FullShowResponse): void {
    console.log(JSON.stringify(data));
    // this.locations = data.Directory.map();self.listAttrs(data, 'path', etag = 'Location');
    // const metadata = data.Metadata[0];
    // this._loadData(data);
    // this.librarySectionID = metadata.librarySectionID;
    // this.chapters = metadata.Chapter?.map(chapter => new Chapter(this.server, chapter));
    // this.collections = metadata.Collection?.map(collection => new Collection(this.server, collection));
  }
}
