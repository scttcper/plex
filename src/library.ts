import { URLSearchParams } from 'node:url';

import type { Class } from 'type-fest';

import { Album, Artist, Track } from './audio.ts';
import { PartialPlexObject } from './base/partialPlexObject.ts';
import { PlexObject } from './base/plexObject.ts';
import {
  buildQueryKey,
  fetchItem,
  fetchItemData,
  fetchItems,
  type ItemFilterValue,
  OPERATORS,
  type PlexItemData,
  type QueryParamValue,
} from './baseFunctionality.ts';
import { BadRequest, NotFound, Unsupported } from './exceptions.ts';
import { classForPlexType, createPlexItem } from './itemFactory.ts';
import type {
  CommonData,
  CollectionData,
  Directory as LibraryDirectory,
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
  LibraryTagData,
  LibraryTimelineData,
  Location,
  ManagedHubData,
  MediaProviderDirectoryData,
  MediaProvidersResponse,
  SectionsDirectory,
  SectionsResponse,
} from './library.types.ts';
import {
  Chapter,
  Collection,
  Country,
  Director,
  Field,
  Format,
  Genre,
  Guid,
  Label,
  Marker,
  type MediaTag,
  Mood,
  Producer,
  Rating,
  Role,
  Similar,
  Style,
  Subformat,
  Tag,
  Writer,
} from './media.ts';
import { Photo, Photoalbum } from './photo.ts';
import {
  Playlist,
  type CreateRegularPlaylistOptions,
  type CreateSmartPlaylistOptions,
  type PlaylistContentType,
  type SmartPlaylistSearchOptions,
} from './playlist.ts';
import { type Agent, searchType, SEARCHTYPES } from './search.ts';
import type { SearchResultContainer } from './search.types.ts';
import type { PlexServer } from './server.ts';
import type { HistoryOptions, HistoryResult } from './server.types.ts';
import { Setting, type SettingResponse, type SettingValue } from './settings.ts';
import { type MediaContainer, parsePlexBoolean } from './util.ts';
import { Clip, Episode, Movie, Season, Show } from './video.ts';

export type Section = MovieSection | ShowSection | MusicSection | PhotoSection;
export type LibraryHubOptionValue = QueryParamValue | ReadonlyArray<string | number>;
export type LibrarySectionCreateType = 'artist' | 'movie' | 'photo' | 'show';
export type LibrarySectionAgent = string;
export type LibrarySectionScanner = string;
export type SectionForCreateType<T extends LibrarySectionCreateType> = T extends 'movie'
  ? MovieSection
  : T extends 'show'
    ? ShowSection
    : T extends 'artist'
      ? MusicSection
      : PhotoSection;

export interface LibraryAddOptions<T extends LibrarySectionCreateType = LibrarySectionCreateType> {
  /** Library section title. */
  name: string;
  /** Plex library section type. */
  type: T;
  /** Metadata agent identifier, such as `tv.plex.agents.movie`. */
  agent: LibrarySectionAgent;
  /** Scanner name, such as `Plex Movie`. */
  scanner: LibrarySectionScanner;
  /** One or more server-visible folder paths to add to this section. */
  locations: string | readonly string[];
  /** Library language. Defaults to `en-US`, matching Plex/Python behavior. */
  language?: string;
  /** Advanced preference values. Keys are encoded as `prefs[<key>]`. */
  preferences?: Record<string, SettingValue>;
}

export interface LibraryHubsOptions {
  /** IDs of the sections to limit results to, or "playlists". */
  sectionID?: string | number | ReadonlyArray<string | number>;
  /** Hub identifiers to limit results to, such as "home.continue". */
  identifier?: string | readonly string[];
  [param: string]: LibraryHubOptionValue | undefined;
}

export type LibrarySectionHubsOptions = Record<string, QueryParamValue>;

export interface LibrarySearchOptions {
  /** Exact or partial title query. */
  title?: string;
  /** Limit results to a Plex library type. */
  libtype?: Libtype;
  [param: string]: QueryParamValue;
}

export type LibraryHistoryOptions = Omit<HistoryOptions, 'librarySectionId'>;

export const LIBRARY_TAG_TYPES = {
  tag: 0,
  genre: 1,
  collection: 2,
  director: 4,
  writer: 5,
  role: 6,
  producer: 7,
  country: 8,
  chapter: 9,
  review: 10,
  label: 11,
  marker: 12,
  mediaProcessingTarget: 42,
  make: 200,
  model: 201,
  aperture: 202,
  exposure: 203,
  iso: 204,
  lens: 205,
  device: 206,
  autotag: 207,
  mood: 300,
  style: 301,
  format: 302,
  subformat: 303,
  similar: 305,
  concert: 306,
  banner: 311,
  poster: 312,
  art: 313,
  guid: 314,
  ratingImage: 316,
  theme: 317,
  studio: 318,
  network: 319,
  showOrdering: 322,
  clearLogo: 323,
  commonSenseMedia: 324,
  squareArt: 325,
  place: 400,
  sharedWidth: 500,
} as const;

export type LibraryTagName = keyof typeof LIBRARY_TAG_TYPES;
export type LibraryTagType = LibraryTagName | number | `${number}`;
export interface LibraryTagItems {
  /** Number of library items with this tag, when Plex provides it. */
  count?: number;
  /** Filter expression Plex uses for this tag. */
  filter?: string;
  /** Tag id. */
  id?: number | string;
  /** Library section id this tag belongs to, when scoped. */
  librarySectionID?: number;
  /** Library section key this tag belongs to, when scoped. */
  librarySectionKey?: string;
  /** Library section title this tag belongs to, when scoped. */
  librarySectionTitle?: string;
  /** Numeric Plex section type this tag belongs to, when scoped. */
  librarySectionType?: number;
  /** Search result reason, when the tag came from a search payload. */
  reason?: string;
  /** Search result reason id, when Plex provides it. */
  reasonID?: number;
  /** Search result reason title, when Plex provides it. */
  reasonTitle?: string;
  /** Search score, when the tag came from a search payload. */
  score?: number;
  /** Search result type. */
  type?: string;
  /** Tag title. */
  tag: string;
  /** Plex Discover rating key for person tags, when available. */
  tagKey?: string;
  /** Numeric Plex tag type. */
  tagType?: number;
  /** Numeric Plex tag value, when available. */
  tagValue?: number;
  /** Tag thumbnail, when available. */
  thumb?: string;
  /** Fetches the library items matching this tag. */
  items(): Promise<LibrarySearchItem[]>;
}
export type LibraryTagItemFor<T extends LibraryTagName> = T extends 'tag'
  ? Tag & LibraryTagItems
  : T extends 'genre'
    ? Genre & LibraryTagItems
    : T extends 'collection'
      ? Collection & LibraryTagItems
      : T extends 'director'
        ? Director & LibraryTagItems
        : T extends 'writer'
          ? Writer & LibraryTagItems
          : T extends 'role'
            ? Role & LibraryTagItems
            : T extends 'producer'
              ? Producer & LibraryTagItems
              : T extends 'country'
                ? Country & LibraryTagItems
                : T extends 'chapter'
                  ? Chapter & LibraryTagItems
                  : T extends 'label'
                    ? Label & LibraryTagItems
                    : T extends 'marker'
                      ? Marker & LibraryTagItems
                      : T extends 'mood'
                        ? Mood & LibraryTagItems
                        : T extends 'style'
                          ? Style & LibraryTagItems
                          : T extends 'format'
                            ? Format & LibraryTagItems
                            : T extends 'subformat'
                              ? Subformat & LibraryTagItems
                              : T extends 'similar'
                                ? Similar & LibraryTagItems
                                : LibraryMediaTag;

export class Library {
  static key = '/library';
  private readonly server: PlexServer;
  /** Number of root library entries returned by Plex. */
  declare size: number;
  /** Whether sync is allowed for the root library endpoint. */
  declare allowSync: boolean;
  /** Root library artwork path. */
  declare art: string;
  /** Root library content type. */
  declare content: string;
  /** Unknown ('com.plexapp.plugins.library') */
  declare identifier: string;
  /** Unknown (/system/bundle/media/flags/) */
  declare mediaTagPrefix: string;
  /** Version for media tag assets. */
  declare mediaTagVersion: number;
  /** 'Plex Library' (not sure how useful this is) */
  declare title1: string;
  /** Second title (this is blank on my setup) */
  declare title2: string;
  /** Root library directories returned by Plex. */
  declare directories: LibraryDirectory[];

