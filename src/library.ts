import { URLSearchParams } from 'node:url';

import type { Class } from 'type-fest';

import { Album, Artist, Track } from './audio.js';
import { PartialPlexObject } from './base/partialPlexObject.js';
import { PlexObject } from './base/plexObject.js';
import { buildQueryKey, fetchItem, fetchItems } from './baseFunctionality.js';
import { BadRequest, NotFound, Unsupported } from './exceptions.js';
import type {
  CommonData,
  CollectionData,
  FirstCharacterData,
  FilterChoiceData,
  FilteringFieldData,
  FilteringFieldTypeData,
  FilteringFilterData,
  FilteringOperatorData,
  FilteringSortData,
  FilteringTypeData,
  FolderData,
  LibraryFilterMetaData,
  LibraryRootResponse,
  LibraryTimelineData,
  Location,
  ManagedHubData,
  MediaProvidersResponse,
  SectionsDirectory,
  SectionsResponse,
} from './library.types.js';
import {
  Collection,
  Country,
  Director,
  Field,
  Genre,
  Guid,
  Label,
  Mood,
  Producer,
  Rating,
  Role,
  Style,
  Tag,
  Writer,
} from './media.js';
import { Playlist } from './playlist.js';
import { type Agent, searchType, SEARCHTYPES } from './search.js';
import type { SearchResultContainer } from './search.types.js';
import type { PlexServer } from './server.js';
import type { MediaContainer } from './util.js';
import { Episode, Movie, Season, Show } from './video.js';

export type Section = MovieSection | ShowSection | MusicSection;

export class Library {
  static key = '/library';
  /** Unknown ('com.plexapp.plugins.library') */
  declare identifier: string;
  /** Unknown (/system/bundle/media/flags/) */
  declare mediaTagPrefix: string;
  /** 'Plex Library' (not sure how useful this is) */
  declare title1: string;
  /** Second title (this is blank on my setup) */
  declare title2: string;

  constructor(
    private readonly server: PlexServer,
    data: LibraryRootResponse,
  ) {
    this._loadData(data);
  }

  /**
   * @returns a list of all media sections in this library. Library sections may be any of
   */
  async sections(): Promise<Section[]> {
    const key = '/library/sections';
    const elems = await this.server.query<MediaContainer<SectionsResponse>>({ path: key });
    const sections: Section[] = [];
    if (!elems.MediaContainer.Directory) {
      return sections;
    }

    for (const elem of elems.MediaContainer.Directory) {
      for (const cls of [MovieSection, ShowSection, MusicSection]) {
        if (cls.TYPE === elem.type) {
          const instance = new cls(this.server, elem, key);
          sections.push(instance);
        }
      }
    }

    return sections;
  }

  async section<T extends Section = Section>(title: string): Promise<T> {
    const sections = await this.sections();
    const section = sections.find(s => s.title?.toLowerCase() === title.toLowerCase()) as
      | T
      | undefined;
    if (!section) {
      const avilableSections = sections.map(s => s.title || 'Unknown').join(', ');
      throw new Error(`Invalid library section: ${title}. Available: ${avilableSections}`);
    }

    return section;
  }

  async sectionByID<T extends Section = Section>(sectionId: string | number): Promise<T> {
    const sectionIdStr = sectionId.toString();
    const sections = await this.sections();
    const section = sections.find(s => s.key === sectionIdStr);
    if (!section) {
      throw new Error(`Invalid library section id: ${sectionId}`);
    }

    return section as T;
  }

