import { PlexServer } from './server';
import { LibraryRootResponse, SectionsResponse, SectionsDirectory, Location } from './libraryInterfaces';
import { MediaContainer } from './util';

export interface LibraryData {
  /** Unknown ('com.plexapp.plugins.library') */
  identifier: string;
  /** Unknown (/system/bundle/media/flags/) */
  mediaTagPrefix: string;
  /** 'Plex Library' (not sure how useful this is) */
  title1: string;
  /** Second title (this is blank on my setup) */
  title2: string;
}

export type SectionClasses = MovieSection | ShowSection;

export class Library {
  static key = '/library';

  data!: LibraryData;

  constructor(private readonly server: PlexServer, data: LibraryRootResponse) {
    this._loadData(data);
  }

  /**
   * @returns a list of all media sections in this library. Library sections may be any of
   */
  async sections(): Promise<SectionClasses[]> {
    const key = '/library/sections';
    const sections: SectionClasses[] = [];
    const elems = await this.server.query<MediaContainer<SectionsResponse>>(key);
    for (const elem of elems.MediaContainer.Directory) {
      for (const cls of [MovieSection, ShowSection]) {
        if (cls.TYPE === elem.type) {
          // eslint-disable-next-line new-cap
          const instance = new cls(this.server, elem, key);
          sections.push(instance);
        }
      }
    }

    return sections;
  }

  async section(title: string): Promise<SectionClasses> {
    const sections = await this.sections();
    const section = sections.find(s => s.data.title.toLowerCase() === title.toLowerCase());
    if (!section) {
      throw new Error(`Invalid library section: ${title}`);
    }

    return section;
  }

  async sectionByID(sectionId: string): Promise<SectionClasses> {
    const sections = await this.sections();
    const section = sections.find(s => s.data.key);
    if (!section) {
      throw new Error(`Invalid library section id: ${sectionId}`);
    }

    return section;
  }

  private _loadData(data: LibraryRootResponse): void {
    const libraryData: LibraryData = {
      identifier: data.identifier,
      mediaTagPrefix: data.mediaTagPrefix,
      title1: data.title1,
      title2: data.title2,
    };
    this.data = libraryData;
  }
}

export interface LibrarySectionData {
  /** Unknown (com.plexapp.agents.imdb, etc) */
  agent: string;
  /** l True if you allow syncing content from this section. */
  allowSync: boolean;
  /** Wallpaper artwork used to respresent this section. */
  art: string;
  /** Composit image used to represent this section. */
  composite: string;
  /** Unknown */
  filters: boolean;
  /** Key (or ID) of this library section. */
  key: string;
  /** Language represented in this section (en, xn, etc). */
  language: string;
  /** Paths on disk where section content is stored. */
  locations: Location[];
  /** True if this section is currently being refreshed. */
  refreshing: boolean;
  /** Internal scanner used to find media (Plex Movie Scanner, Plex Premium Music Scanner, etc.) */
  scanner: string;
  /** Thumbnail image used to represent this section. */
  thumb: string;
  /** Title of this section. */
  title: string;
  /** Type of content section represents (movie, artist, photo, show). */
  type: string;
  /** Datetime this library section was last updated. */
  updatedAt: Date;
  /** Datetime this library section was created. */
  createdAt: Date;
  scannedAt: Date;
  /** Unique id for this section (32258d7c-3e6c-4ac5-98ad-bad7a3b78c63) */
  uuid: string;
}

export abstract class LibrarySection {
  static ALLOWED_FILTERS: string[] = [];
  static ALLOWED_SORT: string[] = [];
  static BOOLEAN_FILTERS = ['unwatched', 'duplicate'];
  static TYPE: string;
  data!: LibrarySectionData;

  /**
   * @param initpath Relative path requested when retrieving specified `data`
   */
  constructor(private readonly server: PlexServer, data: any, private readonly initpath: string) {
    this._loadData(data);
  }

  private _loadData(data: SectionsDirectory): void {
    const libraryData: LibrarySectionData = {
      uuid: data.uuid,
      key: data.key,
      agent: data.agent,
      allowSync: data.allowSync,
      art: data.art,
      composite: data.composite,
      filters: data.filters,
      language: data.language,
      locations: data.Location,
      refreshing: data.refreshing,
      scanner: data.scanner,
      thumb: data.thumb,
      title: data.title,
      type: data.type,
      updatedAt: new Date(data.updatedAt * 1000),
      createdAt: new Date(data.createdAt * 1000),
      scannedAt: new Date(data.scannedAt * 1000),
    };
    this.data = libraryData;
  }
}

export class MovieSection extends LibrarySection {
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
}

export class ShowSection extends LibrarySection {
  static TYPE = 'show';
  static ALLOWED_FILTERS = [
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

  static ALLOWED_SORT = [
    'addedAt',
    'lastViewedAt',
    'originallyAvailableAt',
    'titleSort',
    'rating',
    'unwatched',
  ];

  static TAG = 'Directory';
  static METADATA_TYPE = 'episode';
  static CONTENT_TYPE = 'video';
}