  constructor(server: PlexServer, data: LibraryRootResponse) {
    this.server = server;
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
      for (const cls of [MovieSection, ShowSection, MusicSection, PhotoSection]) {
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
      const availableSections = sections.map(s => s.title || 'Unknown').join(', ');
      throw new Error(`Invalid library section: ${title}. Available: ${availableSections}`);
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
   * Creates a library section and returns the newly created typed section.
   *
   * Pass server-visible paths in `locations`. Preference keys should be bare Plex
   * setting ids; this method encodes them as `prefs[...]`.
   *
   * @example
   * ```ts
   * const section = await library.add({
   *   name: 'Movies',
   *   type: 'movie',
   *   agent: 'tv.plex.agents.movie',
   *   scanner: 'Plex Movie',
   *   locations: ['/data/Movies', '/data/Archived Movies'],
   *   preferences: { enableBIFGeneration: false },
   * })
   * ```
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
  async add<T extends LibrarySectionCreateType>(
    options: LibraryAddOptions<T>,
  ): Promise<SectionForCreateType<T>>;
  async add({
    name,
    type,
    agent,
    scanner,
    locations,
    language = 'en-US',
    preferences = {},
  }: LibraryAddOptions): Promise<Section> {
    const search = new URLSearchParams({
      name,
      type,
      agent,
      scanner,
      language,
    });
    const locationList = typeof locations === 'string' ? [locations] : locations;
    for (const location of locationList) {
      search.append('location', location);
    }

    for (const [key, value] of Object.entries(preferences)) {
      search.append(`prefs[${key}]`, settingValueToQueryValue(value));
    }

    const url = `/library/sections?${search.toString()}`;
    await this.server.query({ path: url, method: 'post' });
    return this.section(name);
  }

  /**
   * Returns hubs across all library sections.
   */
  async hubs({ sectionID, identifier, ...options }: LibraryHubsOptions = {}): Promise<Hub[]> {
    const params: Record<string, QueryParamValue> = {};
    for (const [key, value] of Object.entries(options)) {
      params[key] = normalizeLibraryHubOption(value);
    }

    if (sectionID !== undefined) {
      params.contentDirectoryID = normalizeLibraryHubOption(sectionID);
    }

    if (identifier !== undefined) {
      params.identifier = normalizeLibraryHubOption(identifier);
    }

    const key = buildQueryKey('/hubs', params);
    return fetchItems<Hub>(this.server, key, undefined, Hub, this);
  }

  /**
   * Returns a list of all on-deck items from all library sections.
   * On-deck items are media that is currently in progress.
   */
  async onDeck(): Promise<LibrarySearchItem[]> {
    const key = buildQueryKey('/library/onDeck');
    return fetchLibrarySearchItems(this.server, key);
  }

  /**
   * Returns media from every library section.
   *
   * Use the options object for sorting, paging, and type-specific results. When
   * `libtype` is provided, each section is asked for that Plex item type and the
   * returned array is typed to the matching model.
   *
   * @example
   * ```ts
   * const everything = await library.all()
   * const movies = await library.all({ libtype: 'movie', sort: 'titleSort', maxResults: 25 })
   * ```
   */
  async all<T extends Libtype>(
    options: LibrarySectionAllOptions & { libtype: T },
  ): Promise<Array<SearchClassForLibtype<T>>>;
  async all(): Promise<SectionType[]>;
  async all(options: LibrarySectionAllOptions): Promise<LibrarySearchItem[]>;
  async all(options: LibrarySectionAllOptions = {}): Promise<LibrarySearchItem[]> {
    const sections = await this.sections();
    const sectionItems = await Promise.all(sections.map(section => section.all(options)));
    return sectionItems.flat();
  }

  /**
   * Returns recently added media from all library sections.
   */
  async recentlyAdded(): Promise<LibrarySearchItem[]> {
    const key = buildQueryKey('/library/recentlyAdded');
    return fetchLibrarySearchItems(this.server, key);
  }

  /**
   * Search across all library sections. Section search is more powerful and validates filters.
   */
  async search<T extends Libtype>(
    options: LibrarySearchOptions & { libtype: T },
  ): Promise<Array<SearchClassForLibtype<T>>>;
  async search(options?: LibrarySearchOptions): Promise<LibrarySearchItem[]>;
  async search({ title, libtype, ...filters }: LibrarySearchOptions = {}): Promise<
    LibrarySearchItem[]
  > {
    const params: Record<string, QueryParamValue> = { ...filters };
    if (title !== undefined) {
      params.title = title;
    }

    if (libtype !== undefined) {
      params.type = searchType(libtype);
    }

    const key = buildQueryKey('/library/all', params);
    return fetchLibrarySearchItems(this.server, key);
  }

  /**
   * Clean old metadata bundles from the server.
   */
  async cleanBundles(): Promise<void> {
    await this.server.query({ path: '/library/clean/bundles?async=1', method: 'put' });
  }

  /**
   * If a library has items in the Library Trash, use this option to empty the Trash.
   */
  async emptyTrash(): Promise<void> {
    const sections = await this.sections();
    await Promise.all(sections.map(section => section.emptyTrash()));
  }

  /**
   * The Optimize option cleans up the server database from unused or fragmented data.
   * For example, if you have deleted or added an entire library or many items in a
   * library, you may like to optimize the database.
   */
  async optimize(): Promise<void> {
    await this.server.query({ path: '/library/optimize?async=1', method: 'put' });
  }

  /**
   * Scan every library section for new media.
   */
  async update(): Promise<void> {
    await this.server.query({ path: '/library/sections/all/refresh' });
  }

  /**
   * Cancel an active full-library scan.
   */
  async cancelUpdate(): Promise<void> {
    await this.server.query({ path: '/library/sections/all/refresh', method: 'delete' });
  }

  /**
   * Force refresh metadata for every library section.
   */
  async refresh(): Promise<void> {
    await this.server.query({ path: '/library/sections/all/refresh?force=1' });
  }

  /**
   * Delete preview thumbnails for all library sections.
   */
  async deleteMediaPreviews(): Promise<void> {
    const sections = await this.sections();
    await Promise.all(sections.map(section => section.deleteMediaPreviews()));
  }

  /**
   * Get watched history for all library sections for the owner.
   */
  async history(options: LibraryHistoryOptions = {}): Promise<HistoryResult[]> {
    const sections = await this.sections();
    const sectionHistory = await Promise.all(sections.map(section => section.history(options)));
    return sectionHistory.flat();
  }

  /**
   * Returns global library tags for the requested Plex tag type.
   *
   * Prefer named tag types like `'genre'`, `'director'`, or `'label'` so the
   * result is typed to the corresponding tag class. Numeric Plex tag type ids are
   * accepted for less common tags and return generic {@link LibraryMediaTag}
   * objects.
   *
   * @example
   * ```ts
   * const genres = await library.tags('genre') // Genre[]
   * const custom = await library.tags(400) // LibraryMediaTag[]
   * ```
   */
  async tags<T extends LibraryTagName>(tag: T): Promise<Array<LibraryTagItemFor<T>>>;
  async tags(tag: LibraryTagType): Promise<LibraryMediaTag[]>;
  async tags(tag: LibraryTagType): Promise<Array<LibraryMediaTag | (MediaTag & LibraryTagItems)>> {
    const tagType = resolveLibraryTagType(tag);
    const data = await this.server.query<MediaContainer<{ Directory?: LibraryTagData[] }>>({
      path: `/library/tags?type=${tagType.toString()}`,
    });
    const Cls = classForLibraryTag(tag);
    return (data.MediaContainer.Directory ?? []).map(item =>
      withLibraryTagItems(new Cls(this.server, item, undefined, this), item),
    );
  }

  protected _loadData(data: LibraryRootResponse): void {
    this.size = data.size;
    this.allowSync = data.allowSync;
    this.art = data.art;
    this.content = data.content;
    this.identifier = data.identifier;
    this.mediaTagPrefix = data.mediaTagPrefix;
    this.mediaTagVersion = data.mediaTagVersion;
    this.title1 = data.title1;
    this.title2 = data.title2;
    this.directories = data.Directory;
  }
}

export type Libtype = keyof typeof SEARCHTYPES;

/**
 * Generic library tag returned when Plex exposes a tag type that does not have a
 * dedicated media tag class in this package.
 *
 * Prefer {@link Library.tags} with a named tag type such as `'genre'` or
 * `'director'` when one is available. Numeric tag types use this fallback shape.
 */
export class LibraryMediaTag extends PlexObject implements LibraryTagItems {
  static override TAG = 'Directory';
  FILTER = 'tag';

  declare count?: number;
  declare filter?: string;
  declare id?: number | string;
  declare librarySectionID?: number;
  declare librarySectionKey?: string;
  declare librarySectionTitle?: string;
  declare librarySectionType?: number;
  declare reason?: string;
  declare reasonID?: number;
  declare reasonTitle?: string;
  declare score?: number;
  declare type?: string;
  declare tag: string;
  declare tagKey?: string;
  declare tagType?: number;
  declare tagValue?: number;
  declare thumb?: string;

  async items(): Promise<LibrarySearchItem[]> {
    return libraryTagItems(this);
  }

  protected _loadData(data: LibraryTagData): void {
    loadLibraryTagData(this, data);
  }
}

const LIBRARY_TAG_CLASSES = {
  tag: Tag,
  genre: Genre,
  collection: Collection,
  director: Director,
  writer: Writer,
  role: Role,
  producer: Producer,
  country: Country,
  chapter: Chapter,
  label: Label,
  marker: Marker,
  mood: Mood,
  style: Style,
  format: Format,
  subformat: Subformat,
  similar: Similar,
} satisfies Partial<Record<LibraryTagName, Class<MediaTag>>>;

export interface SearchArgs {
  [key: string]: SearchArgValue;
  /** General string query to search for. Partial string matches are allowed. */
  title: string | string[];
  /** A string of comma separated sort fields or a list of sort fields in the format ``column:dir``. */
  sort: string | string[] | FilteringSort | FilteringSort[];
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
  /** Include GUID data in metadata responses. Defaults to true. */
  includeGuids: boolean;
  /** Advanced filters object used by music searches. */
  filters?: AdvancedSearchFilters;
}

export interface HubSearchOptions {
  /** Optionally limit search results to a media type. */
  mediatype?: keyof typeof SEARCHTYPES;
  /** Limit the number of results per hub. */
  limit?: number;
}

export interface PlaylistSearchOptions {
  sort?: string;
  [filter: string]: ItemFilterValue | undefined;
}

export interface ManagedHubVisibilityOptions {
  /** Show or hide this hub on the library Recommended tab. */
  recommended?: boolean;
  /** Show or hide this hub on the owner's Home page. */
  home?: boolean;
  /** Show or hide this hub on shared users' Home pages. */
  shared?: boolean;
}

type RequireAtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<Omit<T, K>>;
}[keyof T];
export type ManagedHubVisibilityChanges = RequireAtLeastOne<ManagedHubVisibilityOptions>;
export type SectionAdvancedSettings = Record<string, SettingValue>;
export type LibrarySectionHistoryOptions = Omit<HistoryOptions, 'librarySectionId'>;
/**
 * Values accepted by {@link LibrarySection.edit}.
 *
 * Use this for section-level edits where Plex expects the full replacement list
 * of locations. For simple path changes, prefer {@link LibrarySection.addLocations}
 * and {@link LibrarySection.removeLocations}; they preserve the current paths for
 * you.
 */
export interface LibrarySectionEditOptions {
  /** Library agent identifier. Defaults to the section's current agent. */
  agent?: string;
  /** Full replacement list of folder paths for this library section. */
  locations?: string | readonly string[];
  /** Additional section edit parameters or Plex preference keys. Boolean values are sent as `1` or `0`. */
  preferences?: Record<string, SettingValue>;
}
export interface LibrarySectionUpdateOptions {
  /** Full folder path to scan within this section. */
  path?: string;
}
export type LibrarySectionGetOptions = Omit<
  Partial<SearchArgs>,
  'libtype' | 'limit' | 'maxresults' | 'title'
> & {
  /** Return a specific Plex item type instead of the section default. */
  libtype?: Libtype;
  /** Exact item title to return. */
  title: string;
};
export type LibrarySectionAllOptions = Omit<Partial<SearchArgs>, 'libtype' | 'maxresults'> & {
  /**
   * Return a specific library item type instead of the section default.
   *
   * Passing this narrows `section.all({ libtype })` to the matching model type.
   */
  libtype?: Libtype;
  /**
   * Maximum number of items to return.
   *
   * Plex may ignore the container size hint on some endpoints, so this method also
   * applies the limit locally before returning.
   */
  maxResults?: number;
};

export type SectionType = Movie | Show | Artist | Album | Track | Photoalbum;
export type LibrarySearchItem = SectionType | Season | Episode | Clip | Photo | Collections;
export type HubItem = LibrarySearchItem | Playlist;
export type RatingKeyItem = { ratingKey?: number | string };
type SearchTagValue = { id: number | string; tag?: string } | { id?: number | string; tag: string };
export type SearchFilterPrimitive =
  | boolean
  | Date
  | FilterChoice
  | number
  | SearchTagValue
  | string;
export type SearchFilterValue = SearchFilterPrimitive | SearchFilterPrimitive[];
export type SearchArgValue =
  | AdvancedSearchFilters
  | FilteringSort
  | FilteringSort[]
  | SearchFilterValue
  | undefined;
export type AdvancedSearchFilters = {
  [field: string]: AdvancedSearchFilters[] | SearchFilterValue;
  and?: AdvancedSearchFilters[];
  or?: AdvancedSearchFilters[];
};
type LibraryItemParent = {
  key?: number | string;
  librarySectionID?: number | string;
  parent?: WeakRef<LibraryItemParent>;
};
export type EditableLibraryItem = LibrarySearchItem & {
  librarySectionID?: number | string;
  parent?: WeakRef<LibraryItemParent>;
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
              : T extends 'photoalbum'
                ? Photoalbum
                : T extends 'photo'
                  ? Photo
                  : T extends 'clip'
                    ? Clip
                    : SectionType;
type SearchBuildResult = {
  key: string;
  localFilters: Record<string, ItemFilterValue>;
};
type SplitSearchFilters = {
  localFilters: Record<string, ItemFilterValue>;
  serverFilters: SearchParamEntry[];
};
type CollectionItemClass<T extends RatingKeyItem> = Class<T>;
type ParsedFilterField = {
  field: string;
  libtype?: Libtype;
  operator: string;
};
type ParsedSortField = {
  direction: string;
  field: string;
  libtype?: Libtype;
};
type DurationStorage = {
  duration: number | null;
  storage: number | null;
};

const COLLECTION_MODE_VALUES = {
  default: -1,
  hide: 0,
  hideItems: 1,
  showItems: 2,
} as const;

const COLLECTION_SORT_VALUES = {
  release: 0,
  alpha: 1,
  custom: 2,
} as const;

type CollectionMode = keyof typeof COLLECTION_MODE_VALUES;
type CollectionSort = keyof typeof COLLECTION_SORT_VALUES;

export interface SmartCollectionSearchOptions extends Omit<SmartPlaylistSearchOptions, 'libtype'> {
  /** Media type searched by the smart collection. */
  libtype?: Libtype;
}

export interface CreateRegularCollectionOptions<T extends RatingKeyItem> {
  /** Library section that will own the collection. */
  section: LibrarySection<T>;
  /** Items in the regular collection. */
  items: RatingKeyItem[];
  smart?: false;
}

export interface CreateSmartCollectionOptions<T extends RatingKeyItem> {
  /** Library section that will own the collection. */
  section: LibrarySection<T>;
  /** Create a dynamic collection backed by a validated library search. */
  smart: true;
  /** Search used to populate the collection. */
  search?: SmartCollectionSearchOptions;
}

export type CreateCollectionOptions<T extends RatingKeyItem> =
  | CreateRegularCollectionOptions<T>
  | CreateSmartCollectionOptions<T>;
type SearchParamEntry = [string, string];
type SearchFilterField = Pick<FilteringField, 'key' | 'type'>;
type LibrarySearchMetadata = NonNullable<SearchResultContainer['Metadata']>[number];
type ManualFilteringField = Pick<FilteringFieldData, 'key' | 'title' | 'type'>;
type ManualFilteringFilter = Pick<FilteringFilterData, 'filter' | 'filterType' | 'title'>;
type ManualFilteringSort = Pick<FilteringSortData, 'defaultDirection' | 'key' | 'title'>;
const FILTER_VALUE_TYPES = [
  'audioLanguage',
  'boolean',
  'date',
  'guid',
  'integer',
  'resolution',
  'string',
  'subtitleLanguage',
  'tag',
] as const;
type FilterValueType = (typeof FILTER_VALUE_TYPES)[number];
const CHOICE_FILTER_VALUE_TYPES = new Set<FilterValueType>([
  'audioLanguage',
  'resolution',
  'subtitleLanguage',
  'tag',
]);

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return Number(value);
}

function settingValueToQueryValue(value: SettingValue): string {
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  return value.toString();
}

function loadLibraryTagData(tag: LibraryTagItems & PlexObject, data: LibraryTagData): void {
  tag.key = data.key ?? '';
  tag.count = parseOptionalNumber(data.count);
  tag.id = data.id;
  tag.filter = data.filter;
  tag.librarySectionID = parseOptionalNumber(data.librarySectionID);
  tag.librarySectionKey = data.librarySectionKey;
  tag.librarySectionTitle = data.librarySectionTitle;
  tag.librarySectionType = parseOptionalNumber(data.librarySectionType);
  tag.reason = data.reason;
  tag.reasonID = parseOptionalNumber(data.reasonID);
  tag.reasonTitle = data.reasonTitle;
  tag.score = parseOptionalNumber(data.score);
  tag.type = data.type;
  tag.tag = data.tag;
  tag.tagKey = data.tagKey;
  tag.tagType = parseOptionalNumber(data.tagType);
  tag.tagValue = parseOptionalNumber(data.tagValue);
  tag.thumb = data.thumb;
}

async function libraryTagItems(tag: LibraryTagItems & PlexObject): Promise<LibrarySearchItem[]> {
  const key = tag.key || (tag.filter ? `/library/all?${tag.filter}` : undefined);
  if (!key) {
    throw new BadRequest(`Key is not defined for this tag: ${tag.tag}`);
  }

  return fetchLibrarySearchItems(tag.server, buildQueryKey(key), tag);
}

function withLibraryTagItems<T extends MediaTag | LibraryMediaTag>(
  tag: T,
  data: LibraryTagData,
): T & LibraryTagItems {
  const tagged = tag as T & LibraryTagItems;
  loadLibraryTagData(tagged, data);
  tagged.items = async () => libraryTagItems(tagged);
  return tagged;
}

function isItemFilterValue(value: SearchArgValue): value is ItemFilterValue {
  return (
    ['boolean', 'number', 'string'].includes(typeof value) ||
    (Array.isArray(value) &&
      value.every(item => ['boolean', 'number', 'string'].includes(typeof item)))
  );
}

function isFilterValueType(type: string): type is FilterValueType {
  return FILTER_VALUE_TYPES.includes(type as FilterValueType);
}

function isLibraryHubOptionArray(
  value: LibraryHubOptionValue,
): value is ReadonlyArray<string | number> {
  return Array.isArray(value);
}

function normalizeLibraryHubOption(value: LibraryHubOptionValue): QueryParamValue {
  if (isLibraryHubOptionArray(value)) {
    return value.join(',');
  }

  return value;
}

function isAdvancedFilterGroupValue(
  value: AdvancedSearchFilters[] | SearchFilterValue,
): value is AdvancedSearchFilters[] {
  return (
    Array.isArray(value) &&
    value.every(
      item =>
        typeof item === 'object' &&
        item !== null &&
        !(item instanceof Date) &&
        !(item instanceof FilterChoice),
    )
  );
}

function isSearchTagValue(value: SearchFilterPrimitive): value is SearchTagValue {
  return typeof value === 'object' && value !== null && !(value instanceof Date);
}

function advancedFilterGroupOperator(field: string): 'and' | 'or' | undefined {
  const normalizedField = field.toLowerCase();
  return normalizedField === 'and' || normalizedField === 'or' ? normalizedField : undefined;
}

function resolveRequestedLibtype(parsed: string | undefined, fallback: Libtype): Libtype {
  return (parsed as Libtype | undefined) ?? fallback;
}

function parseFilterField(field: string): ParsedFilterField {
  const match = /^(?:([a-zA-Z]*)\.)?([a-zA-Z]+)([!<>=&]*)$/.exec(field);
  if (!match) {
    throw new BadRequest(`Invalid filter field "${field}".`);
  }

  const [, libtype, parsedField, operator] = match;
  return { field: parsedField, libtype: libtype as Libtype | undefined, operator };
}

function parseSortField(sort: string): ParsedSortField {
  const match = /^(?:([a-zA-Z]*)\.)?([a-zA-Z]+):?([a-zA-Z]*)$/.exec(sort.trim());
  if (!match) {
    throw new BadRequest(`Invalid sort "${sort}".`);
  }

  const [, libtype, field, direction] = match;
  return { direction, field, libtype: libtype as Libtype | undefined };
}

function parseFilterChoiceField(field: string): Pick<ParsedFilterField, 'field' | 'libtype'> {
  const parsed = parseFilterField(field);
  if (parsed.operator) {
    throw new BadRequest(`Invalid filter field: ${field}`);
  }

  return parsed;
}

function reverseSearchType(type: string | number | null): Libtype | undefined {
  const entry = Object.entries(SEARCHTYPES).find(([, value]) => value.toString() === `${type}`);
  return entry?.[0] as Libtype | undefined;
}

function isLibtype(value: string): value is Libtype {
  return Object.hasOwn(SEARCHTYPES, value);
}

function isLibraryTagName(tag: LibraryTagType): tag is LibraryTagName {
  return typeof tag === 'string' && Object.hasOwn(LIBRARY_TAG_TYPES, tag);
}

function resolveLibraryTagType(tag: LibraryTagType): number {
  if (typeof tag === 'number') {
    return tag;
  }

  if (isLibraryTagName(tag)) {
    return LIBRARY_TAG_TYPES[tag];
  }

  const tagType = Number(tag);
  if (Number.isInteger(tagType)) {
    return tagType;
  }

  throw new NotFound(`Unknown library tag type: ${tag}`);
}

function classForLibraryTag(tag: LibraryTagType): Class<LibraryMediaTag | MediaTag> {
  if (!isLibraryTagName(tag)) {
    return LibraryMediaTag;
  }

  return LIBRARY_TAG_CLASSES[tag] ?? LibraryMediaTag;
}

function classForLibtype(libtype?: string): Class<LibrarySearchItem> | undefined {
  if (libtype === 'collection') {
    return Collections;
  }

  return libtype && isLibtype(libtype)
    ? (classForPlexType(libtype) as Class<LibrarySearchItem> | undefined)
    : undefined;
}

function createLibrarySearchItem(
  server: PlexServer,
  data: LibrarySearchMetadata,
  parent?: PlexObject,
): LibrarySearchItem {
  if (data.type === 'collection') {
    return new Collections(server, data as unknown as CollectionData, undefined, parent);
  }

  return createPlexItem(server, data, undefined, parent) as LibrarySearchItem;
}

async function fetchLibrarySearchItems(
  server: PlexServer,
  key: string,
  parent?: PlexObject,
): Promise<LibrarySearchItem[]> {
  const items = await fetchItems<LibrarySearchMetadata>(server, key);
  return items.map(item => createLibrarySearchItem(server, item, parent));
}

function createHubItem<T extends HubItem>(
  server: PlexServer,
  data: LibrarySearchMetadata,
  parent: PlexObject,
  Cls?: Class<T>,
): T {
  if (Cls) {
    return new Cls(server, data, undefined, parent);
  }

  if (data.type === 'station' || data.type === 'playlist') {
    return new Playlist(server, data, undefined, parent) as T;
  }

  return createLibrarySearchItem(server, data, parent) as T;
}

// Plex filter metadata is incomplete on some servers. Keep server-provided
// entries first and append manual entries only when the key is missing.
function addUniqueByKey<T extends { key: string }>(items: T[], additions: T[]): T[] {
  const existingKeys = new Set(items.map(item => item.key));
  return [...items, ...additions.filter(item => !existingKeys.has(item.key))];
}

function findLibraryProviderDirectory(
  container: MediaProvidersResponse,
  sectionKey: string | number,
): MediaProviderDirectoryData | undefined {
  return (container.MediaProvider ?? [])
    .filter(provider => provider.identifier === 'com.plexapp.plugins.library')
    .flatMap(provider => provider.Feature ?? [])
    .filter(feature => feature.type === 'content')
    .flatMap(feature => feature.Directory ?? [])
    .find(directory => String(directory.id) === String(sectionKey));
}

/**
 * Fields accepted by Plex search but not reliably advertised in filter metadata.
 * This mirrors Python PlexAPI's manual field list without constructing XML.
 */
const MANUAL_FILTERING_FIELDS: Record<string, ManualFilteringField[]> = {
  movie: [
    { key: 'audienceRating', title: 'Audience Rating', type: 'integer' },
    { key: 'rating', title: 'Critic Rating', type: 'integer' },
    { key: 'viewOffset', title: 'View Offset', type: 'integer' },
  ],
  show: [
    { key: 'show.audienceRating', title: 'Audience Rating', type: 'integer' },
    { key: 'show.originallyAvailableAt', title: 'Show Release Date', type: 'date' },
    { key: 'show.rating', title: 'Critic Rating', type: 'integer' },
    { key: 'show.unviewedLeafCount', title: 'Episode Unplayed Count', type: 'integer' },
  ],
  season: [
    { key: 'season.addedAt', title: 'Date Season Added', type: 'date' },
    { key: 'season.unviewedLeafCount', title: 'Episode Unplayed Count', type: 'integer' },
    { key: 'season.year', title: 'Season Year', type: 'integer' },
    { key: 'season.label', title: 'Label', type: 'tag' },
  ],
  episode: [
    { key: 'episode.audienceRating', title: 'Audience Rating', type: 'integer' },
    { key: 'episode.duration', title: 'Duration', type: 'integer' },
    { key: 'episode.rating', title: 'Critic Rating', type: 'integer' },
    { key: 'episode.viewOffset', title: 'View Offset', type: 'integer' },
    { key: 'episode.label', title: 'Label', type: 'tag' },
  ],
  artist: [{ key: 'artist.label', title: 'Label', type: 'tag' }],
  track: [
    { key: 'track.duration', title: 'Duration', type: 'integer' },
    { key: 'track.viewOffset', title: 'View Offset', type: 'integer' },
    { key: 'track.label', title: 'Label', type: 'tag' },
    { key: 'track.ratingCount', title: 'Rating Count', type: 'integer' },
  ],
  collection: [
    { key: 'collection.addedAt', title: 'Date Added', type: 'date' },
    { key: 'collection.label', title: 'Label', type: 'tag' },
  ],
};

const MANUAL_FILTERING_FILTERS: Record<string, ManualFilteringFilter[]> = {
  artist: [{ filter: 'label', filterType: 'string', title: 'Labels' }],
  collection: [{ filter: 'label', filterType: 'string', title: 'Labels' }],
  episode: [{ filter: 'label', filterType: 'string', title: 'Labels' }],
  season: [{ filter: 'label', filterType: 'string', title: 'Labels' }],
  track: [{ filter: 'label', filterType: 'string', title: 'Labels' }],
};

const MANUAL_FILTERING_SORTS: Record<string, ManualFilteringSort[]> = {
  season: [{ defaultDirection: 'asc', key: 'titleSort', title: 'Title' }],
  track: [{ defaultDirection: 'asc', key: 'absoluteIndex', title: 'Absolute Index' }],
  photo: [{ defaultDirection: 'desc', key: 'viewUpdatedAt', title: 'View Updated At' }],
  collection: [{ defaultDirection: 'asc', key: 'addedAt', title: 'Date Added' }],
};

function titleizeLibtype(libtype: string): string {
  return `${libtype[0].toUpperCase()}${libtype.slice(1)}`;
}

function manualFilteringFields(libtype: string): ManualFilteringField[] {
  // Python sends movie manual fields without a `movie.` prefix; other libtypes
  // need the libtype prefix for Plex to accept them.
  const prefix = libtype === 'movie' ? '' : `${libtype}.`;
  return [
    { key: `${prefix}guid`, title: 'Guid', type: 'guid' },
    { key: `${prefix}id`, title: 'Rating Key', type: 'integer' },
    {
      key: `${prefix}index`,
      title: `${titleizeLibtype(libtype)} Number`,
      type: 'integer',
    },
    {
      key: `${prefix}lastRatedAt`,
      title: `${titleizeLibtype(libtype)} Last Rated`,
      type: 'date',
    },
    { key: `${prefix}updatedAt`, title: 'Date Updated', type: 'date' },
    { key: 'group', title: 'SQL Group By Statement', type: 'string' },
    { key: 'having', title: 'SQL Having Clause', type: 'string' },
    ...(MANUAL_FILTERING_FIELDS[libtype] ?? []),
  ];
}

/**
 * Label choice endpoints exist for these secondary libtypes even when Plex
 * leaves them out of the advertised filter menu metadata.
 */
function manualFilteringFilters(libtype: string, sectionKey?: string): FilteringFilterData[] {
  return (MANUAL_FILTERING_FILTERS[libtype] ?? []).map(filter => ({
    ...filter,
    key: `/library/sections/${sectionKey ?? ''}/${filter.filter}?type=${searchType(libtype)}`,
    type: 'filter',
  }));
}

/**
 * Sorts accepted by Plex search but often omitted from the advertised sort list.
 */
function manualFilteringSorts(libtype: string): FilteringSortData[] {
  const sorts: ManualFilteringSort[] = [
    { defaultDirection: 'asc', key: 'guid', title: 'Guid' },
    { defaultDirection: 'asc', key: 'id', title: 'Rating Key' },
    {
      defaultDirection: 'asc',
      key: 'index',
      title: `${titleizeLibtype(libtype)} Number`,
    },
    { defaultDirection: 'asc', key: 'summary', title: 'Summary' },
    { defaultDirection: 'asc', key: 'tagline', title: 'Tagline' },
    { defaultDirection: 'asc', key: 'updatedAt', title: 'Date Updated' },
    ...(MANUAL_FILTERING_SORTS[libtype] ?? []),
  ];

  return sorts.map(sort => ({
    ...sort,
    descKey: `${sort.key}:desc`,
  }));
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
  /** Default item type used by smart filters in this section. */
  declare METADATA_TYPE: Libtype;
  readonly SECTION_TYPE!: Class<SType>;

  declare _filterTypes?: FilteringType[];
  declare _fieldTypes?: FilteringFieldType[];

  private _durationStorageCache?: DurationStorage;

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
    return this.edit({ locations: allPaths });
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
    return this.edit({ locations: remaining });
  }