  /**
   * Simplified add for the most common options.
   *
   * Parameters:
   *     name (str): Name of the library
   *     agent (str): Example com.plexapp.agents.imdb
   *     type (str): movie, show, # check me
   *     location (str): /path/to/files
   *     language (str): Two letter language fx en
   *     kwargs (dict): Advanced options should be passed as a dict. where the id is the key.
   *
   * **Photo Preferences**
   *
   *     * **agent** (str): com.plexapp.agents.none
   *     * **enableAutoPhotoTags** (bool): Tag photos. Default value false.
   *     * **enableBIFGeneration** (bool): Enable video preview thumbnails. Default value true.
   *     * **includeInGlobal** (bool): Include in dashboard. Default value true.
   *     * **scanner** (str): Plex Photo Scanner
   *
   * **Movie Preferences**
   *
   *     * **agent** (str): com.plexapp.agents.none, com.plexapp.agents.imdb, com.plexapp.agents.themoviedb
   *     * **enableBIFGeneration** (bool): Enable video preview thumbnails. Default value true.
   *     * **enableCinemaTrailers** (bool): Enable Cinema Trailers. Default value true.
   *     * **includeInGlobal** (bool): Include in dashboard. Default value true.
   *     * **scanner** (str): Plex Movie Scanner, Plex Video Files Scanner
   *
   * **IMDB Movie Options** (com.plexapp.agents.imdb)
   *
   *     * **title** (bool): Localized titles. Default value false.
   *     * **extras** (bool): Find trailers and extras automatically (Plex Pass required). Default value true.
   *     * **only_trailers** (bool): Skip extras which aren't trailers. Default value false.
   *     * **redband** (bool): Use red band (restricted audiences) trailers when available. Default value false.
   *     * **native_subs** (bool): Include extras with subtitles in Library language. Default value false.
   *     * **cast_list** (int): Cast List Source: Default value 1 Possible options: 0:IMDb,1:The Movie Database.
   *     * **ratings** (int): Ratings Source, Default value 0 Possible options:
   *       0:Rotten Tomatoes, 1:IMDb, 2:The Movie Database.
   *     * **summary** (int): Plot Summary Source: Default value 1 Possible options: 0:IMDb,1:The Movie Database.
   *     * **country** (int): Default value 46 Possible options 0:Argentina, 1:Australia, 2:Austria,
   *       3:Belgium, 4:Belize, 5:Bolivia, 6:Brazil, 7:Canada, 8:Chile, 9:Colombia, 10:Costa Rica,
   *       11:Czech Republic, 12:Denmark, 13:Dominican Republic, 14:Ecuador, 15:El Salvador,
   *       16:France, 17:Germany, 18:Guatemala, 19:Honduras, 20:Hong Kong SAR, 21:Ireland,
   *       22:Italy, 23:Jamaica, 24:Korea, 25:Liechtenstein, 26:Luxembourg, 27:Mexico, 28:Netherlands,
   *       29:New Zealand, 30:Nicaragua, 31:Panama, 32:Paraguay, 33:Peru, 34:Portugal,
   *       35:Peoples Republic of China, 36:Puerto Rico, 37:Russia, 38:Singapore, 39:South Africa,
   *       40:Spain, 41:Sweden, 42:Switzerland, 43:Taiwan, 44:Trinidad, 45:United Kingdom,
   *       46:United States, 47:Uruguay, 48:Venezuela.
   *     * **collections** (bool): Use collection info from The Movie Database. Default value false.
   *     * **localart** (bool): Prefer artwork based on library language. Default value true.
   *     * **adult** (bool): Include adult content. Default value false.
   *     * **usage** (bool): Send anonymous usage data to Plex. Default value true.
   *
   * **TheMovieDB Movie Options** (com.plexapp.agents.themoviedb)
   *
   *     * **collections** (bool): Use collection info from The Movie Database. Default value false.
   *     * **localart** (bool): Prefer artwork based on library language. Default value true.
   *     * **adult** (bool): Include adult content. Default value false.
   *     * **country** (int): Country (used for release date and content rating). Default value 47 Possible
   *       options 0:, 1:Argentina, 2:Australia, 3:Austria, 4:Belgium, 5:Belize, 6:Bolivia, 7:Brazil, 8:Canada,
   *       9:Chile, 10:Colombia, 11:Costa Rica, 12:Czech Republic, 13:Denmark, 14:Dominican Republic, 15:Ecuador,
   *       16:El Salvador, 17:France, 18:Germany, 19:Guatemala, 20:Honduras, 21:Hong Kong SAR, 22:Ireland,
   *       23:Italy, 24:Jamaica, 25:Korea, 26:Liechtenstein, 27:Luxembourg, 28:Mexico, 29:Netherlands,
   *       30:New Zealand, 31:Nicaragua, 32:Panama, 33:Paraguay, 34:Peru, 35:Portugal,
   *       36:Peoples Republic of China, 37:Puerto Rico, 38:Russia, 39:Singapore, 40:South Africa, 41:Spain,
   *       42:Sweden, 43:Switzerland, 44:Taiwan, 45:Trinidad, 46:United Kingdom, 47:United States, 48:Uruguay,
   *       49:Venezuela.
   *
   * **Show Preferences**
   *
   *     * **agent** (str): com.plexapp.agents.none, com.plexapp.agents.thetvdb, com.plexapp.agents.themoviedb
   *     * **enableBIFGeneration** (bool): Enable video preview thumbnails. Default value true.
   *     * **episodeSort** (int): Episode order. Default -1 Possible options: 0:Oldest first, 1:Newest first.
   *     * **flattenSeasons** (int): Seasons. Default value 0 Possible options: 0:Show,1:Hide.
   *     * **includeInGlobal** (bool): Include in dashboard. Default value true.
   *     * **scanner** (str): Plex Series Scanner
   *
   * **TheTVDB Show Options** (com.plexapp.agents.thetvdb)
   *
   *     * **extras** (bool): Find trailers and extras automatically (Plex Pass required). Default value true.
   *     * **native_subs** (bool): Include extras with subtitles in Library language. Default value false.
   *
   * **TheMovieDB Show Options** (com.plexapp.agents.themoviedb)
   *
   *     * **collections** (bool): Use collection info from The Movie Database. Default value false.
   *     * **localart** (bool): Prefer artwork based on library language. Default value true.
   *     * **adult** (bool): Include adult content. Default value false.
   *     * **country** (int): Country (used for release date and content rating). Default value 47 options
   *       0:, 1:Argentina, 2:Australia, 3:Austria, 4:Belgium, 5:Belize, 6:Bolivia, 7:Brazil, 8:Canada, 9:Chile,
   *       10:Colombia, 11:Costa Rica, 12:Czech Republic, 13:Denmark, 14:Dominican Republic, 15:Ecuador,
   *       16:El Salvador, 17:France, 18:Germany, 19:Guatemala, 20:Honduras, 21:Hong Kong SAR, 22:Ireland,
   *       23:Italy, 24:Jamaica, 25:Korea, 26:Liechtenstein, 27:Luxembourg, 28:Mexico, 29:Netherlands,
   *       30:New Zealand, 31:Nicaragua, 32:Panama, 33:Paraguay, 34:Peru, 35:Portugal,
   *       36:Peoples Republic of China, 37:Puerto Rico, 38:Russia, 39:Singapore, 40:South Africa,
   *       41:Spain, 42:Sweden, 43:Switzerland, 44:Taiwan, 45:Trinidad, 46:United Kingdom, 47:United States,
   *       48:Uruguay, 49:Venezuela.
   *
   * **Other Video Preferences**
   *
   *     * **agent** (str): com.plexapp.agents.none, com.plexapp.agents.imdb, com.plexapp.agents.themoviedb
   *     * **enableBIFGeneration** (bool): Enable video preview thumbnails. Default value true.
   *     * **enableCinemaTrailers** (bool): Enable Cinema Trailers. Default value true.
   *     * **includeInGlobal** (bool): Include in dashboard. Default value true.
   *     * **scanner** (str): Plex Movie Scanner, Plex Video Files Scanner
   *
   * **IMDB Other Video Options** (com.plexapp.agents.imdb)
   *
   *     * **title** (bool): Localized titles. Default value false.
   *     * **extras** (bool): Find trailers and extras automatically (Plex Pass required). Default value true.
   *     * **only_trailers** (bool): Skip extras which aren't trailers. Default value false.
   *     * **redband** (bool): Use red band (restricted audiences) trailers when available. Default value false.
   *     * **native_subs** (bool): Include extras with subtitles in Library language. Default value false.
   *     * **cast_list** (int): Cast List Source: Default value 1 Possible options: 0:IMDb,1:The Movie Database.
   *     * **ratings** (int): Ratings Source Default value 0 Possible options:
   *       0:Rotten Tomatoes,1:IMDb,2:The Movie Database.
   *     * **summary** (int): Plot Summary Source: Default value 1 Possible options: 0:IMDb,1:The Movie Database.
   *     * **country** (int): Country: Default value 46 Possible options: 0:Argentina, 1:Australia, 2:Austria,
   *       3:Belgium, 4:Belize, 5:Bolivia, 6:Brazil, 7:Canada, 8:Chile, 9:Colombia, 10:Costa Rica,
   *       11:Czech Republic, 12:Denmark, 13:Dominican Republic, 14:Ecuador, 15:El Salvador, 16:France,
   *       17:Germany, 18:Guatemala, 19:Honduras, 20:Hong Kong SAR, 21:Ireland, 22:Italy, 23:Jamaica,
   *       24:Korea, 25:Liechtenstein, 26:Luxembourg, 27:Mexico, 28:Netherlands, 29:New Zealand, 30:Nicaragua,
   *       31:Panama, 32:Paraguay, 33:Peru, 34:Portugal, 35:Peoples Republic of China, 36:Puerto Rico,
   *       37:Russia, 38:Singapore, 39:South Africa, 40:Spain, 41:Sweden, 42:Switzerland, 43:Taiwan, 44:Trinidad,
   *       45:United Kingdom, 46:United States, 47:Uruguay, 48:Venezuela.
   *     * **collections** (bool): Use collection info from The Movie Database. Default value false.
   *     * **localart** (bool): Prefer artwork based on library language. Default value true.
   *     * **adult** (bool): Include adult content. Default value false.
   *     * **usage** (bool): Send anonymous usage data to Plex. Default value true.
   *
   * **TheMovieDB Other Video Options** (com.plexapp.agents.themoviedb)
   *
   *     * **collections** (bool): Use collection info from The Movie Database. Default value false.
   *     * **localart** (bool): Prefer artwork based on library language. Default value true.
   *     * **adult** (bool): Include adult content. Default value false.
   *     * **country** (int): Country (used for release date and content rating). Default
   *       value 47 Possible options 0:, 1:Argentina, 2:Australia, 3:Austria, 4:Belgium, 5:Belize,
   *       6:Bolivia, 7:Brazil, 8:Canada, 9:Chile, 10:Colombia, 11:Costa Rica, 12:Czech Republic,
   *       13:Denmark, 14:Dominican Republic, 15:Ecuador, 16:El Salvador, 17:France, 18:Germany,
   *       19:Guatemala, 20:Honduras, 21:Hong Kong SAR, 22:Ireland, 23:Italy, 24:Jamaica,
   *       25:Korea, 26:Liechtenstein, 27:Luxembourg, 28:Mexico, 29:Netherlands, 30:New Zealand,
   *       31:Nicaragua, 32:Panama, 33:Paraguay, 34:Peru, 35:Portugal,
   *       36:Peoples Republic of China, 37:Puerto Rico, 38:Russia, 39:Singapore,
   *       40:South Africa, 41:Spain, 42:Sweden, 43:Switzerland, 44:Taiwan, 45:Trinidad,
   *       46:United Kingdom, 47:United States, 48:Uruguay, 49:Venezuela.
   */
  async add(
    name: string,
    type: string,
    agent: string,
    scanner: string,
    location: string,
    language = 'en',
    extra: Record<string, string> = {},
  ) {
    const search = new URLSearchParams({
      name,
      type,
      agent,
      scanner,
      location,
      language,
      ...extra,
    });
    const url = `/library/sections?${search.toString()}`;
    return this.server.query({ path: url, method: 'post' });
  }

  /**
   * Returns a list of all on-deck items from all library sections.
   * On-deck items are media that is currently in progress.
   */
  async onDeck(): Promise<any[]> {
    const key = buildQueryKey('/library/onDeck');
    return fetchItems(this.server, key);
  }

  /**
   * Returns a list of all media from all library sections.
   * This may be a very large dataset to retrieve.
   */
  async all() {
    const results: any[] = [];
    const sections = await this.sections();
    for (const section of sections) {
      const items = await section.all();
      for (const item of items) {
        results.push(item);
      }
    }

    return results;
  }

  /**
   * If a library has items in the Library Trash, use this option to empty the Trash.
   */
  async emptyTrash() {
    const sections = await this.sections();
    for (const section of sections) {
      await section.emptyTrash();
    }
  }

  /**
   * The Optimize option cleans up the server database from unused or fragmented data.
   * For example, if you have deleted or added an entire library or many items in a
   * library, you may like to optimize the database.
   */
  async optimize() {
    await this.server.query({ path: '/library/optimize?async=1', method: 'put' });
  }

  /**
   * Validates a filter field and values are available as a custom filter for the library.
   * Returns the validated field and values as a URL encoded parameter string.
   */
  // _validateFilterField(field: string): string {
  //   const match = /(?:([a-zA-Z]*)\.)?([a-zA-Z]+)([!<>=&]*)/.test(field);
  //   if (!match) {
  //     throw new Error('Invalid filter field: ' + field);
  //   }
  // }

  /**
   * Returns the validated and formatted search query API key
   * (``/library/sections/<sectionKey>/all?<params>``).
   */
  // _buildSearchKey(kwargs: Record<string, string>) {
  //   const args: Record<string, string> = {};
  //   const filterArgs = [];
  //   for (const [field, values] of Object.entries(kwargs)) {
  //     if (!(field.split('__')[-1] in OPERATORS)) {
  //       filterArgs.push(this._validateFilterField(field, values, libtype));
  //       delete kwargs[field];
  //     }
  //   }
  // }

  protected _loadData(data: LibraryRootResponse): void {
    this.identifier = data.identifier;
    this.mediaTagPrefix = data.mediaTagPrefix;
    this.title1 = data.title1;
    this.title2 = data.title2;
  }
}

export type Libtype = keyof typeof SEARCHTYPES;

export interface SearchArgs {
  [key: string]:
    | number
    | string
    | boolean
    | string[]
    | FilteringSort
    | Record<string, string | number | boolean>;
  /** General string query to search for. Partial string matches are allowed. */
  title: string;
  /** A string of comma separated sort fields or a list of sort fields in the format ``column:dir``. */
  sort: string | string[] | FilteringSort;
  /** Only return the specified number of results. */
  maxresults: number;
  /** Default 0 */
  container_start: number;
  /** Default 100 (X_PLEX_CONTAINER_SIZE) */
  container_size: number;
  /** Limit the number of results from the filter. */
  limit: number;
  /**
   * Return results of a specific type (movie, show, season, episode,
   * artist, album, track, photoalbum, photo, collection) (e.g. ``libtype='movie'`` will only
   * return {@link Movie} objects)
   */
  libtype: Libtype;
  /**
   * Return only results that have duplicates.
   */
  duplicate: number;
  /** Advanced filters object used by music searches. */
  filters?: Record<string, string | number | boolean>;
}

