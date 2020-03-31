import { PlexServer } from './server';
import {
  LibraryRootResponse,
  SectionsResponse,
  SectionsDirectory,
  Location,
} from './libraryInterfaces';
import { MediaContainer } from './util';
import { PlexObject } from './base';
import { Movie, VideoType } from './video';
import { Class } from 'type-fest';
import { URLSearchParams } from 'url';
import { fetchItem } from './baseFunctionality';

// export type Section = MovieSection | ShowSection;
export type Section = MovieSection;

export class Library {
  static key = '/library';
  /** Unknown ('com.plexapp.plugins.library') */
  identifier!: string;
  /** Unknown (/system/bundle/media/flags/) */
  mediaTagPrefix!: string;
  /** 'Plex Library' (not sure how useful this is) */
  title1!: string;
  /** Second title (this is blank on my setup) */
  title2!: string;

  constructor(private readonly server: PlexServer, data: LibraryRootResponse) {
    this._loadData(data);
  }

  /**
   * @returns a list of all media sections in this library. Library sections may be any of
   */
  async sections(): Promise<Section[]> {
    const key = '/library/sections';
    const sections: Section[] = [];
    const elems = await this.server.query<MediaContainer<SectionsResponse>>(key);
    for (const elem of elems.MediaContainer.Directory) {
      for (const cls of [MovieSection]) {
        if (cls.TYPE === elem.type) {
          // eslint-disable-next-line new-cap
          const instance = new cls(this.server, elem, key);
          sections.push(instance);
        }
      }
    }

    return sections;
  }

  async section<T extends Section = Section>(title: string): Promise<T> {
    const sections = await this.sections();
    const section = sections.find(s => s.title.toLowerCase() === title.toLowerCase()) as
      | T
      | undefined;
    if (!section) {
      throw new Error(`Invalid library section: ${title}`);
    }

    return section;
  }

  async sectionByID(sectionId: string): Promise<Section> {
    const sections = await this.sections();
    const section = sections.find(s => s.key);
    if (!section) {
      throw new Error(`Invalid library section id: ${sectionId}`);
    }

    return section;
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
  async add(name = '', type = '', agent = '', scanner = '', location = '', language = 'en') {
    const search = new URLSearchParams({
      name,
      type,
      agent,
      scanner,
      location,
      language,
    });
    const url = '/library/sections?' + search.toString();
    return this.server.query(url, 'post');
  }

  protected _loadData(data: LibraryRootResponse): void {
    this.identifier = data.identifier;
    this.mediaTagPrefix = data.mediaTagPrefix;
    this.title1 = data.title1;
    this.title2 = data.title2;
  }
}

/**
 * Base class for a single library section.
 */
export abstract class LibrarySection<SectionVideoType = VideoType> extends PlexObject {
  static ALLOWED_FILTERS: string[] = [];
  static ALLOWED_SORT: string[] = [];
  static BOOLEAN_FILTERS = ['unwatched', 'duplicate'];
  /** Unknown (com.plexapp.agents.imdb, etc) */
  agent!: string;
  /** l True if you allow syncing content from this section. */
  allowSync!: boolean;
  /** Wallpaper artwork used to respresent this section. */
  art!: string;
  /** Composit image used to represent this section. */
  composite!: string;
  /** Unknown */
  filters!: boolean;
  /** Key (or ID) of this library section. */
  key!: string;
  /** Language represented in this section (en, xn, etc). */
  language!: string;
  /** Paths on disk where section content is stored. */
  locations!: Location[];
  /** True if this section is currently being refreshed. */
  refreshing!: boolean;
  /** Internal scanner used to find media (Plex Movie Scanner, Plex Premium Music Scanner, etc.) */
  scanner!: string;
  /** Thumbnail image used to represent this section. */
  thumb!: string;
  /** Title of this section. */
  title!: string;
  /** Type of content section represents (movie, artist, photo, show). */
  type!: string;
  /** Datetime this library section was last updated. */
  updatedAt!: Date;
  /** Datetime this library section was created. */
  createdAt!: Date;
  scannedAt!: Date;
  /** Unique id for this section (32258d7c-3e6c-4ac5-98ad-bad7a3b78c63) */
  uuid!: string;
  VIDEO_TYPE!: Class<SectionVideoType>;

  /**
   * @param initpath Relative path requested when retrieving specified `data`
   */
  constructor(server: PlexServer, data: SectionsDirectory, initpath: string) {
    super(server, data, initpath);
    this._loadData(data);
  }