  /**
   * Returns all items from this library section.
   *
   * Use an options object for sorting, filters, paging, and type-specific results.
   * When `libtype` is omitted, the section default model is returned. When `libtype`
   * is provided, the returned array is typed to that Plex item type.
   *
   * @example
   * ```ts
   * const movies = await movieSection.all()
   * const sorted = await movieSection.all({ sort: 'titleSort', maxResults: 25 })
   * const episodes = await showSection.all({ libtype: 'episode', sort: 'episode.originallyAvailableAt' })
   * ```
   */
  async all<T extends Libtype>(
    options: LibrarySectionAllOptions & { libtype: T },
  ): Promise<Array<SearchClassForLibtype<T>>>;
  async all(): Promise<SType[]>;
  async all(options: LibrarySectionAllOptions): Promise<LibrarySearchItem[]>;
  async all(options: LibrarySectionAllOptions = {}): Promise<SType[] | LibrarySearchItem[]> {
    const { maxResults, ...searchArgs } = options;
    const args: Partial<SearchArgs> = { ...searchArgs };
    if (maxResults !== undefined) {
      args.maxresults = maxResults;
    }

    const items = await this.search(args, this._classForSearch(args.libtype));
    return maxResults === undefined ? items : items.slice(0, maxResults);
  }

  async agents(): Promise<Agent[]> {
    return this.server.agents(searchType(this.type));
  }