export type SectionType = Movie | Show | Artist | Album | Track;
export type LibrarySearchItem = SectionType | Season | Episode | Collections;
type RatingKeyItem = { ratingKey?: number | string };
export type EditableLibraryItem = LibrarySearchItem & {
  librarySectionID?: number | string;
  ratingKey?: number | string;
  title?: string;
  type?: string;
};
export type SearchClassForLibtype<T extends Libtype> = T extends 'movie'
  ? Movie
  : T extends 'show'
    ? Show
    : T extends 'season'
      ? Season
      : T extends 'episode'
        ? Episode
        : T extends 'artist'
          ? Artist
          : T extends 'album'
            ? Album
            : T extends 'track'
              ? Track
              : SectionType;

function parsePlexBoolean(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }

  return value === true || value === 1 || value === '1' || value === 'true';
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return Number(value);
}

function asArray<T>(value?: T | T[]): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function reverseSearchType(type: string | number | null): Libtype | undefined {
  const entry = Object.entries(SEARCHTYPES).find(([, value]) => value.toString() === `${type}`);
  return entry?.[0] as Libtype | undefined;
}

function classForLibtype(libtype?: Libtype): Class<LibrarySearchItem> | undefined {
  switch (libtype) {
    case 'movie': {
      return Movie;
    }

    case 'show': {
      return Show;
    }

    case 'season': {
      return Season;
    }

    case 'episode': {
      return Episode;
    }

    case 'artist': {
      return Artist;
    }

    case 'album': {
      return Album;
    }

    case 'track': {
      return Track;
    }

    case 'collection': {
      return Collections;
    }

    default: {
      return undefined;
    }
  }
}

/**
 * Base class for a single library section.
 */
export abstract class LibrarySection<SType = SectionType> extends PlexObject {
  static ALLOWED_FILTERS: string[] = [];
  static ALLOWED_SORT: string[] = [];
  static BOOLEAN_FILTERS = ['unwatched', 'duplicate'];
  /** Unknown (com.plexapp.agents.imdb, etc) */
  declare agent: string;
  /** l True if you allow syncing content from this section. */
  declare allowSync: boolean;
  /** Wallpaper artwork used to respresent this section. */
  declare art: string;
  /** Composit image used to represent this section. */
  declare composite: string;
  /** Unknown */
  declare filters: boolean;
  /** Language represented in this section (en, xn, etc). */
  declare language: string;
  /** Paths on disk where section content is stored. */
  declare locations: Location[];
  /** True if this section is currently being refreshed. */
  declare refreshing: boolean;
  /** Internal scanner used to find media (Plex Movie Scanner, Plex Premium Music Scanner, etc.) */
  declare scanner: string;
  /** Thumbnail image used to represent this section. */
  declare thumb: string;
  /** Title of this section. */
  declare title: string;
  /** Type of content section represents (movie, artist, photo, show). */
  declare type: Libtype;
  /** Datetime this library section was last updated. */
  declare updatedAt: Date;
  /** Datetime this library section was created. */
  declare createdAt: Date;
  declare scannedAt: Date;
  /** Unique id for this section (32258d7c-3e6c-4ac5-98ad-bad7a3b78c63) */
  declare uuid: string;
  declare CONTENT_TYPE: string;
  readonly SECTION_TYPE!: Class<SType>;

  declare _filterTypes?: FilteringType[];
  declare _fieldTypes?: FilteringFieldType[];

  private _durationStorageCache?: { duration: number | null; storage: number | null };

  /**
   * Returns the total number of items in the library.
   * Queries the library without fetching any items to get the total count.
   *
   * @param options.libtype Filter by a specific library type (movie, show, episode, etc.).
   * @param options.includeCollections Whether to include collections in the count. Default true.
   */
  async totalViewSize(options?: {
    libtype?: string;
    includeCollections?: boolean;
  }): Promise<number> {
    const params = new URLSearchParams({
      includeCollections: (options?.includeCollections ?? true) ? '1' : '0',
      'X-Plex-Container-Start': '0',
      'X-Plex-Container-Size': '0',
    });
    if (options?.libtype) {
      params.set('type', searchType(options.libtype).toString());
    }
    const key = `/library/sections/${this.key}/all?${params.toString()}`;
    const data = await this.server.query<MediaContainer<{ totalSize: number }>>({ path: key });
    return data.MediaContainer.totalSize ?? 0;
  }

  /**
   * Returns the total number of items in the library, excluding collections.
   */
  async totalSize(): Promise<number> {
    return this.totalViewSize({ includeCollections: false });
  }

  /**
   * Returns the total duration of all items in the library in milliseconds, or null if unavailable.
   */
  async totalDuration(): Promise<number | null> {
    return (await this._fetchDurationStorage()).duration;
  }

  /**
   * Returns the total storage size of all items in the library in bytes, or null if unavailable.
   */
  async totalStorage(): Promise<number | null> {
    return (await this._fetchDurationStorage()).storage;
  }

  /**
   * Add new file paths to the library section.
   * @param locations One or more file paths to add.
   */
  async addLocations(locations: string | string[]): Promise<Section> {
    const paths = typeof locations === 'string' ? [locations] : locations;
    const currentPaths = this.locations.map(loc => loc.path);
    const allPaths = [...currentPaths, ...paths];
    return this._editLocations(allPaths);
  }

  /**
   * Remove file paths from the library section.
   * @param locations One or more file paths to remove.
   */
  async removeLocations(locations: string | string[]): Promise<Section> {
    const paths = typeof locations === 'string' ? [locations] : locations;
    const currentPaths = this.locations.map(loc => loc.path);
    for (const path of paths) {
      if (!currentPaths.includes(path)) {
        throw new BadRequest(`Path: ${path} does not exist in the library.`);
      }
    }
    const remaining = currentPaths.filter(p => !paths.includes(p));
    if (remaining.length === 0) {
      throw new BadRequest('You are unable to remove all locations from a library.');
    }
    return this._editLocations(remaining);
  }

  async all(sort = ''): Promise<SType[]> {
    const key = this._buildQueryKey(`/library/sections/${this.key}/all`, sort ? { sort } : {});
    const items = await fetchItems(this.server, key, undefined, this.SECTION_TYPE, this);
    return items;
  }

  async agents(): Promise<Agent[]> {
    return this.server.agents(searchType(this.type));
  }

  /**
   * @param title Title of the item to return.
   * @returns the media item with the specified title.
   */
  async get(title: string): Promise<SType> {
    const key = this._buildQueryKey(`/library/sections/${this.key}/all`, { title });
    const data = await fetchItem(this.server, key, { title__iexact: title });
    return new this.SECTION_TYPE(this.server, data, key, this);
  }

  /**
   * Returns the media item with the specified external IMDB, TMDB, or TVDB ID.
   * Note: This search uses a PlexAPI operator so performance may be slow. All items from the
   * entire Plex library need to be retrieved for each guid search. It is recommended to create
   * your own lookup dictionary if you are searching for a lot of external guids.
   *
   * @param guid The external guid of the item to return.
   *  Examples: IMDB ``imdb://tt0944947``, TMDB ``tmdb://1399``, TVDB ``tvdb://121361``.
   *
   *
   * Example:
   *
   * 		.. code-block:: python
   *
   * 				# This will retrieve all items in the entire library 3 times
   * 				result1 = library.getGuid('imdb://tt0944947')
   * 				result2 = library.getGuid('tmdb://1399')
   * 				result3 = library.getGuid('tvdb://121361')
   *
   * 				# This will only retrieve all items in the library once to create a lookup dictionary
   * 				guidLookup = {guid.id: item for item in library.all() for guid in item.guids}
   * 				result1 = guidLookup['imdb://tt0944947']
   * 				result2 = guidLookup['tmdb://1399']
   * 				result3 = guidLookup['tvdb://121361']
   */
  async getGuid(guid: string): Promise<SType> {
    const key = this._buildQueryKey(`/library/sections/${this.key}/all`);
    return fetchItem(this.server, key, { Guid__id__iexact: guid });
  }

  /**
   * Returns the Plex Web URL for the library.
   *
   * @param base The base URL before the fragment (``#!``).
   *    Default is https://app.plex.tv/desktop.
   * @param tab The library tab (recommended, library, collections, playlists, timeline).
   * @param key A hub key.
   */
  getWebURL({
    base,
    tab,
    key,
  }: {
    /** The base URL before the fragment (``#!``). Default is https://app.plex.tv/desktop. */
    base?: string;
    /** The library tab (recommended, library, collections, playlists, timeline). */
    tab?: string;
    /** A hub key. */
    key?: string;
  } = {}): string {
    const params = new URLSearchParams();
    params.append('source', this.key);
    if (tab) {
      params.append('pivot', tab);
    }

    if (key) {
      params.append('key', key);
      params.append('pageType', 'list');
    }

    return this.server._buildWebURL({ base, params });
  }

