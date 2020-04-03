import { PlexObject } from './base';

/**
 * Base class for media tags used for filtering and searching your library
 * items or navigating the metadata of media items in your library. Tags are
 * the construct used for things such as Country, Director, Genre, etc.
 */
abstract class MediaTag extends PlexObject {
  static TAG: string;
  /** Tag ID (This seems meaningless except to use it as a unique id). */
  id?: string;
  /** unknown */
  role?: string;
  /**
   * Name of the tag. This will be Animation, SciFi etc for Genres.
   * The name of person for Directors and Roles (ex: Animation, Stephen Graham, etc).
   */
  tag!: string;
  abstract FILTER: string;

  // async items(): Promise<any[]> {
  //   if (!this.key) {
  //     throw new Error(`Key is not defined for this tag: ${this.tag}`);
  //   }

  //   return fetchItems(this.server, this.key);
  // }

  protected _loadData(data: any): void {
    this.key = data.key;
    this.id = data.id;
    this.role = data.role;
    this.tag = data.tag;
  }
}

/**
 * Represents a single Role (actor/actress) media tag.
 */
export class Role extends MediaTag {
  static TAG = 'Role' as const;
  FILTER = 'role' as const;
}

/**
 * Represents a single Genre media tag.
 */
export class Genre extends MediaTag {
  static TAG = 'Genre' as const;
  FILTER = 'genre' as const;
}

/**
 * Represents a single Country media tag.
 */
export class Country extends MediaTag {
  static TAG = 'Country' as const;
  FILTER = 'country' as const;
}

/**
 * Represents a single Writer media tag.
 */
export class Writer extends MediaTag {
  static TAG = 'Writer' as const;
  FILTER = 'writer' as const;
}

/**
 * Represents a single Director media tag.
 */
export class Director extends MediaTag {
  static TAG = 'Director' as const;
  FILTER = 'director' as const;
}

/**
 * Represents a single Chapter media tag.
 */
export class Chapter extends MediaTag {
  static TAG = 'Chapter' as const;
  FILTER = 'chapter' as const;
}

/**
 * Represents a single Collection media tag.
 */
export class Collection extends MediaTag {
  static TAG = 'Collection' as const;
  FILTER = 'collection' as const;
}

export class Optimized extends PlexObject {
  static TAG = 'Item';
  id!: string;
  composite!: any;
  title!: any;
  type!: any;
  target!: any;
  targetTagID!: any;

  protected _loadData(data: any) {
    this.id = data.id;
    this.composite = data.composite;
    this.title = data.title;
    this.type = data.type;
    this.target = data.target;
    this.targetTagID = data.targetTagID;
  }
}