  /**
   * Returns the advanced preference settings for this library section.
   */
  async settings(): Promise<Setting[]> {
    const key = `/library/sections/${this.key}/prefs`;
    const data = await this.server.query<MediaContainer<{ Setting?: SettingResponse[] }>>({
      path: key,
    });
    return (data.MediaContainer.Setting ?? []).map(
      setting => new Setting(this.server, setting, key, this),
    );
  }

  /**
   * Returns one item by exact title, optionally narrowed with normal search filters.
   *
   * Use filters to disambiguate duplicate titles. When `libtype` is provided,
   * the returned item is typed to that Plex model.
   *
   * @example
   * ```ts
   * const movie = await movieSection.get({ title: 'Big Buck Bunny', year: 2008 })
   * const episode = await showSection.get({ title: 'Minimum Viable Product', libtype: 'episode' })
   * ```
   */
  async get<T extends Libtype>(
    options: LibrarySectionGetOptions & { libtype: T },
  ): Promise<SearchClassForLibtype<T>>;
  async get(options: LibrarySectionGetOptions): Promise<SType>;
  async get(options: LibrarySectionGetOptions): Promise<SType | LibrarySearchItem> {
    const { title, libtype, ...filters } = options;
    const args: Partial<SearchArgs> = {
      ...filters,
      ...(libtype === undefined ? {} : { libtype }),
      title,
      title__iexact: title,
    };

    const items = await this.search(args, this._classForSearch(libtype));
    const [item] = items;
    if (!item) {
      const filterNames = Object.entries(filters)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key);
      const filterDescription =
        filterNames.length > 0 ? ` and filters ${filterNames.join(', ')}` : '';
      throw new NotFound(`Unable to find item with title "${title}"${filterDescription}.`);
    }