  /**
   * Search the library. The http requests will be batched in container_size. If you are only looking for the
   * first <num> results, it would be wise to set the maxresults option to that amount so the search doesn't iterate
   * over all results on the server.
   *
   * Example: "studio=Comedy%20Central" or "year=1999" "title=Kung Fu" all work. Other items
   * such as actor=<id> seem to work, but require you already know the id of the actor.
   * TLDR: This is untested but seems to work. Use library section search when you can.
   * @param args Search using a number of different attributes
   */
  async search<C = SType>(args: Partial<SearchArgs> = {}, Cls?: Class<C>): Promise<C[]> {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(args)) {
      if (key === 'libtype' || value === undefined || value === null) {
        continue;
      }

      let strValue: string;
      if (typeof value === 'string') {
        strValue = value;
      } else if (value instanceof FilteringSort) {
        strValue = value.key;
      } else if (Array.isArray(value)) {
        strValue = value.join(',');
      } else if (typeof value === 'boolean') {
        strValue = value ? '1' : '0';
      } else {
        strValue = JSON.stringify(value);
      }

      params.append(key, strValue);
    }

    if (args.libtype) {
      params.append('type', searchType(args.libtype).toString());
    }

    const key = this._buildQueryKey(`/library/sections/${this.key}/all?${params.toString()}`);
    const ClsToUse = Cls ?? (this.SECTION_TYPE as unknown as Class<C>);
    const data = await fetchItems(this.server, key, undefined, ClsToUse, this);
    return data;
  }

  /**
   * Run an analysis on all of the items in this library section.
   * See :func:`~plexapi.base.PlexPartialObject.analyze` for more details.
   */
  async analyze(): Promise<void> {
    const key = `/library/sections/${this.key}/analyze`;
    await this.server.query({ path: key, method: 'post' });
  }

  /**
   * If a section has items in the Trash, use this option to empty the Trash
   */
  async emptyTrash(): Promise<void> {
    const key = `/library/sections/${this.key}/emptyTrash`;
    await this.server.query({ path: key, method: 'put' });
  }

  /**
   * Get Play History for this library Section for the owner.
   * @param maxresults (int): Only return the specified number of results (optional).
   * @param mindate (datetime): Min datetime to return results from.
   */
  // async history(maxresults=9999999, mindate?: Date): Promise<any> {
  //   return this.server.history({ maxResults, minDate, librarySectionId: this.key, accountId: 1 })
  // }

  /**
   * Scan this section for new media.
   */
  async update(): Promise<void> {
    const key = `/library/sections/${this.key}/refresh`;
    await this.server.query({ path: key });
  }

  /**
   * Cancel update of this Library Section.
   */
  async cancelUpdate(): Promise<void> {
    const key = `/library/sections/${this.key}/refresh`;
    await this.server.query({ path: key, method: 'delete' });
  }

  /**
   * Forces a download of fresh media information from the internet.
   * This can take a long time. Any locked fields are not modified.
   */
  override async refresh(): Promise<void> {
    const key = `/library/sections/${this.key}/refresh?force=1`;
    await this.server.query({ path: key });
  }

  /**
   * Delete the preview thumbnails for items in this library. This cannot
   * be undone. Recreating media preview files can take hours or even days.
   */
  async deleteMediaPreviews(): Promise<void> {
    const key = `/library/sections/${this.key}/indexes`;
    await this.server.query({ path: key, method: 'delete' });
  }

  /** Delete a library section. */
  async delete(): Promise<void> {
    const key = `/library/sections/${this.key}`;
    await this.server.query({ path: key, method: 'delete' });
  }

  /**
   * Edit a library
   * @param kwargs object of settings to edit
   */
  async edit(kwargs: Record<string, string>): Promise<Section> {
    const params = new URLSearchParams(kwargs);
    const part = `/library/sections/${this.key}?${params.toString()}`;
    await this.server.query({ path: part, method: 'put' });
    const library = await this.server.library();
    const sections = await library.sections();
    for (const section of sections) {
      if (section.key === this.key) {
        return section;
      }
    }

    throw new Error("Couldn't update section");
  }

  /**
   * Returns the managed recommendation hubs for this library section.
   */
  async managedHubs(): Promise<ManagedHub[]> {
    const key = `/hubs/sections/${this.key}/manage`;
    return fetchItems<ManagedHub>(this.server, key, undefined, ManagedHub, this);
  }

  /**
   * Reset managed hub customizations for this library section.
   */
  async resetManagedHubs(): Promise<void> {
    const key = `/hubs/sections/${this.key}/manage`;
    await this.server.query({ path: key, method: 'delete' });
  }

  async hubs(): Promise<Hub[]> {
    const key = this._buildQueryKey(`/hubs/sections/${this.key}`, { includeStations: 1 });
    const hubs = await fetchItems<Hub>(this.server, key, undefined, Hub, this);
    return hubs;
  }

  /**
   * Returns the current library section timeline status.
   */
  async timeline(): Promise<LibraryTimeline> {
    const key = `/library/sections/${this.key}/timeline`;
    const data = await this.server.query<MediaContainer<LibraryTimelineData>>({ path: key });
    return new LibraryTimeline(this.server, data.MediaContainer, key, this);
  }

  /**
   * Returns a list of playlists from this library section.
   */
  async playlists(): Promise<Playlist[]> {
    const key = `/playlists?type=15&playlistType=${this.CONTENT_TYPE}&sectionID=${this.key}`;
    return fetchItems<Playlist>(this.server, key, undefined, Playlist, this);
  }

  async collections(
    args: Record<string, number | string | boolean> = {},
  ): Promise<Array<Collections<SType>>> {
    const collections = await this.search<Collections<SType>>(
      { ...args, libtype: 'collection' },
      Collections,
    );
    collections.forEach(collection => {
      collection.VIDEO_TYPE = this.SECTION_TYPE;
    });
    return collections;
  }

  /**
   * Returns a list of available Folders for this library section.
   */
  async folders(): Promise<Folder[]> {
    const key = `/library/sections/${this.key}/folder`;
    return fetchItems<Folder>(this.server, key, undefined, Folder);
  }

  async genres(): Promise<FilterChoice[]> {
    const key = `/library/sections/${this.key}/genre`;
    return fetchItems<FilterChoice>(this.server, key, undefined, FilterChoice, this);
  }

  /**
   * Returns a list of items currently on deck (in progress) for this library section.
   */
  async onDeck(): Promise<SType[]> {
    const key = this._buildQueryKey(`/library/sections/${this.key}/onDeck`);
    return fetchItems(this.server, key, undefined, this.SECTION_TYPE, this);
  }

  /**
   * Returns a list of recently added items for this library section.
   *
   * @param maxResults Maximum number of results to return. Default 50.
   */
  async recentlyAdded(maxResults?: number): Promise<SType[]>;
  async recentlyAdded<T extends Libtype>(
    maxResults: number | undefined,
    libtype: T,
  ): Promise<Array<SearchClassForLibtype<T>>>;
  async recentlyAdded<T extends Libtype>(
    maxResults = 50,
    libtype?: T,
  ): Promise<SType[] | Array<SearchClassForLibtype<T>>> {
    const requestedLibtype = libtype ?? (this.type as T);
    const cls =
      (libtype ? classForLibtype(requestedLibtype) : this.SECTION_TYPE) ?? this.SECTION_TYPE;
    return this.search(
      { maxresults: maxResults, sort: 'addedAt:desc', libtype: requestedLibtype },
      cls as Class<SearchClassForLibtype<T>>,
    );
  }

  /**
   * Returns the list of first characters for items in this library section.
   * This is the data used to populate the alphabet bar in the Plex UI.
   */
  async firstCharacter(): Promise<FirstCharacter[]> {
    const key = `/library/sections/${this.key}/firstCharacter`;
    return fetchItems<FirstCharacter>(this.server, key, undefined, FirstCharacter);
  }

  /**
   * Returns a list of available {@link FilteringField} for a specified libtype.
   * This is the list of options in the custom filter dropdown menu
   */
  async listFields(libtype: Libtype = this.type) {
    return (await this.getFilterType(libtype)).fields;
  }

  async getFilterType(libtype: Libtype = this.type) {
    const filterTypes = await this.filterTypes();
    const filter = filterTypes.find(f => f.type === libtype);
    if (!filter) {
      throw new NotFound(
        `Unknown libtype "${libtype}" for this library.
        Available libtypes: ${filterTypes.map(f => f.type).join(', ')}`,
      );
    }

    return filter;
  }

  /**
   * @param fieldType The data type for the field (tag, integer, string, boolean, date,
                    subtitleLanguage, audioLanguage, resolution).
   */
  async getFieldType(fieldType: string): Promise<FilteringFieldType> {
    const fieldTypes = await this.fieldTypes();
    const fType = fieldTypes.find(f => f.type === fieldType);

    if (!fType) {
      const availableFieldTypes = fieldTypes.map(f => f.type);
      throw new NotFound(
        `Unknown field type "${fieldType}" for this library. Available field types: ${availableFieldTypes.join(
          ', ',
        )}`,
      );
    }

    return fType;
  }

  /**
   * @param libtype The library type to filter (movie, show, season, episode,
   *                 artist, album, track, photoalbum, photo, collection).
   *
   * @example
   * ```ts
   * const availableFilters = (await library.listFilters()).map(f => f.filter)
   * ```
   */
  async listFilters(libtype?: Libtype) {
    return (await this.getFilterType(libtype)).filters;
  }

  /**
   * Returns a list of available sorting fields for the specified libtype.
   */
  async listSorts(libtype?: Libtype): Promise<FilteringSort[]> {
    return (await this.getFilterType(libtype)).sorts;
  }

  /**
   * Returns the available values for a custom filter field.
   */
  async listFilterChoices(
    field: string | FilteringFilter,
    libtype?: Libtype,
  ): Promise<FilterChoice[]> {
    let filterField = field;
    if (typeof filterField === 'string') {
      const match = /^(?:([a-zA-Z]*)\.)?([a-zA-Z]+)$/.exec(filterField);
      if (!match) {
        throw new BadRequest(`Invalid filter field: ${filterField}`);
      }

      const [, parsedLibtype, parsedField] = match;
      const requestedLibtype = (parsedLibtype as Libtype) || libtype || (this.type as Libtype);
      const filters = await this.listFilters(requestedLibtype);
      const foundFilter = filters.find(filter => filter.filter === parsedField);
      if (!foundFilter) {
        const availableFilters = filters.map(filter => filter.filter);
        throw new NotFound(
          `Unknown filter field "${parsedField}" for libtype "${requestedLibtype}". Available filters: ${availableFilters.join(
            ', ',
          )}`,
        );
      }

      filterField = foundFilter;
    }

    return fetchItems<FilterChoice>(this.server, filterField.key, undefined, FilterChoice, this);
  }

  /**
   * @param fieldType The data type for the field (tag, integer, string, boolean, date,
   *                 subtitleLanguage, audioLanguage, resolution).
   */
  async listOperators(fieldType: string) {
    return (await this.getFieldType(fieldType)).operators;
  }

  async filterTypes() {
    if (!this._filterTypes) {
      await this._loadFilters();
    }

    return this._filterTypes;
  }

  async fieldTypes() {
    if (!this._fieldTypes) {
      await this._loadFilters();
    }

    return this._fieldTypes;
  }

  /**
   * Returns fields common to all provided items.
   */
  async common(items: EditableLibraryItem | EditableLibraryItem[]): Promise<Common> {
    const validItems = this._validateItems(items);
    const params = new URLSearchParams({
      id: validItems.map(item => item.ratingKey?.toString()).join(','),
      type: searchType(validItems[0].type).toString(),
    });
    const key = `/library/sections/${this.key}/common?${params.toString()}`;
    const data = await fetchItem(this.server, key, undefined, Common);
    return new Common(this.server, data, key, this);
  }

  /**
   * Edit multiple items at once using Plex field keys.
   */
  async multiEdit(
    items: EditableLibraryItem | EditableLibraryItem[],
    changes: Record<string, string | number | boolean>,
  ): Promise<this> {
    const validItems = this._validateItems(items);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(changes)) {
      params.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : value.toString());
    }

    params.set('id', validItems.map(item => item.ratingKey?.toString()).join(','));
    if (!params.has('type')) {
      params.set('type', searchType(validItems[0].type).toString());
    }

    const key = `/library/sections/${this.key}/all?${params.toString()}`;
    await this.server.query({ path: key, method: 'put' });
    return this;
  }

  /**
   * Lock a field for all items of a libtype in this library.
   */
  async lockAllField(field: string, libtype: Libtype = this.type as Libtype): Promise<this> {
    return this._lockUnlockAllField(field, libtype, true);
  }

  /**
   * Unlock a field for all items of a libtype in this library.
   */
  async unlockAllField(field: string, libtype: Libtype = this.type as Libtype): Promise<this> {
    return this._lockUnlockAllField(field, libtype, false);
  }

  private async _fetchDurationStorage(): Promise<{
    duration: number | null;
    storage: number | null;
  }> {
    if (this._durationStorageCache) {
      return this._durationStorageCache;
    }
    const data = await this.server.query<MediaContainer<MediaProvidersResponse>>({
      path: '/media/providers?includeStorage=1',
    });
    const providers = data.MediaContainer?.MediaProvider ?? [];
    for (const provider of providers) {
      if (provider.identifier !== 'com.plexapp.plugins.library') {
        continue;
      }
      for (const feature of provider.Feature ?? []) {
        if (feature.type !== 'content') {
          continue;
        }
        for (const dir of feature.Directory ?? []) {
          if (String(dir.id) === String(this.key)) {
            this._durationStorageCache = {
              duration: dir.durationTotal != null ? Number(dir.durationTotal) : null,
              storage: dir.storageTotal != null ? Number(dir.storageTotal) : null,
            };
            return this._durationStorageCache;
          }
        }
      }
    }
    this._durationStorageCache = { duration: null, storage: null };
    return this._durationStorageCache;
  }

  private _validateItems(
    items: EditableLibraryItem | EditableLibraryItem[],
  ): EditableLibraryItem[] {
    const itemList = Array.isArray(items) ? items : [items];
    if (itemList.length === 0) {
      throw new BadRequest('No items specified.');
    }

    const [firstItem] = itemList;
    const itemType = firstItem.type;
    for (const item of itemList) {
      if (String(item.librarySectionID) !== String(this.key)) {
        throw new BadRequest(`${item.title ?? item.ratingKey} is not from this library.`);
      }

      if (item.type !== itemType) {
        throw new BadRequest(`Cannot mix items of different type: ${itemType} and ${item.type}`);
      }
    }

    return itemList;
  }

  private async _lockUnlockAllField(
    field: string,
    libtype: Libtype,
    locked: boolean,
  ): Promise<this> {
    const params = new URLSearchParams({
      type: searchType(libtype).toString(),
      [`${field}.locked`]: locked ? '1' : '0',
    });
    const key = `/library/sections/${this.key}/all?${params.toString()}`;
    await this.server.query({ path: key, method: 'put' });
    return this;
  }

  private async _editLocations(paths: string[]): Promise<Section> {
    const locationParams = paths.map(p => `location=${encodeURIComponent(p)}`).join('&');
    const part = `/library/sections/${this.key}?agent=${this.agent}&${locationParams}`;
    await this.server.query({ path: part, method: 'put' });
    const library = await this.server.library();
    const sections = await library.sections();
    for (const section of sections) {
      if (section.key === this.key) {
        return section;
      }
    }
    throw new Error("Couldn't update section");
  }

  protected _loadData(data: SectionsDirectory): void {
    this.uuid = data.uuid;
    this.key = data.key;
    this.agent = data.agent;
    this.allowSync = data.allowSync;
    this.art = data.art;
    this.composite = data.composite;
    this.filters = data.filters;
    this.language = data.language;
    this.locations = data.Location;
    this.refreshing = data.refreshing;
    this.scanner = data.scanner;
    this.thumb = data.thumb;
    this.title = data.title;
    this.type = data.type as Libtype;
    this.updatedAt = new Date(data.updatedAt * 1000);
    this.createdAt = new Date(data.createdAt * 1000);
    this.scannedAt = new Date(data.scannedAt * 1000);
  }

  private async _loadFilters() {
    const key = `/library/sections/${this.key}/all?includeMeta=1&includeAdvanced=1&X-Plex-Container-Start=0&X-Plex-Container-Size=0`;
    const data = await this.server.query<
      MediaContainer<{ Meta?: LibraryFilterMetaData | LibraryFilterMetaData[] }>
    >({
      path: key,
    });
    const [meta = {}] = asArray(data.MediaContainer.Meta);
    this._filterTypes = asArray(meta.Type).map(
      type => new FilteringType(this.server, type, undefined, this),
    );
    this._fieldTypes = asArray(meta.FieldType).map(
      fieldType => new FilteringFieldType(this.server, fieldType, undefined, this),
    );
  }

  // /**
  //  * Validates a filter field and values are available as a custom filter for the library.
  //  * Returns the validated field and values as a URL encoded parameter string.
  //  */
  // private async _validateFilterField(field: string, libtype?: Libtype) {
  //   const match = /(?:([a-zA-Z]*)\.)?(?<field>[a-zA-Z]+)(?<operator>[!<>=&]*)/.exec(field);
  //   if (!match || !match.groups) {
  //     throw new BadRequest(`Invalid filter field: ${field}`);
  //   }

  //   const { libtype: _libtype, field: parsedField, operator: operatorMatch } = match.groups;
  //   libtype = (_libtype as Libtype) ?? libtype ?? this.type;
  //   const filterField = (await this.listFields(libtype)).find(
  //     f => f.key.split('.')[-1] === parsedField,
  //   );

  //   if (!filterField) {
  //     throw new NotFound('Unknown filter field');
  //   }

  //   field = filterField.key;
  //   const operator = await this._validateFieldOperator(filterField, operatorMatch);
  //   const result = this._validateFieldValue(filterField, values, libtype);

  //   if (operator === '&=') {
  //     const args = { [field]: result };
  //     return args;
  //   }

  //   return { [field + operator.slice(0, operator.length - 1)]: result.join(',') };
  // }

  // /**
  //  * Validates filter operator is in the available operators.
  //  * Returns the validated operator string.
  //  */
  // private async _validateFieldOperator(filterField: FilteringField, operator: string) {
  //   const fieldType = await this.getFieldType(filterField.type);

  //   let andOperator = false;
  //   if (['&', '&='].includes(operator)) {
  //     andOperator = true;
  //     operator = '';
  //   } else if (['=', '!='].includes(operator)) {
  //     operator += '=';
  //   }

  //   operator = operator.endsWith('=') ? operator.slice(0, operator.length - 1) : operator + '=';

  //   const exists = fieldType.operators.find(o => o.key === operator);
  //   if (!exists) {
  //     throw new NotFound('Unknown operator');
  //   }

  //   return andOperator ? '&=' : operator;
  // }

  // /**
  //  * Validates filter values are the correct datatype and in the available filter choices.
  //  * @returns the validated list of values.
  //  */
  // private async _validateFieldValue(filterField: FilteringField, values, libtype): Promise<any> {
  //   // todo
  // }
}