  /**
   * @param title Title of the item to return.
   * @returns the media item with the specified title.
   */
  async get(title: string): Promise<SectionVideoType> {
    const key = `/library/sections/${this.key}/all?title=${title}`;
    const data = await fetchItem(this.server, key, { title__iexact: title });
    return new this.VIDEO_TYPE(this.server, data, key);
  }

  /**
   * Run an analysis on all of the items in this library section.
   * See :func:`~plexapi.base.PlexPartialObject.analyze` for more details.
   */
  async analyze(): Promise<void> {
    const key = `/library/sections/${this.key}/analyze`;
    await this.server.query(key, 'post');
  }

  /**
   * If a section has items in the Trash, use this option to empty the Trash
   */
  async emptyTrash(): Promise<void> {
    const key = `/library/sections/${this.key}/emptyTrash`;
    await this.server.query(key, 'put');
  }

  /**
   * Get Play History for this library Section for the owner.
   * @param maxresults (int): Only return the specified number of results (optional).
   * @param mindate (datetime): Min datetime to return results from.
   */
  // async history(maxresults=9999999, mindate?: Date): Promise<any> {
  //   return this.server.history(maxresults=maxresults, mindate=mindate, librarySectionID=self.key, accountID=1)
  // }

  /**
   * Scan this section for new media.
   */
  async update(): Promise<void> {
    const key = `/library/sections/${this.key}/refresh`;
    await this.server.query(key);
  }

  /**
   * Cancel update of this Library Section.
   */
  async cancelUpdate(): Promise<void> {
    const key = `/library/sections/${this.key}/refresh`;
    await this.server.query(key, 'delete');
  }

  /**
   * Forces a download of fresh media information from the internet.
   * This can take a long time. Any locked fields are not modified.
   */
  async refresh(): Promise<void> {
    const key = `/library/sections/${this.key}/refresh?force=1`;
    await this.server.query(key);
  }

  /**
   * Delete the preview thumbnails for items in this library. This cannot
   * be undone. Recreating media preview files can take hours or even days.
   */
  async deleteMediaPreviews(): Promise<void> {
    const key = `/library/sections/${this.key}/indexes`;
    await this.server.query(key, 'delete');
  }

  /** Delete a library section. */
  async delete(): Promise<void> {
    const key = `/library/sections/${this.key}`;
    await this.server.query(key, 'delete');
  }

  /**
   * Edit a library
   * @param kwargs object of settings to edit
   */
  async edit(kwargs: Record<string, string>): Promise<MovieSection> {
    const params = new URLSearchParams(kwargs);
    const part = `/library/sections/${this.key}?${params.toString()}`;
    await this.server.query(part, 'put');
    const library = await this.server.library();
    const sections = await library.sections();
    for (const section of sections) {
      if (section.key === this.key) {
        return section;
      }
    }

    throw new Error('Couldn\'t update section');
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
    this.type = data.type;
    this.updatedAt = new Date(data.updatedAt * 1000);
    this.createdAt = new Date(data.createdAt * 1000);
    this.scannedAt = new Date(data.scannedAt * 1000);
  }
}

export class MovieSection extends LibrarySection<Movie> {
  static TYPE = 'movie';
  static ALLOWED_FILTERS = [
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

  static ALLOWED_SORT = [
    'addedAt',
    'originallyAvailableAt',
    'lastViewedAt',
    'titleSort',
    'rating',
    'mediaHeight',
    'duration',
  ];

  static TAG = 'Directory';
  static METADATA_TYPE = 'movie';
  static CONTENT_TYPE = 'video';
  VIDEO_TYPE = Movie;
}

// export class ShowSection extends LibrarySection<any> {
//   static ALLOWED_FILTERS = [
//     'unwatched',
//     'year',
//     'genre',
//     'contentRating',
//     'network',
//     'collection',
//     'guid',
//     'duplicate',
//     'label',
//     'show.title',
//     'show.year',
//     'show.userRating',
//     'show.viewCount',
//     'show.lastViewedAt',
//     'show.actor',
//     'show.addedAt',
//     'episode.title',
//     'episode.originallyAvailableAt',
//     'episode.resolution',
//     'episode.subtitleLanguage',
//     'episode.unwatched',
//     'episode.addedAt',
//     'episode.userRating',
//     'episode.viewCount',
//     'episode.lastViewedAt',
//   ];

//   static ALLOWED_SORT = [
//     'addedAt',
//     'lastViewedAt',
//     'originallyAvailableAt',
//     'titleSort',
//     'rating',
//     'unwatched',
//   ];

//   static TYPE = 'show';
//   static TAG = 'Directory';
//   static METADATA_TYPE = 'episode';
//   static CONTENT_TYPE = 'video';
//   SECTION = Show;
// }