    return item;
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
    return fetchItem(this.server, key, { Guid__id__iexact: guid }, this.SECTION_TYPE, this);
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
    const { key, localFilters } = await this._buildSearchKey(args);
    const ClsToUse = Cls ?? this._classForSearch(args.libtype);
    const data = await fetchItems(this.server, key, localFilters, ClsToUse, this, {
      containerSize: args.container_size,
      containerStart: args.container_start,
      maxResults: args.maxresults,
    });
    return data;
  }

  /**
   * Build and validate a server-side search key for smart playlists and collections.
   * Local-only filters are rejected because Plex cannot persist them in a smart filter.
   */
  async buildSearchKey(args: Partial<SearchArgs> = {}): Promise<string> {
    const { key, localFilters } = await this._buildSearchKey(args);
    const localFilterNames = Object.keys(localFilters);
    if (localFilterNames.length > 0) {
      throw new BadRequest(
        `Smart filters require server-side fields. Unsupported filters: ${localFilterNames.join(', ')}`,
      );
    }

    return key;
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
   * Scan this section for new media.
   */
  async update({ path }: LibrarySectionUpdateOptions = {}): Promise<void> {
    const key = `/library/sections/${this.key}/refresh`;
    await this.server.query({
      path: path === undefined ? key : `${key}?${new URLSearchParams({ path }).toString()}`,
    });
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
   * Edit this library section's agent, locations, or raw Plex preferences.
   *
   * `locations` replaces the section's complete path list. To add or remove one
   * path while preserving the rest, use {@link addLocations} or
   * {@link removeLocations}.
   *
   * @example
   * ```ts
   * await movieSection.edit({
   *   agent: 'com.plexapp.agents.imdb',
   *   locations: ['/media/movies', '/media/archived-movies'],
   *   preferences: { includeInGlobal: true },
   * })
   * ```
   */
  async edit({
    agent = this.agent,
    locations,
    preferences = {},
  }: LibrarySectionEditOptions = {}): Promise<Section> {
    const params = new URLSearchParams({ agent });
    for (const [key, value] of Object.entries(preferences)) {
      params.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : value.toString());
    }

    if (typeof locations === 'string') {
      params.append('location', locations);
    } else {
      for (const location of locations ?? []) {
        params.append('location', location);
      }
    }

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
   * Edit this library section's advanced preference settings.
   */
  async editAdvanced(changes: SectionAdvancedSettings): Promise<Section> {
    const settings = new Map((await this.settings()).map(setting => [setting.id, setting]));
    const params: Record<string, string> = {};

    for (const [id, value] of Object.entries(changes)) {
      const setting = settings.get(id);
      if (!setting) {
        throw new NotFound(`${id} not found in ${[...settings.keys()].join(', ')}`);
      }

      setting.set(value);
      params[`prefs[${setting.id}]`] = setting.toQueryValue();
    }

    return this.edit({ preferences: params });
  }

  /**
   * Reset this library section's advanced preference settings to their defaults.
   */
  async defaultAdvanced(): Promise<Section> {
    const params: Record<string, string> = {};
    for (const setting of await this.settings()) {
      setting.set(setting.default);
      params[`prefs[${setting.id}]`] = setting.toQueryValue();
    }

    return this.edit({ preferences: params });
  }

  /**
   * Get watched history for this library section.
   */
  async history({ accountId = 1, ...options }: LibrarySectionHistoryOptions = {}): Promise<
    HistoryResult[]
  > {
    return this.server.history({
      ...options,
      accountId,
      librarySectionId: this.key,
    });
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

  async hubs(options: LibrarySectionHubsOptions = {}): Promise<Hub[]> {
    const key = this._buildQueryKey(`/hubs/sections/${this.key}`, {
      includeStations: true,
      ...options,
    });
    const hubs = await fetchItems<Hub>(this.server, key, undefined, Hub, this);
    return hubs;
  }

  /**
   * Returns section-scoped hub search results.
   */
  async hubSearch(query: string, { mediatype, limit }: HubSearchOptions = {}): Promise<Hub[]> {
    const params: Record<string, string> = {
      includeCollections: '1',
      includeExternalMedia: '1',
      query,
      sectionId: this.key.toString(),
    };
    if (limit !== undefined) {
      params.limit = limit.toString();
    }

    if (mediatype !== undefined) {
      params.section = SEARCHTYPES[mediatype].toString();
    }

    const key = `/hubs/search?${new URLSearchParams(params).toString()}`;
    return fetchItems<Hub>(this.server, key, undefined, Hub, this);
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
  async playlists(args: PlaylistSearchOptions = {}): Promise<Playlist[]> {
    const { sort, ...filterOptions } = args;
    const filters: Record<string, ItemFilterValue> = {};
    for (const [key, value] of Object.entries(filterOptions)) {
      if (value !== undefined) {
        filters[key] = value;
      }
    }

    const params = new URLSearchParams({
      type: '15',
      playlistType: this.CONTENT_TYPE,
      sectionID: this.key,
    });
    if (sort !== undefined) {
      params.set('sort', sort);
    }

    const key = `/playlists?${params.toString()}`;
    return fetchItems<Playlist>(this.server, key, filters, Playlist, this);
  }

  /**
   * Create a regular or smart playlist scoped to this library section.
   */
  async createPlaylist(
    title: string,
    options: CreateRegularPlaylistOptions | Omit<CreateSmartPlaylistOptions, 'section'>,
  ): Promise<Playlist> {
    if (!('items' in options)) {
      return Playlist.create(this.server, title, { ...options, section: this });
    }

    return Playlist.create(this.server, title, options);
  }

  /**
   * Returns the playlist with the exact title.
   */
  async playlist(title: string): Promise<Playlist> {
    const [playlist] = await this.playlists({ title, title__iexact: title });
    if (!playlist) {
      throw new NotFound(`Unable to find playlist with title "${title}".`);
    }

    return playlist;
  }

  async collections(
    args: Record<string, number | string | boolean> = {},
  ): Promise<Array<Collections<SType>>> {
    return this.search<Collections<SType>>({ ...args, libtype: 'collection' }, Collections);
  }

  /**
   * Create a regular collection in this library section.
   */
  async createCollection(title: string, items: RatingKeyItem[]): Promise<Collections<SType>>;
  async createCollection(
    title: string,
    options:
      | Omit<CreateRegularCollectionOptions<RatingKeyItem>, 'section'>
      | Omit<CreateSmartCollectionOptions<RatingKeyItem>, 'section'>,
  ): Promise<Collections<SType>>;
  async createCollection(
    title: string,
    itemsOrOptions:
      | RatingKeyItem[]
      | Omit<CreateRegularCollectionOptions<RatingKeyItem>, 'section'>
      | Omit<CreateSmartCollectionOptions<RatingKeyItem>, 'section'>,
  ): Promise<Collections<SType>> {
    const options = Array.isArray(itemsOrOptions)
      ? { section: this, items: itemsOrOptions }
      : { ...itemsOrOptions, section: this };
    return Collections.create(this.server, title, options as CreateCollectionOptions<SType>);
  }

  /**
   * Returns the collection with the exact title.
   */
  async collection(title: string): Promise<Collections<SType>> {
    const [collection] = await this.collections({ title, title__iexact: title });
    if (!collection) {
      throw new NotFound(`Unable to find collection with title "${title}".`);
    }

    return collection;
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
   * Returns items from this library section's Continue Watching hub.
   */
  async continueWatching(): Promise<LibrarySearchItem[]> {
    const key = this._buildQueryKey(`/hubs/sections/${this.key}/continueWatching/items`);
    return fetchLibrarySearchItems(this.server, key, this);
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
      const parsed = parseFilterChoiceField(filterField);
      const requestedLibtype = resolveRequestedLibtype(parsed.libtype, libtype ?? this.type);
      const filters = await this.listFilters(requestedLibtype);
      const foundFilter = filters.find(filter => filter.filter === parsed.field);
      if (!foundFilter) {
        const availableFilters = filters.map(filter => filter.filter);
        throw new NotFound(
          `Unknown filter field "${parsed.field}" for libtype "${requestedLibtype}". Available filters: ${availableFilters.join(
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
    const data = await this.server.query<MediaContainer<{ Metadata?: CommonData[] }>>({
      path: key,
    });
    const [common] = data.MediaContainer.Metadata ?? [];
    if (!common) {
      throw new NotFound('Unable to find common fields for the provided items.');
    }

    return new Common(this.server, common, key, this);
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

  private async _fetchDurationStorage(): Promise<DurationStorage> {
    if (this._durationStorageCache) {
      return this._durationStorageCache;
    }
    const data = await this.server.query<MediaContainer<MediaProvidersResponse>>({
      path: '/media/providers?includeStorage=1',
    });
    const directory = findLibraryProviderDirectory(data.MediaContainer, this.key);
    this._durationStorageCache = directory
      ? {
          duration: directory.durationTotal != null ? Number(directory.durationTotal) : null,
          storage: directory.storageTotal != null ? Number(directory.storageTotal) : null,
        }
      : { duration: null, storage: null };
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
      this._validateItemBelongsToSection(item);
      this._validateItemType(item, itemType);
    }

    return itemList;
  }

  private _validateItemBelongsToSection(item: EditableLibraryItem): void {
    if (!this._itemBelongsToThisSection(item)) {
      throw new BadRequest(`${item.title ?? item.ratingKey} is not from this library.`);
    }
  }

  private _validateItemType(item: EditableLibraryItem, expectedType?: string): void {
    if (item.type !== expectedType) {
      throw new BadRequest(`Cannot mix items of different type: ${expectedType} and ${item.type}`);
    }
  }

  private _itemBelongsToThisSection(item: EditableLibraryItem): boolean {
    let current: LibraryItemParent | undefined = item;
    while (current) {
      if (current.librarySectionID !== undefined && current.librarySectionID !== null) {
        return String(current.librarySectionID) === String(this.key);
      }

      if (current instanceof LibrarySection) {
        return String(current.key) === String(this.key);
      }

      current = current.parent?.deref();
    }

    return false;
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
    const meta = Array.isArray(data.MediaContainer.Meta)
      ? data.MediaContainer.Meta[0]
      : data.MediaContainer.Meta;
    this._filterTypes = (meta?.Type ?? []).map(
      type => new FilteringType(this.server, type, undefined, this),
    );
    this._fieldTypes = (meta?.FieldType ?? []).map(
      fieldType => new FilteringFieldType(this.server, fieldType, undefined, this),
    );
    // Plex accepts `guid` as a search field, but does not advertise a guid field
    // type. Add minimal operator metadata so validation can treat it like the
    // server-advertised field types.
    if (!this._fieldTypes.some(fieldType => fieldType.type === 'guid')) {
      this._fieldTypes.push(
        new FilteringFieldType(
          this.server,
          { type: 'guid', Operator: [{ key: '=', title: 'is' }] },
          undefined,
          this,
        ),
      );
    }
  }

  /**
   * Validates a filter field and value against the section filter metadata.
   */
  private async _validateFilterField(
    field: string,
    values: SearchFilterValue,
    libtype?: Libtype,
  ): Promise<SearchParamEntry[]> {
    const parsed = parseFilterField(field);
    const requestedLibtype = resolveRequestedLibtype(parsed.libtype, libtype ?? this.type);
    const filterField = await this._getFilterField(parsed.field, requestedLibtype);
    const operator = await this._validateFieldOperator(filterField, parsed.operator);
    const result = await this._validateFieldValue(filterField, values, requestedLibtype);
    if (operator === '&=') {
      return result.map(value => [filterField.key, value]);
    }

    return [[`${filterField.key}${operator.slice(0, -1)}`, result.join(',')]];
  }

  private async _getFilterField(field: string, libtype: Libtype): Promise<SearchFilterField> {
    const fieldMatches = (filterField: FilteringField) =>
      filterField.key.split('.').at(-1) === field;
    const fields = await this.listFields(libtype);
    const filterField =
      fields.find(fieldMatches) ??
      [...(await this.filterTypes())]
        .reverse()
        .flatMap(filterType => (filterType.type === libtype ? [] : filterType.fields))
        .find(fieldMatches);

    if (!filterField && field === 'id') {
      return { key: `${libtype}.id`, type: 'integer' };
    }

    if (!filterField && this._isStaticBooleanFilter(field)) {
      return { key: `${libtype}.${field}`, type: 'boolean' };
    }

    if (!filterField) {
      throw new NotFound(
        `Unknown filter field "${field}" for "${libtype}". Available fields: ${fields
          .map(f => f.key)
          .join(', ')}`,
      );
    }

    return filterField;
  }

  private _isStaticBooleanFilter(field: string): boolean {
    const staticFilters = (this.constructor as typeof LibrarySection).ALLOWED_FILTERS;
    return staticFilters.includes(field) && LibrarySection.BOOLEAN_FILTERS.includes(field);
  }

  private _classForSearch<C = SType>(libtype?: Libtype): Class<C> {
    return (
      (libtype ? (classForLibtype(libtype) as Class<C> | undefined) : undefined) ??
      (this.SECTION_TYPE as unknown as Class<C>)
    );
  }

  /**
   * Validates a filter operator against the field type metadata.
   */
  private async _validateFieldOperator(
    filterField: SearchFilterField,
    operator: string,
  ): Promise<string> {
    const fieldType = await this.getFieldType(filterField.type);
    const andOperator = operator === '&' || operator === '&=';
    if (andOperator) {
      operator = '';
    }

    if (fieldType.type === 'string' && (operator === '=' || operator === '!=')) {
      operator += '=';
    }

    operator = `${operator.endsWith('=') ? operator.slice(0, -1) : operator}=`;
    const exists = fieldType.operators.some(o => o.key === operator);
    if (!exists) {
      const availableOperators = (await this.listOperators(filterField.type)).map(o => o.key);
      throw new NotFound(
        `Unknown operator "${operator}" for "${filterField.key}". Available operators: ${availableOperators.join(
          ', ',
        )}`,
      );
    }

    return andOperator ? '&=' : operator;
  }

  /**
   * Validates filter values are the correct data type and available where the server exposes choices.
   */
  private async _validateFieldValue(
    filterField: SearchFilterField,
    values: SearchFilterValue,
    libtype?: Libtype,
  ): Promise<string[]> {
    const fieldType = await this.getFieldType(filterField.type);
    if (!isFilterValueType(fieldType.type)) {
      throw new BadRequest(`Unsupported filter type "${fieldType.type}" for "${filterField.key}".`);
    }

    const valueList = Array.isArray(values) ? values : [values];
    const results: string[] = [];

    for (const value of valueList) {
      try {
        const result = await this._validateFieldValueByType(
          fieldType.type,
          value,
          filterField,
          libtype,
        );
        results.push(result.toString());
      } catch (error) {
        if (error instanceof BadRequest || error instanceof NotFound) {
          throw error;
        }

        throw new BadRequest(
          `Invalid value for "${filterField.key}": expected ${fieldType.type}, got ${String(value)}.`,
        );
      }
    }

    return results;
  }

  private async _validateFieldValueByType(
    type: FilterValueType,
    value: SearchFilterPrimitive,
    filterField: SearchFilterField,
    libtype?: Libtype,
  ): Promise<number | string> {
    if (CHOICE_FILTER_VALUE_TYPES.has(type)) {
      return this._validateFieldValueTag(value, filterField, libtype);
    }

    if (type === 'boolean') {
      return value ? 1 : 0;
    }

    if (type === 'date') {
      return this._validateFieldValueDate(value);
    }

    if (type === 'integer') {
      const result = Number(value);
      if (Number.isNaN(result)) {
        throw new TypeError('Invalid integer');
      }

      return result;
    }

    return String(value);
  }

  private _validateFieldValueDate(value: SearchFilterPrimitive): number | string {
    if (value instanceof Date) {
      return Math.floor(value.getTime() / 1000);
    }

    const dateValue = String(value);
    if (/^-?\d+(mon|[smhdwy])$/.test(dateValue)) {
      return `-${dateValue.replace(/^-/, '')}`;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      throw new Error('Invalid date');
    }

    const timestamp = Date.parse(`${dateValue}T00:00:00Z`);
    if (Number.isNaN(timestamp)) {
      throw new TypeError('Invalid date');
    }

    return Math.floor(timestamp / 1000);
  }

  private async _validateFieldValueTag(
    value: SearchFilterPrimitive,
    filterField: SearchFilterField,
    libtype?: Libtype,
  ): Promise<string> {
    if (value instanceof FilterChoice) {
      return value.key;
    }

    let matchValue: string;
    if (isSearchTagValue(value)) {
      matchValue = String(value.id ?? value.tag);
    } else {
      matchValue = String(value);
    }

    const filterChoices = await this.listFilterChoices(filterField.key, libtype);
    const normalizedValue = matchValue.toLowerCase();
    return (
      filterChoices.find(
        choice =>
          choice.key.toLowerCase() === normalizedValue ||
          choice.title.toLowerCase() === normalizedValue,
      )?.key ?? matchValue
    );
  }

  private async _validateSortFields(
    sort: FilteringSort | FilteringSort[] | string | string[],
    libtype?: Libtype,
  ): Promise<string> {
    const sortList =
      typeof sort === 'string' ? sort.split(',') : Array.isArray(sort) ? sort : [sort];
    const validatedSorts: string[] = [];
    for (const sortField of sortList) {
      validatedSorts.push(await this._validateSortField(sortField, libtype));
    }

    return validatedSorts.join(',');
  }

  private async _validateSortField(
    sort: FilteringSort | string,
    libtype?: Libtype,
  ): Promise<string> {
    const requestedLibtype = libtype ?? (this.type as Libtype);
    if (sort instanceof FilteringSort) {
      return sort.defaultDirection
        ? `${requestedLibtype}.${sort.key}:${sort.defaultDirection}`
        : `${requestedLibtype}.${sort.key}`;
    }

    const parsed = parseSortField(sort);
    const sortLibtype = resolveRequestedLibtype(parsed.libtype, requestedLibtype);
    const filterSort = (await this.listSorts(sortLibtype)).find(f => f.key === parsed.field);
    if (!filterSort) {
      const staticSorts = (this.constructor as typeof LibrarySection).ALLOWED_SORT;
      if (staticSorts.includes(parsed.field)) {
        return parsed.direction
          ? `${sortLibtype}.${parsed.field}:${parsed.direction}`
          : `${sortLibtype}.${parsed.field}`;
      }

      const availableSorts = [
        ...(await this.listSorts(sortLibtype)).map(f => f.key),
        ...staticSorts,
      ];
      throw new NotFound(
        `Unknown sort field "${parsed.field}" for "${sortLibtype}". Available sorts: ${availableSorts.join(
          ', ',
        )}`,
      );
    }

    const availableDirections = ['', 'asc', 'desc', 'nullsLast'];
    if (!availableDirections.includes(parsed.direction)) {
      throw new NotFound(
        `Unknown sort direction "${parsed.direction}". Available directions: ${availableDirections.join(', ')}`,
      );
    }

    return parsed.direction
      ? `${sortLibtype}.${filterSort.key}:${parsed.direction}`
      : `${sortLibtype}.${filterSort.key}`;
  }

  private async _validateAdvancedSearch(
    filters: AdvancedSearchFilters,
    libtype?: Libtype,
  ): Promise<SearchParamEntry[]> {
    if (typeof filters !== 'object' || filters === null || Array.isArray(filters)) {
      throw new BadRequest('filters must be an object.');
    }

    const validatedFilters: SearchParamEntry[] = [];
    const entries = Object.entries(filters);
    for (const [field, values] of entries) {
      const groupOperator = advancedFilterGroupOperator(field);
      if (groupOperator) {
        if (entries.length > 1) {
          throw new BadRequest('"and" and "or" filter groups cannot include sibling filters.');
        }

        validatedFilters.push(
          ...(await this._validateAdvancedSearchGroup(groupOperator, values, libtype)),
        );
        continue;
      }

      validatedFilters.push(
        ...(await this._validateFilterField(field, values as SearchFilterValue, libtype)),
      );
    }

    return validatedFilters;
  }

  private async _validateAdvancedSearchGroup(
    operator: 'and' | 'or',
    values: AdvancedSearchFilters[] | SearchFilterValue,
    libtype?: Libtype,
  ): Promise<SearchParamEntry[]> {
    if (!isAdvancedFilterGroupValue(values)) {
      throw new BadRequest('"and" and "or" filter groups must be arrays.');
    }

    if (values.length === 0) {
      return [];
    }

    const validatedFilters: SearchParamEntry[] = [['push', '1']];
    for (const value of values) {
      validatedFilters.push(...(await this._validateAdvancedSearch(value, libtype)));
      validatedFilters.push([operator, '1']);
    }

    validatedFilters.pop();
    validatedFilters.push(['pop', '1']);
    return validatedFilters;
  }

  private async _splitSearchFilters(
    customFilters: Record<string, SearchArgValue>,
    libtype?: Libtype,
  ): Promise<SplitSearchFilters> {
    const localFilters: Record<string, ItemFilterValue> = {};
    const serverFilters: SearchParamEntry[] = [];

    for (const [field, values] of Object.entries(customFilters)) {
      if (values === undefined) {
        continue;
      }

      if (Object.hasOwn(OPERATORS, field.split('__').at(-1))) {
        if (!isItemFilterValue(values)) {
          throw new BadRequest(`Invalid local filter value for "${field}".`);
        }

        localFilters[field] = values;
        continue;
      }

      serverFilters.push(
        ...(await this._validateFilterField(field, values as SearchFilterValue, libtype)),
      );
    }

    return { localFilters, serverFilters };
  }

  private async _buildTitleSearchParams(
    title: SearchArgs['title'] | undefined,
    libtype?: Libtype,
  ): Promise<SearchParamEntry[]> {
    if (title === undefined || !Array.isArray(title)) {
      return [];
    }

    return this._validateFilterField('title', title, libtype);
  }

  private _applySearchOptions(
    params: URLSearchParams,
    {
      containerSize,
      containerStart,
      libtype,
      limit,
      maxresults,
      title,
    }: {
      containerSize?: number;
      containerStart?: number;
      libtype?: Libtype;
      limit?: number;
      maxresults?: number;
      title?: string | string[];
    },
  ): void {
    if (typeof title === 'string') {
      params.set('title', title);
    }

    if (libtype !== undefined) {
      params.set('type', searchType(libtype).toString());
    }

    if (limit !== undefined) {
      params.set('limit', limit.toString());
    }

    if (containerStart !== undefined) {
      params.set('X-Plex-Container-Start', containerStart.toString());
    }

    if (containerSize !== undefined || maxresults !== undefined) {
      params.set('X-Plex-Container-Size', (containerSize ?? maxresults).toString());
    }
  }

  private async _buildSearchKey(args: Partial<SearchArgs> = {}): Promise<SearchBuildResult> {
    const {
      container_size: containerSize,
      container_start: containerStart,
      filters,
      includeGuids = true,
      libtype,
      limit,
      maxresults,
      sort,
      title,
      ...customFilters
    } = args;
    const params = new URLSearchParams({
      includeGuids: includeGuids ? '1' : '0',
    });

    const { localFilters, serverFilters } = await this._splitSearchFilters(customFilters, libtype);
    const filterArgs = [...serverFilters, ...(await this._buildTitleSearchParams(title, libtype))];

    if (filters !== undefined) {
      filterArgs.push(...(await this._validateAdvancedSearch(filters, libtype)));
    }

    if (sort !== undefined) {
      params.set('sort', await this._validateSortFields(sort, libtype));
    }

    this._applySearchOptions(params, {
      containerSize,
      containerStart,
      libtype,
      limit,
      maxresults,
      title,
    });

    for (const [key, value] of filterArgs) {
      params.append(key, value);
    }

    const query = params.toString();
    return {
      key: `/library/sections/${this.key}/all?${query}`,
      localFilters,
    };
  }
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
  override METADATA_TYPE = 'movie' as const;
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
  override METADATA_TYPE = 'episode' as const;
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
  override METADATA_TYPE = 'track' as const;
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

export class PhotoSection extends LibrarySection<Photoalbum> {
  static override TYPE = 'photo';
  static override ALLOWED_FILTERS = ['year', 'label', 'addedAt'];
  static override ALLOWED_SORT = ['addedAt', 'titleSort', 'viewUpdatedAt'];
  static override TAG = 'Directory';
  override METADATA_TYPE = 'photo' as const;
  override CONTENT_TYPE = 'photo';
  override readonly SECTION_TYPE = Photoalbum;

  /**
   * Returns photo library items.
   *
   * Photo sections default to albums to match Plex's photo library behavior. Pass
   * `libtype: 'photo'` to return individual photos instead.
   *
   * @example
   * ```ts
   * const albums = await photoSection.all()
   * const photos = await photoSection.all({ libtype: 'photo', maxResults: 50 })
   * ```
   */
  override async all<T extends Libtype>(
    options: LibrarySectionAllOptions & { libtype: T },
  ): Promise<Array<SearchClassForLibtype<T>>>;
  override async all(): Promise<Photoalbum[]>;
  override async all(options: LibrarySectionAllOptions): Promise<LibrarySearchItem[]>;
  override async all(
    options: LibrarySectionAllOptions = {},
  ): Promise<Photoalbum[] | LibrarySearchItem[]> {
    const { maxResults, libtype = 'photoalbum', ...args } = options;
    const items = await this.search(
      {
        ...args,
        libtype,
        ...(maxResults === undefined ? {} : { maxresults: maxResults }),
      },
      classForLibtype(libtype) ?? Photoalbum,
    );
    return maxResults === undefined ? items : items.slice(0, maxResults);
  }

  /** Photo libraries do not support collections. */
  override async collections(): Promise<Array<Collections<Photoalbum>>> {
    throw new Unsupported('Collections are not available for a Photo library.');
  }

  /** Search for a photo album. */
  async searchAlbums(args: Partial<SearchArgs> = {}): Promise<Photoalbum[]> {
    return this.search({ ...args, libtype: 'photoalbum' }, Photoalbum);
  }

  /** Search for a photo. */
  async searchPhotos(args: Partial<SearchArgs> = {}): Promise<Photo[]> {
    return this.search({ ...args, libtype: 'photo' }, Photo);
  }

  /** Returns recently added photo albums from this library section. */
  async recentlyAddedAlbums(maxResults = 50): Promise<Photoalbum[]> {
    return this.search(
      { maxresults: maxResults, sort: 'addedAt:desc', libtype: 'photoalbum' },
      Photoalbum,
    );
  }

  /** Returns recently added photos from this library section. */
  async recentlyAddedPhotos(maxResults = 50): Promise<Photo[]> {
    return this.search({ maxresults: maxResults, sort: 'addedAt:desc', libtype: 'photo' }, Photo);
  }

  /** Returns recently added photo albums from this library section. */
  override async recentlyAdded(maxResults = 50): Promise<Photoalbum[]> {
    return this.recentlyAddedAlbums(maxResults);
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
    const data = await fetchItemData<ManagedHubData>(
      this.server,
      key,
      { identifier: this.identifier },
      ManagedHub,
    );
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

  /**
   * Update where this managed hub is visible.
   * Omitted flags preserve the hub's current visibility state.
   */
  async updateVisibility(changes: ManagedHubVisibilityChanges): Promise<this> {
    const {
      recommended = this.promotedToRecommended,
      home = this.promotedToOwnHome,
      shared = this.promotedToSharedHome,
    } = changes;
    const params = new URLSearchParams({
      promotedToRecommended: recommended ? '1' : '0',
      promotedToOwnHome: home ? '1' : '0',
      promotedToSharedHome: shared ? '1' : '0',
    });
    const key = `/hubs/sections/${this.librarySectionID}/manage/${
      this.identifier
    }?${params.toString()}`;
    await this.server.query({ path: key, method: 'put' });
    this.promotedToRecommended = recommended;
    this.promotedToOwnHome = home;
    this.promotedToSharedHome = shared;
    return this;
  }

  promoteRecommended(): Promise<this> {
    return this.updateVisibility({ recommended: true });
  }

  demoteRecommended(): Promise<this> {
    return this.updateVisibility({ recommended: false });
  }

  promoteHome(): Promise<this> {
    return this.updateVisibility({ home: true });
  }

  demoteHome(): Promise<this> {
    return this.updateVisibility({ home: false });
  }

  promoteShared(): Promise<this> {
    return this.updateVisibility({ shared: true });
  }

  demoteShared(): Promise<this> {
    return this.updateVisibility({ shared: false });
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

  declare context?: string;
  declare hubKey?: string;
  declare hubIdentifier: string;
  declare librarySectionID?: string;
  /** True if Plex has more items available at this hub's key. */
  declare more: boolean;
  /** Number of items found. */
  declare size: number;
  declare style?: string;
  declare title: string;
  declare type: string;
  /** True if the hub items are randomized. */
  declare random: boolean;
  declare Directory: SearchResultContainer['Directory'];
  declare Metadata: SearchResultContainer['Metadata'];
  declare private _metadata?: LibrarySearchMetadata[];
  declare private _items?: HubItem[];

  /**
   * Return items from this hub.
   *
   * Plex often includes a partial `Metadata` list with the hub response. When
   * `more` is true, this fetches the hub key first so callers get the full item
   * list instead of only the preview items.
   */
  async items(): Promise<HubItem[]>;
  async items<T extends HubItem>(Cls: Class<T>): Promise<T[]>;
  async items<T extends HubItem>(Cls?: Class<T>): Promise<HubItem[] | T[]> {
    if (this.more && this.key) {
      const data = await this.server.query<MediaContainer<{ Metadata?: LibrarySearchMetadata[] }>>({
        path: this._buildQueryKey(this.key),
      });
      this._metadata = data.MediaContainer.Metadata ?? [];
      this._items = undefined;
      this.more = false;
      this.size = this._metadata.length;
    }

    if (Cls) {
      return (this._metadata ?? []).map(item => createHubItem(this.server, item, this, Cls));
    }

    if (!this._items) {
      this._items = (this._metadata ?? []).map(item => createHubItem(this.server, item, this));
    }

    return this._items as T[];
  }

  async section(): Promise<Section> {
    const parent = this.parent?.deref();
    if (parent instanceof LibrarySection) {
      return parent as Section;
    }

    const sectionID = this.librarySectionID;
    if (!sectionID) {
      throw new NotFound(`Unable to find library section for hub "${this.title}".`);
    }

    const library = await this.server.library();
    return library.sectionByID(sectionID);
  }

  protected _loadData(data: SearchResultContainer) {
    this.context = data.context;
    this.hubKey = data.hubKey;
    this.hubIdentifier = data.hubIdentifier;
    this.key = data.key ?? data.hubKey ?? '';
    this.librarySectionID = data.librarySectionID?.toString();
    this.more = parsePlexBoolean(data.more);
    this.size = data.size;
    this.style = data.style;
    this.title = data.title;
    this.type = data.type;
    this.random = parsePlexBoolean(data.random);
    this.Directory = data.Directory;
    this.Metadata = data.Metadata;
    this._metadata = data.Metadata ?? [];
    this._items = undefined;
  }
}

/**
 * Represents a Folder inside a library.
 */
export class Folder extends PlexObject {
  static override TAG = 'Directory';

  declare title: string;

  /**
   * Returns a list of available Folders for this folder.
   * Continue down subfolders until a mediaType is found.
   */
  async subfolders(): Promise<Folder[]> {
    if (this.key.startsWith('/library/metadata')) {
      return fetchItems<Folder>(this.server, this.key);
    }

    return fetchItems<Folder>(this.server, this.key, undefined, Folder);
  }

  /**
   * Returns all nested folders below this folder, excluding media item leaves.
   */
  async allSubfolders(): Promise<Folder[]> {
    const folders: Folder[] = [];
    const pending = await this.subfolders();
    const seen = new Set<string>();

    for (const folder of pending) {
      if (folder.key.startsWith('/library/metadata') || seen.has(folder.key)) {
        continue;
      }

      seen.add(folder.key);
      folders.push(folder);
      pending.push(...(await folder.subfolders()));
    }

    return folders;
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

  private readonly itemClass?: CollectionItemClass<CollectionVideoType>;

  constructor(
    server: PlexServer,
    data: CollectionData,
    initpath?: string,
    parent?: PlexObject,
    itemClass?: CollectionItemClass<CollectionVideoType>,
  ) {
    super(server, data, initpath, parent);
    this.itemClass = itemClass ?? collectionItemClassFromParent(parent);
  }

  // Alias for childCount
  get size() {
    return this.childCount;
  }

  get metadataType(): Libtype {
    return this.subtype as Libtype;
  }

  get isVideo(): boolean {
    return ['episode', 'movie', 'season', 'show'].includes(this.subtype);
  }

  get isAudio(): boolean {
    return ['album', 'artist', 'track'].includes(this.subtype);
  }

  get isPhoto(): boolean {
    return ['photo', 'photoalbum'].includes(this.subtype);
  }

  get listType(): PlaylistContentType {
    if (this.isVideo) {
      return 'video';
    }
    if (this.isAudio) {
      return 'audio';
    }
    if (this.isPhoto) {
      return 'photo';
    }

    throw new Unsupported(`Unexpected collection subtype: ${this.subtype}`);
  }

  override async reload(): Promise<void> {
    const data = await this.server.query<MediaContainer<{ Metadata?: CollectionData[] }>>({
      path: `/library/metadata/${this.ratingKey}`,
    });
    const metadata = data.MediaContainer.Metadata?.[0];
    if (!metadata) {
      throw new NotFound(`Unable to reload collection "${this.title}".`);
    }

    this._loadData(metadata);
  }

  /**
   * Returns a list of all items in the collection.
   */
  async items(): Promise<CollectionVideoType[]> {
    if (!this.itemClass) {
      throw new Error('Cannot fetch collection items without a collection item class.');
    }

    const collectionKey = this.key.endsWith('/children') ? this.key : `${this.key}/children`;
    const key = this._buildQueryKey(collectionKey);
    const data = await this.server.query<MediaContainer<{ Metadata?: unknown[] }>>({ path: key });
    return (
      data.MediaContainer.Metadata?.map(
        d => new this.itemClass(this.server, d as PlexItemData, undefined, this),
      ) ?? []
    );
  }

  /**
   * Add items to the collection.
   * @param items Items to add to the collection.
   */
  async addItems(items: CollectionVideoType[]): Promise<void> {
    this._assertRegularCollection('add items to');
    const ratingKeys = collectionRatingKeys(items, `add item to collection "${this.title}"`).join(
      ',',
    );
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
    this._assertRegularCollection('remove items from');
    const ratingKeys = collectionRatingKeys(items, `remove item from collection "${this.title}"`);
    await Promise.all(
      ratingKeys.map(async ratingKey => {
        const key = `/library/collections/${this.ratingKey}/items/${ratingKey}`;
        await this.server.query({ path: key, method: 'delete' });
      }),
    );

    await this.reload();
  }

  /**
   * Move an item to a new position in the collection.
   * @param item Item to move.
   * @param after Item to place it after. If not provided, moves to the beginning.
   */
  async moveItem(item: CollectionVideoType, after?: CollectionVideoType): Promise<void> {
    this._assertRegularCollection('move items in');

    const [ratingKey] = collectionRatingKeys([item], `move item in collection "${this.title}"`);
    let key = `/library/collections/${this.ratingKey}/items/${ratingKey}/move`;
    if (after) {
      const [afterKey] = collectionRatingKeys(
        [after],
        `move item after another item in collection "${this.title}"`,
      );
      key += `?after=${afterKey}`;
    }

    await this.server.query({ path: key, method: 'put' });
    await this.reload();
  }

  /**
   * Update the collection display mode.
   * @param mode Display mode: 'default' (-1), 'hide' (0), 'hideItems' (1), 'showItems' (2).
   */
  async modeUpdate(mode: CollectionMode): Promise<void> {
    const modeValue = COLLECTION_MODE_VALUES[mode];
    if (modeValue === undefined) {
      throw new BadRequest(`Invalid collection mode: ${mode}`);
    }

    await this._updatePreference('collectionMode', modeValue);
  }

  /**
   * Update the collection sort order.
   * @param sort Sort order: 'release' (0), 'alpha' (1), 'custom' (2).
   */
  async sortUpdate(sort: CollectionSort): Promise<void> {
    const sortValue = COLLECTION_SORT_VALUES[sort];
    if (sortValue === undefined) {
      throw new BadRequest(`Invalid collection sort: ${sort}`);
    }

    await this._updatePreference('collectionSort', sortValue);
  }

  /** Replace the validated search behind a smart collection. */
  async updateFilters(options: SmartCollectionSearchOptions = {}): Promise<this> {
    if (!this.smart) {
      throw new BadRequest('Cannot update filters for a regular collection.');
    }

    const section = await this.section();
    const { where = {}, ...search } = options;
    const searchKey = await section.buildSearchKey({
      ...where,
      ...search,
      libtype: search.libtype ?? (this.subtype as Libtype),
    });
    const uri = `${this.server._uriRoot()}${searchKey}`;
    const key = `/library/collections/${this.ratingKey}/items?${new URLSearchParams({ uri }).toString()}`;
    await this.server.query({ path: key, method: 'put' });
    await this.reload();
    return this;
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
    options: CreateCollectionOptions<T>,
  ): Promise<Collections<T>>;
  static async create<T extends RatingKeyItem = SectionType>(
    server: PlexServer,
    title: string,
    section: LibrarySection<T>,
    items: RatingKeyItem[],
  ): Promise<Collections<T>>;
  static async create<T extends RatingKeyItem = SectionType>(
    server: PlexServer,
    title: string,
    optionsOrSection: CreateCollectionOptions<T> | LibrarySection<T>,
    legacyItems: RatingKeyItem[] = [],
  ): Promise<Collections<T>> {
    const options: CreateCollectionOptions<T> =
      optionsOrSection instanceof LibrarySection
        ? { section: optionsOrSection, items: legacyItems }
        : optionsOrSection;
    const { section } = options;

    if (!('items' in options)) {
      const { where = {}, ...search } = options.search ?? {};
      const libtype = search.libtype ?? (section.type as Libtype);
      const searchKey = await section.buildSearchKey({ ...where, ...search, libtype });
      const uri = `${server._uriRoot()}${searchKey}`;
      const params = new URLSearchParams({
        sectionId: section.key,
        smart: '1',
        title,
        type: searchType(libtype).toString(),
        uri,
      });
      const key = `/library/collections?${params.toString()}`;
      const data = await server.query<MediaContainer<{ Metadata?: CollectionData[] }>>({
        path: key,
        method: 'post',
      });
      const metadata = data.MediaContainer.Metadata?.[0];
      if (!metadata) {
        throw new Error('Failed to create smart collection');
      }

      return new Collections<T>(server, metadata, key, section, section.SECTION_TYPE);
    }

    const { items } = options;
    if (items.length === 0) {
      throw new BadRequest('At least one item is required to create a collection.');
    }

    const ratingKeys = collectionRatingKeys(items, `add item to collection "${title}"`);
    const uri = `${server._uriRoot()}/library/metadata/${ratingKeys.join(',')}`;
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

    return new Collections<T>(server, metadata, key, section, section.SECTION_TYPE);
  }

  private _assertRegularCollection(action: string): void {
    if (this.smart) {
      throw new Unsupported(`Cannot ${action} a smart collection.`);
    }
  }

  private async _updatePreference(key: string, value: number): Promise<void> {
    const params = new URLSearchParams({ [key]: value.toString() });
    const path = `/library/metadata/${this.ratingKey}/prefs?${params.toString()}`;
    await this.server.query({ path, method: 'put' });
    await this.reload();
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
    this.smart = parsePlexBoolean(data.smart);
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

function collectionItemClassFromParent<T extends RatingKeyItem>(
  parent?: PlexObject,
): CollectionItemClass<T> | undefined {
  return parent instanceof LibrarySection
    ? (parent.SECTION_TYPE as CollectionItemClass<T>)
    : undefined;
}

function collectionRatingKeys<T extends RatingKeyItem>(
  items: T[],
  action: string,
): Array<string | number> {
  if (items.length === 0) {
    throw new BadRequest('At least one item is required.');
  }

  return items.map(item => {
    if (!item.ratingKey) {
      throw new BadRequest(`Cannot ${action} without a ratingKey.`);
    }

    return item.ratingKey;
  });
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
    this.collections = (data.Collection ?? []).map(
      d => new Collection(this.server, d, undefined, this),
    );
    this.contentRating = data.contentRating;
    this.countries = (data.Country ?? []).map(d => new Country(this.server, d, undefined, this));
    this.directors = (data.Director ?? []).map(d => new Director(this.server, d, undefined, this));
    this.editionTitle = data.editionTitle;
    this.fields = (data.Field ?? []).map(d => new Field(this.server, d, undefined, this));
    this.genres = (data.Genre ?? []).map(d => new Genre(this.server, d, undefined, this));
    this.grandparentRatingKey = parseOptionalNumber(data.grandparentRatingKey);
    this.grandparentTitle = data.grandparentTitle;
    this.guid = data.guid;
    this.guids = (data.Guid ?? []).map(d => new Guid(this.server, d, undefined, this));
    this.index = parseOptionalNumber(data.index);
    this.key = data.key;
    this.labels = (data.Label ?? []).map(d => new Label(this.server, d, undefined, this));
    this.mixedFields = data.mixedFields ? data.mixedFields.split(',') : [];
    this.moods = (data.Mood ?? []).map(d => new Mood(this.server, d, undefined, this));
    this.originallyAvailableAt = data.originallyAvailableAt
      ? new Date(data.originallyAvailableAt)
      : undefined;
    this.parentRatingKey = parseOptionalNumber(data.parentRatingKey);
    this.parentTitle = data.parentTitle;
    this.producers = (data.Producer ?? []).map(d => new Producer(this.server, d, undefined, this));
    this.ratingKey = parseOptionalNumber(data.ratingKey);
    this.ratings = (data.Rating ?? []).map(d => new Rating(this.server, d, undefined, this));
    this.roles = (data.Role ?? []).map(d => new Role(this.server, d, undefined, this));
    this.studio = data.studio;
    this.styles = (data.Style ?? []).map(d => new Style(this.server, d, undefined, this));
    this.summary = data.summary;
    this.tags = (data.Tag ?? []).map(d => new Tag(this.server, d, undefined, this));
    this.tagline = data.tagline;
    this.title = data.title;
    this.titleSort = data.titleSort;
    this.type = data.type;
    this.writers = (data.Writer ?? []).map(d => new Writer(this.server, d, undefined, this));
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
    const section = this.parent?.deref() as LibrarySection | undefined;
    // Merge hidden-but-valid metadata into the server response here so list and
    // validation helpers expose the same augmented view.
    const fields = addUniqueByKey(data.Field ?? [], manualFilteringFields(data.type));
    const filters = addUniqueByKey(
      data.Filter ?? [],
      manualFilteringFilters(data.type, section?.key),
    );
    const sorts = addUniqueByKey(data.Sort ?? [], manualFilteringSorts(data.type));
    this.fields = fields.map(d => new FilteringField(this.server, d, undefined, this));
    this.filters = filters.map(d => new FilteringFilter(this.server, d, undefined, this));
    this.key = data.key;
    this.sorts = sorts.map(d => new FilteringSort(this.server, d, undefined, this));
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
    this.operators = (data.Operator ?? []).map(
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
