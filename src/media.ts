import { PlexObject } from './base';
import { fetchItems } from './baseFunctionality';

/**
 * Base class for media tags used for filtering and searching your library
 * items or navigating the metadata of media items in your library. Tags are
 * the construct used for things such as Country, Director, Genre, etc.
 */
abstract class MediaTag extends PlexObject {
  /** Tag ID (This seems meaningless except to use it as a unique id). */
  id?: string;
  /** unknown */
  role?: string;
  /**
   * Name of the tag. This will be Animation, SciFi etc for Genres.
   * The name of person for Directors and Roles (ex: Animation, Stephen Graham, etc).
   */
  tag!: string;
  abstract TAG: string;
  abstract FILTER: string;

  async items(): Promise<any[]> {
    if (!this.key) {
      throw new Error(`Key is not defined for this tag: ${this.tag}`);
    }

    return fetchItems(this.server, this.key);
  }

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
  TAG = 'Role' as const;
  FILTER = 'role' as const;
}

/**
 * Represents a single Genre media tag.
 */
export class Genre extends MediaTag {
  TAG = 'Genre' as const;
  FILTER = 'genre' as const;
}

/**
 * Represents a single Country media tag.
 */
export class Country extends MediaTag {
  TAG = 'Country' as const;
  FILTER = 'country' as const;
}

/**
 * Represents a single Writer media tag.
 */
export class Writer extends MediaTag {
  TAG = 'Writer' as const;
  FILTER = 'writer' as const;
}

/**
 * Represents a single Director media tag.
 */
export class Director extends MediaTag {
  TAG = 'Director' as const;
  FILTER = 'director' as const;
}

/**
 * Represents a single Chapter media tag.
 */
export class Chapter extends MediaTag {
  TAG = 'Chapter' as const;
  FILTER = 'chapter' as const;
}

/**
 * Represents a single Collection media tag.
 */
export class Collection extends MediaTag {
  TAG = 'Collection' as const;
  FILTER = 'collection' as const;
}