export class MovieSection extends LibrarySection<Movie> {
  static override TYPE = 'movie';
  static override ALLOWED_FILTERS = [
    'unwatched',
    'duplicate',
    'year',
    'decade',
    'genre',
    'contentRating',
    'collection',
    'director',
    'actor',
    'country',
    'studio',
    'resolution',
    'guid',
    'label',
    'writer',
    'producer',
    'subtitleLanguage',
    'audioLanguage',
    'lastViewedAt',
    'viewCount',
    'addedAt',
  ];

  static override ALLOWED_SORT = [
    'addedAt',
    'originallyAvailableAt',
    'lastViewedAt',
    'titleSort',
    'rating',
    'mediaHeight',
    'duration',
  ];

  static override TAG = 'Directory';
  METADATA_TYPE = 'movie';
  override CONTENT_TYPE = 'video';
  override readonly SECTION_TYPE = Movie;

  /** Search for a movie. */
  async searchMovies(args: Partial<SearchArgs> = {}): Promise<Movie[]> {
    return this.search({ ...args, libtype: 'movie' }, Movie);
  }

  /** Returns recently added movies from this library section. */
  async recentlyAddedMovies(maxResults = 50): Promise<Movie[]> {
    return this.recentlyAdded(maxResults, 'movie');
  }
}

