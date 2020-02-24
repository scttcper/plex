import { Playable } from './base';

abstract class Video extends Playable {

}

/**
 * Represents a single Movie.
 */
export class Movie extends Video {
  TAG = 'Video';
  TYPE = 'movie';
  METADATA_TYPE = 'movie';
  /** API URL (/library/metadata/<ratingkey>) */
  key!: string;
  /**  Datetime this item was added to the library. */
  addedAt!: Date;
  /**  Datetime item was last accessed. */
  lastViewedAt!: Date;
  /**  :class:`~plexapi.library.LibrarySection` ID. */
  librarySectionID!: number;
  /**  Hardcoded as 'audio' (useful for search filters). */
  listType!: string;
  /**  Unique key identifying this item. */
  ratingKey!: number;
  /**  Summary of the artist, track, or album. */
  summary!: string;
  /**  URL to thumbnail image. */
  thumb!: string;
  /**  Artist, Album or Track title. (Jason Mraz, We Sing, Lucky, etc.) */
  title!: string;
  /**  Title to use when sorting (defaults to title). */
  titleSort!: string;
  /**  'artist', 'album', or 'track'. */
  type!: string;
  /**  Datetime this item was updated. */
  updatedAt!: Date;
  /**  Count of times this item was accessed. */
  viewCount!: number;

  private _loadData() {

  }
}
