import { Playable } from './base';
import { MediaItem } from './libraryInterfaces';
import { PlexServer } from './server';
import { Director, Country, Writer, Chapter, Collection } from './media';
import { FullMovieResponse, ChapterSource } from './videoInterfaces';

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
  updatedAt!: Date;
  /** Count of times this item was accessed. */
  viewCount!: number;

  constructor(public server: PlexServer, data: MediaItem, initpath: string) {
    super(server, data, initpath);
  }

  protected _loadData(data: MediaItem): void {
    this.addedAt = new Date(data.addedAt * 1000);
    this.lastViewedAt = data.lastViewedAt ? new Date(data.lastViewedAt * 1000) : undefined;
    this.key = data.key;
    this.ratingKey = data.ratingKey;
    this.viewCount = data.viewCount ?? 0;
  }
}

export type VideoType = Movie;

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

  protected _loadData(data: MediaItem): void {
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
    this.directors = data.Director.map(data => new Director(this.server, data));
    this.countries = data.Country.map(data => new Country(this.server, data));
    this.writers = data.Writer.map(data => new Writer(this.server, data));
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