export class ShowSection extends LibrarySection<Show> {
  static override TYPE = 'show';
  static override ALLOWED_FILTERS = [
    'unwatched',
    'year',
    'genre',
    'contentRating',
    'network',
    'collection',
    'guid',
    'duplicate',
    'label',
    'show.title',
    'show.year',
    'show.userRating',
    'show.viewCount',
    'show.lastViewedAt',
    'show.actor',
    'show.addedAt',
    'episode.title',
    'episode.originallyAvailableAt',
    'episode.resolution',
    'episode.subtitleLanguage',
    'episode.unwatched',
    'episode.addedAt',
    'episode.userRating',
    'episode.viewCount',
    'episode.lastViewedAt',
  ];

  static override ALLOWED_SORT = [
    'addedAt',
    'lastViewedAt',
    'originallyAvailableAt',
    'titleSort',
    'rating',
    'unwatched',
  ];

  static override TAG = 'Directory';
  METADATA_TYPE = 'episode';
  override CONTENT_TYPE = 'video';
  override readonly SECTION_TYPE = Show;

  /** Search for a show. */
  async searchShows(args: Partial<SearchArgs> = {}): Promise<Show[]> {
    return this.search({ ...args, libtype: 'show' }, Show);
  }

  /** Search for a season. */
  async searchSeasons(args: Partial<SearchArgs> = {}): Promise<Season[]> {
    return this.search({ ...args, libtype: 'season' }, Season);
  }

  /** Search for an episode. */
  async searchEpisodes(args: Partial<SearchArgs> = {}): Promise<Episode[]> {
    return this.search({ ...args, libtype: 'episode' }, Episode);
  }

  /** Returns recently added shows from this library section. */
  async recentlyAddedShows(maxResults = 50): Promise<Show[]> {
    return this.search({ maxresults: maxResults, sort: 'addedAt:desc', libtype: 'show' }, Show);
  }

  /** Returns recently added seasons from this library section. */
  async recentlyAddedSeasons(maxResults = 50): Promise<Season[]> {
    return this.search({ maxresults: maxResults, sort: 'addedAt:desc', libtype: 'season' }, Season);
  }

  /** Returns recently added episodes from this library section. */
  async recentlyAddedEpisodes(maxResults = 50): Promise<Episode[]> {
    return this.search(
      { maxresults: maxResults, sort: 'addedAt:desc', libtype: 'episode' },
      Episode,
    );
  }

  /**
   * Returns a list of recently added shows from this library section.
   *
   * @param maxResults Maximum number of results to return. Default 50.
   */
  override async recentlyAdded(maxResults = 50): Promise<Show[]> {
    return this.recentlyAddedShows(maxResults);
  }
}

export class MusicSection extends LibrarySection<Track> {
  static override TYPE = 'artist';
  static override TAG = 'Directory';
  METADATA_TYPE = 'track';
  override CONTENT_TYPE = 'audio';
  override readonly SECTION_TYPE = Track;

  /** Returns a list of Album objects in this section. */
  async albums(): Promise<Album[]> {
    const key = this._buildQueryKey(`/library/sections/${this.key}/albums`);
    return fetchItems<Album>(this.server, key, undefined, Album, this);
  }

  /**
   * Returns the music stations Hub for this section, if available.
   * TODO: Investigate how to return actual station items (Playlists?) from the Hub.
   */
  async stations(): Promise<Hub | undefined> {
    const hubs = await this.hubs();
    return hubs.find(hub => hub.hubIdentifier === 'hub.music.stations');
  }

  /** Search for an artist. */
  async searchArtists(args: Partial<SearchArgs> = {}): Promise<Artist[]> {
    return this.search({ ...args, libtype: 'artist' }, Artist);
  }

  /** Search for an album. */
  async searchAlbums(args: Partial<SearchArgs> = {}): Promise<Album[]> {
    return this.search({ ...args, libtype: 'album' }, Album);
  }

  /** Search for a track. */
  async searchTracks(args: Partial<SearchArgs> = {}): Promise<Track[]> {
    return this.search({ ...args, libtype: 'track' }, Track);
  }

  /** Returns a list of recently added artists from this library section. */
  async recentlyAddedArtists({ maxResults = 50 }: { maxResults?: number } = {}): Promise<Artist[]> {
    return this.search({ maxresults: maxResults, sort: 'addedAt:desc', libtype: 'artist' }, Artist);
  }

  /** Returns a list of recently added albums from this library section. */
  async recentlyAddedAlbums({ maxResults = 50 }: { maxResults?: number } = {}): Promise<Album[]> {
    return this.search({ maxresults: maxResults, sort: 'addedAt:desc', libtype: 'album' }, Album);
  }

  /** Returns a list of recently added tracks from this library section. */
  async recentlyAddedTracks({ maxResults = 50 }: { maxResults?: number } = {}): Promise<Track[]> {
    return this.search({ maxresults: maxResults, sort: 'addedAt:desc', libtype: 'track' }, Track);
  }

  /**
   * Returns a list of tracks from this library section that are part of a sonic adventure.
   * IDs should be of a track; other IDs will return an empty list or an error.
   * @param start The Track or ID of the first track in the sonic adventure.
   * @param end The Track or ID of the last track in the sonic adventure.
   * @returns A list of tracks that are part of a sonic adventure.
   */
  async sonicAdventure(start: Track | number, end: Track | number): Promise<Track[]> {
    const startID = typeof start === 'number' ? start : start.ratingKey;
    const endID = typeof end === 'number' ? end : end.ratingKey;
    const key = this._buildQueryKey(`/library/sections/${this.key}/computePath`, {
      startID,
      endID,
    });
    return fetchItems<Track>(this.server, key, undefined, Track, this);
  }
}

export class LibraryTimeline extends PlexObject {
  static override TAG = 'LibraryTimeline';

  declare size?: number;
  declare allowSync: boolean;
  declare art?: string;
  declare content?: string;
  declare identifier?: string;
  declare latestEntryTime?: number;
  declare mediaTagPrefix?: string;
  declare mediaTagVersion?: number;
  declare thumb?: string;
  declare title1?: string;
  declare updateQueueSize?: number;
  declare viewGroup?: string;
  declare viewMode?: number;

  protected _loadData(data: LibraryTimelineData): void {
    this.size = parseOptionalNumber(data.size);
    this.allowSync = parsePlexBoolean(data.allowSync);
    this.art = data.art;
    this.content = data.content;
    this.identifier = data.identifier;
    this.latestEntryTime = parseOptionalNumber(data.latestEntryTime);
    this.mediaTagPrefix = data.mediaTagPrefix;
    this.mediaTagVersion = parseOptionalNumber(data.mediaTagVersion);
    this.thumb = data.thumb;
    this.title1 = data.title1;
    this.updateQueueSize = parseOptionalNumber(data.updateQueueSize);
    this.viewGroup = data.viewGroup;
    this.viewMode = parseOptionalNumber(data.viewMode);
  }
}

export class ManagedHub extends PlexObject {
  static override TAG = 'Hub';

  declare deletable: boolean;
  declare homeVisibility: string;
  declare identifier: string;
  declare librarySectionID: string;
  declare promotedToOwnHome: boolean;
  declare promotedToRecommended: boolean;
  declare promotedToSharedHome: boolean;
  declare recommendationsVisibility: string;
  declare title: string;

  override async reload(): Promise<void> {
    const key = `/hubs/sections/${this.librarySectionID}/manage`;
    const data = await fetchItem(this.server, key, { identifier: this.identifier }, ManagedHub);
    this._loadData(data);
  }

  async move(after?: ManagedHub): Promise<void> {
    const params = new URLSearchParams();
    if (after) {
      params.set('after', after.identifier);
    }

    const suffix = params.toString();
    const key = `/hubs/sections/${this.librarySectionID}/manage/${this.identifier}/move${
      suffix ? `?${suffix}` : ''
    }`;
    await this.server.query({ path: key, method: 'put' });
  }

  async remove(): Promise<void> {
    if (!this.deletable) {
      throw new BadRequest(`${this.title} managed hub cannot be removed`);
    }

    const key = `/hubs/sections/${this.librarySectionID}/manage/${this.identifier}`;
    await this.server.query({ path: key, method: 'delete' });
  }

  protected _loadData(data: ManagedHubData): void {
    this.deletable = parsePlexBoolean(data.deletable, true);
    this.homeVisibility = data.homeVisibility ?? 'none';
    this.identifier = data.identifier;
    this.promotedToOwnHome = parsePlexBoolean(data.promotedToOwnHome);
    this.promotedToRecommended = parsePlexBoolean(data.promotedToRecommended);
    this.promotedToSharedHome = parsePlexBoolean(data.promotedToSharedHome);
    this.recommendationsVisibility = data.recommendationsVisibility ?? 'none';
    this.title = data.title;

    const parent = this.parent?.deref() as LibrarySection | undefined;
    this.librarySectionID =
      parent?.key ?? this.librarySectionID ?? data.librarySectionID?.toString() ?? '';
  }
}

/** Represents a single Hub (or category) in the PlexServer search */
export class Hub extends PlexObject {
  static override TAG = 'Hub';

  declare hubIdentifier: string;
  /** Number of items found. */
  declare size: number;
  declare title: string;
  declare type: string;
  /** True if the hub items are randomized. */
  declare random: boolean;
  declare Directory: SearchResultContainer['Directory'];
  declare Metadata: SearchResultContainer['Metadata'];

  protected _loadData(data: SearchResultContainer) {
    this.hubIdentifier = data.hubIdentifier;
    this.size = data.size;
    this.title = data.title;
    this.type = data.type;
    this.random = parsePlexBoolean(data.random);
    this.Directory = data.Directory;
    this.Metadata = data.Metadata;
  }
}

/**
 * Represents a Folder inside a library.
 */
export class Folder extends PlexObject {
  declare title: string;

  /**
   * Returns a list of available Folders for this folder.
   * Continue down subfolders until a mediaType is found.
   */
  async subfolders() {
    if (this.key.startsWith('/library/metadata')) {
      return fetchItems<Folder>(this.server, this.key);
    }

    return fetchItems<Folder>(this.server, this.key, undefined, Folder);
  }

  protected _loadData(data: FolderData) {
    this.key = data.key;
    this.title = data.title;
  }
}

export class Collections<
  CollectionVideoType extends RatingKeyItem = SectionType,
> extends PartialPlexObject {
  static override TAG = 'Directory';
  TYPE = 'collection';

  declare guid: string;
  declare smart: boolean;
  declare content: string;
  declare collectionMode: number;
  declare collectionSort: number;
  declare titleSort: string;
  declare librarySectionTitle: string;
  declare librarySectionKey: string;
  declare contentRating: string;
  declare subtype: string;
  declare summary: string;
  declare index: number;
  declare rating: number;
  declare userRating: number;
  declare thumb: string;
  declare addedAt: number;
  declare updatedAt: number;
  declare childCount: number;
  declare maxYear: string;
  declare minYear: string;
  declare art?: string;

  // TODO: can this be set in the constructor?
  declare VIDEO_TYPE: Class<CollectionVideoType>;

  // Alias for childCount
  get size() {
    return this.childCount;
  }

  /**
   * Returns a list of all items in the collection.
   */
  async items() {
    const key = this._buildQueryKey(`/library/metadata/${this.ratingKey}/children`);
    const data = await this.server.query<MediaContainer<{ Metadata?: unknown[] }>>({ path: key });
    return (
      data.MediaContainer.Metadata?.map(
        d => new this.VIDEO_TYPE(this.server, d, undefined, this),
      ) ?? []
    );
  }

  /**
   * Add items to the collection.
   * @param items Items to add to the collection.
   */
  async addItems(items: CollectionVideoType[]): Promise<void> {
    if (this.smart) {
      throw new Unsupported('Cannot add items to a smart collection.');
    }

    const ratingKeys = items.map(item => item.ratingKey).join(',');
    const uri = `${this.server._uriRoot()}/library/metadata/${ratingKeys}`;
    const params = new URLSearchParams({ uri });
    const key = `/library/collections/${this.ratingKey}/items?${params.toString()}`;
    await this.server.query({ path: key, method: 'put' });
    await this.reload();
  }

  /**
   * Remove items from the collection.
   * @param items Items to remove from the collection.
   */
  async removeItems(items: CollectionVideoType[]): Promise<void> {
    if (this.smart) {
      throw new Unsupported('Cannot remove items from a smart collection.');
    }

    for (const item of items) {
      const ratingKey = item.ratingKey;
      const key = `/library/collections/${this.ratingKey}/items/${ratingKey}`;
      await this.server.query({ path: key, method: 'delete' });
    }

    await this.reload();
  }

  /**
   * Move an item to a new position in the collection.
   * @param item Item to move.
   * @param after Item to place it after. If not provided, moves to the beginning.
   */
  async moveItem(item: CollectionVideoType, after?: CollectionVideoType): Promise<void> {
    if (this.smart) {
      throw new Unsupported('Cannot move items in a smart collection.');
    }

    const ratingKey = item.ratingKey;
    let key = `/library/collections/${this.ratingKey}/items/${ratingKey}/move`;
    if (after) {
      const afterKey = after.ratingKey;
      key += `?after=${afterKey}`;
    }

    await this.server.query({ path: key, method: 'put' });
    await this.reload();
  }

  /**
   * Update the collection display mode.
   * @param mode Display mode: 'default' (-1), 'hide' (0), 'hideItems' (1), 'showItems' (2).
   */
  async modeUpdate(mode: 'default' | 'hide' | 'hideItems' | 'showItems'): Promise<void> {
    const modeMap: Record<string, number> = {
      default: -1,
      hide: 0,
      hideItems: 1,
      showItems: 2,
    };
    const modeValue = modeMap[mode];
    if (modeValue === undefined) {
      throw new BadRequest(`Invalid collection mode: ${mode}`);
    }

    const params = new URLSearchParams({ collectionMode: modeValue.toString() });
    const key = `/library/metadata/${this.ratingKey}/prefs?${params.toString()}`;
    await this.server.query({ path: key, method: 'put' });
    await this.reload();
  }

  /**
   * Update the collection sort order.
   * @param sort Sort order: 'release' (0), 'alpha' (1), 'custom' (2).
   */
  async sortUpdate(sort: 'release' | 'alpha' | 'custom'): Promise<void> {
    const sortMap: Record<string, number> = {
      release: 0,
      alpha: 1,
      custom: 2,
    };
    const sortValue = sortMap[sort];
    if (sortValue === undefined) {
      throw new BadRequest(`Invalid collection sort: ${sort}`);
    }

    const params = new URLSearchParams({ collectionSort: sortValue.toString() });
    const key = `/library/metadata/${this.ratingKey}/prefs?${params.toString()}`;
    await this.server.query({ path: key, method: 'put' });
    await this.reload();
  }

  /**
   * Create a new regular (non-smart) collection.
   * @param server The PlexServer instance.
   * @param title Title of the new collection.
   * @param section The library section to create the collection in.
   * @param items Items to add to the collection.
   */
  static async create<T extends RatingKeyItem = SectionType>(
    server: PlexServer,
    title: string,
    section: LibrarySection<T>,
    items: T[],
  ): Promise<Collections<T>> {
    if (items.length === 0) {
      throw new BadRequest('At least one item is required to create a collection.');
    }

    const ratingKeys = items.map(item => item.ratingKey).join(',');
    const uri = `${server._uriRoot()}/library/metadata/${ratingKeys}`;
    const sectionType = searchType(section.type);
    const params = new URLSearchParams({
      title,
      type: sectionType.toString(),
      sectionId: section.key,
      uri,
    });
    const key = `/library/collections?${params.toString()}`;
    const data = await server.query<MediaContainer<{ Metadata?: CollectionData[] }>>({
      path: key,
      method: 'post',
    });
    const metadata = data.MediaContainer.Metadata?.[0];
    if (!metadata) {
      throw new Error('Failed to create collection');
    }

    const collection = new Collections<T>(server, metadata, key, section);
    collection.VIDEO_TYPE = section.SECTION_TYPE as unknown as Class<T>;
    return collection;
  }

  protected _loadFullData(data: CollectionData) {
    this._loadData(data);
  }

  protected _loadData(data: CollectionData) {
    this.key = data.key;
    this.title = data.title;
    this.titleSort = data.titleSort;
    this.ratingKey = data.ratingKey;
    this.guid = data.guid;
    this.type = data.type;
    this.smart = data.smart ?? false;
    this.content = data.content;
    this.collectionMode = data.collectionMode;
    this.collectionSort = data.collectionSort;
    this.librarySectionTitle = data.librarySectionTitle;
    this.librarySectionID = data.librarySectionID;
    this.librarySectionKey = data.librarySectionKey;
    this.contentRating = data.contentRating;
    this.subtype = data.subtype;
    this.summary = data.summary;
    this.index = data.index;
    this.rating = data.rating;
    this.userRating = data.userRating;
    this.thumb = data.thumb;
    this.addedAt = data.addedAt;
    this.updatedAt = data.updatedAt;
    this.childCount = Number(data.childCount ?? data.size ?? '0');
    this.maxYear = data.maxYear;
    this.minYear = data.minYear;
    this.art = data.art;
  }
}

export class Common extends PlexObject {
  static override TAG = 'Common';

  declare collections: Collection[];
  declare contentRating?: string;
  declare countries: Country[];
  declare directors: Director[];
  declare editionTitle?: string;
  declare fields: Field[];
  declare genres: Genre[];
  declare grandparentRatingKey?: number;
  declare grandparentTitle?: string;
  declare guid?: string;
  declare guids: Guid[];
  declare index?: number;
  declare labels: Label[];
  declare mixedFields: string[];
  declare moods: Mood[];
  declare originallyAvailableAt?: Date;
  declare parentRatingKey?: number;
  declare parentTitle?: string;
  declare producers: Producer[];
  declare ratingKey?: number;
  declare ratings: Rating[];
  declare roles: Role[];
  declare studio?: string;
  declare styles: Style[];
  declare summary?: string;
  declare tags: Tag[];
  declare tagline?: string;
  declare title?: string;
  declare titleSort?: string;
  declare type?: string;
  declare writers: Writer[];
  declare year?: number;

  get commonType(): Libtype | undefined {
    const [, search = ''] = this.initpath.split('?', 2);
    return reverseSearchType(new URLSearchParams(search).get('type'));
  }

  get ratingKeys(): number[] {
    const [, search = ''] = this.initpath.split('?', 2);
    const ratingKeys = new URLSearchParams(search).get('id') ?? '';
    return ratingKeys
      .split(',')
      .filter(Boolean)
      .map(ratingKey => Number(ratingKey));
  }

  async items(): Promise<LibrarySearchItem[]> {
    const ratingKeys = this.ratingKeys.join(',');
    const key = this._buildQueryKey(`/library/metadata/${ratingKeys}`);
    return fetchItems<LibrarySearchItem>(
      this.server,
      key,
      undefined,
      classForLibtype(this.commonType),
    );
  }

  protected _loadData(data: CommonData): void {
    this.collections = asArray(data.Collection).map(
      d => new Collection(this.server, d, undefined, this),
    );
    this.contentRating = data.contentRating;
    this.countries = asArray(data.Country).map(d => new Country(this.server, d, undefined, this));
    this.directors = asArray(data.Director).map(d => new Director(this.server, d, undefined, this));
    this.editionTitle = data.editionTitle;
    this.fields = asArray(data.Field).map(d => new Field(this.server, d, undefined, this));
    this.genres = asArray(data.Genre).map(d => new Genre(this.server, d, undefined, this));
    this.grandparentRatingKey = parseOptionalNumber(data.grandparentRatingKey);
    this.grandparentTitle = data.grandparentTitle;
    this.guid = data.guid;
    this.guids = asArray(data.Guid).map(d => new Guid(this.server, d, undefined, this));
    this.index = parseOptionalNumber(data.index);
    this.key = data.key;
    this.labels = asArray(data.Label).map(d => new Label(this.server, d, undefined, this));
    this.mixedFields = data.mixedFields ? data.mixedFields.split(',') : [];
    this.moods = asArray(data.Mood).map(d => new Mood(this.server, d, undefined, this));
    this.originallyAvailableAt = data.originallyAvailableAt
      ? new Date(data.originallyAvailableAt)
      : undefined;
    this.parentRatingKey = parseOptionalNumber(data.parentRatingKey);
    this.parentTitle = data.parentTitle;
    this.producers = asArray(data.Producer).map(d => new Producer(this.server, d, undefined, this));
    this.ratingKey = parseOptionalNumber(data.ratingKey);
    this.ratings = asArray(data.Rating).map(d => new Rating(this.server, d, undefined, this));
    this.roles = asArray(data.Role).map(d => new Role(this.server, d, undefined, this));
    this.studio = data.studio;
    this.styles = asArray(data.Style).map(d => new Style(this.server, d, undefined, this));
    this.summary = data.summary;
    this.tags = asArray(data.Tag).map(d => new Tag(this.server, d, undefined, this));
    this.tagline = data.tagline;
    this.title = data.title;
    this.titleSort = data.titleSort;
    this.type = data.type;
    this.writers = asArray(data.Writer).map(d => new Writer(this.server, d, undefined, this));
    this.year = parseOptionalNumber(data.year);
  }
}

export class FilterChoice extends PlexObject {
  static override TAG = 'Directory';

  /**
   * API URL path to quickly list all items with this filter choice.
   * (/library/sections/<section>/all?genre=<key>)
   */
  declare fastKey?: string;
  /** Thumbnail URL for the filter choice. */
  declare thumb?: string;
  /** The title of the filter choice. */
  declare title: string;
  /** The filter type (genre, contentRating, etc). */
  declare type: string;

  async items(): Promise<LibrarySearchItem[]> {
    if (!this.fastKey) {
      throw new Error('Cannot fetch filter choice items without a fastKey');
    }

    const [, search = ''] = this.fastKey.split('?', 2);
    const libtype = reverseSearchType(new URLSearchParams(search).get('type'));
    const parent = this.parent?.deref() as LibrarySection | undefined;
    const cls = classForLibtype(libtype) ?? parent?.SECTION_TYPE;
    return fetchItems<LibrarySearchItem>(
      this.server,
      this._buildQueryKey(this.fastKey),
      undefined,
      cls,
    );
  }

  protected _loadData(data: FilterChoiceData) {
    this.fastKey = data.fastKey;
    this.key = data.key;
    this.title = data.title;
    this.type = data.type;
    this.thumb = data.thumb;
  }
}

/**
 * Represents a single first character entry for a library section.
 * Used to populate the alphabet bar in the Plex UI.
 */
export class FirstCharacter extends PlexObject {
  static override TAG = 'Directory';

  /** The title of the character (e.g. 'A', 'B', '#'). */
  declare title: string;
  /** The number of items starting with this character. */
  declare size: number;

  protected _loadData(data: FirstCharacterData) {
    this.key = data.key;
    this.title = data.title;
    this.size = data.size;
  }
}

export class FilteringType extends PlexObject {
  static override TAG = 'Type';

  /** The libtype for the filter. */
  declare type: string;
  /** True if this filter type is currently active. */
  declare active: boolean;
  declare fields: FilteringField[];
  declare filters: FilteringFilter[];

  /** List of sort objects. */
  declare sorts: FilteringSort[];
  /** The title for the libtype filter. */
  declare title: string;

  _loadData(data: FilteringTypeData) {
    this.active = parsePlexBoolean(data.active);
    this.fields = asArray(data.Field).map(d => new FilteringField(this.server, d, undefined, this));
    this.filters = asArray(data.Filter).map(
      d => new FilteringFilter(this.server, d, undefined, this),
    );
    this.key = data.key;
    this.sorts = asArray(data.Sort).map(d => new FilteringSort(this.server, d, undefined, this));
    this.title = data.title;
    this.type = data.type;
  }
}

/**
 * Represents a single Filter object for a {@link FilteringType}
 */
export class FilteringFilter extends PlexObject {
  static override TAG = 'Filter';

  /** The key for the filter. */
  declare filter: string;
  /** The :class:`~plexapi.library.FilteringFieldType` type (string, boolean, integer, date, etc). */
  declare filterType: string;
  /** The title of the filter. */
  declare title: string;
  /** 'filter' */
  declare type: string;

  _loadData(data: FilteringFilterData) {
    this.filter = data.filter;
    this.filterType = data.filterType;
    this.key = data.key;
    this.title = data.title;
    this.type = data.type;
  }
}

/**
 * Represents a single Sort object for a {@link FilteringType}
 */
export class FilteringSort extends PlexObject {
  static override TAG = 'Sort';

  /** True if the sort is currently active. */
  declare active: boolean;
  /** The currently active sorting direction. */
  declare activeDirection?: string;
  /** The currently active default sorting direction. */
  declare default?: string;
  /** The default sorting direction. */
  declare defaultDirection?: string;
  /** The URL key for sorting with desc. */
  declare descKey?: string;
  /** API URL path for first character endpoint. */
  declare firstCharacterKey?: string;
  /** The title of the sorting. */
  declare title: string;

  _loadData(data: FilteringSortData) {
    this.active = parsePlexBoolean(data.active);
    this.activeDirection = data.activeDirection;
    this.default = data.default;
    this.defaultDirection = data.defaultDirection;
    this.descKey = data.descKey;
    this.firstCharacterKey = data.firstCharacterKey;
    this.key = data.key;
    this.title = data.title;
  }
}

/**
 * Represents a single Field object for a {@link FilteringType}
 */
export class FilteringField extends PlexObject {
  static override TAG = 'Field';

  declare type: string;
  declare title: string;
  /** The subtype of the filter (decade, rating, etc) */
  declare subType?: string;

  _loadData(data: FilteringFieldData) {
    this.key = data.key;
    this.title = data.title;
    this.type = data.type;
    this.subType = data.subType;
  }
}

/**
 * Represents a single FieldType for library filtering.
 */
export class FilteringFieldType extends PlexObject {
  static override TAG = 'FieldType';

  /** The filtering data type (string, boolean, integer, date, etc). */
  declare type: string;
  declare operators: FilteringOperator[];

  _loadData(data: FilteringFieldTypeData) {
    this.type = data.type;
    this.operators = asArray(data.Operator).map(
      d => new FilteringOperator(this.server, d, undefined, this),
    );
  }
}

/**
 * Represents a single FilterChoice for library filtering.
 */
export class FilteringOperator extends PlexObject {
  static override TAG = 'Operator';

  /** The title of the operator. */
  declare title: string;

  _loadData(data: FilteringOperatorData) {
    this.key = data.key;
    this.title = data.title;
  }
}
