import { PlexServer } from './server';
import {
  LibraryRootResponse,
  SectionsResponse,
  SectionsDirectory,
  Location,
  MediaItem,
} from './libraryInterfaces';
import { MediaContainer } from './util';
import { PlexObject } from './base';
import { Movie, VideoType } from './video';
import { Class } from 'type-fest';

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
    const section = sections.find(s => s.title.toLowerCase() === title.toLowerCase()) as T | undefined;
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

  private _loadData(data: LibraryRootResponse): void {
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
  constructor(
    server: PlexServer,
    data: SectionsDirectory,
    private readonly initpath: string,
  ) {
    super(server, data);
    this._loadData(data);
  }

  /**
   * @param title Title of the item to return.
   * @returns the media item with the specified title.
   */
  async get(title: string): Promise<SectionVideoType> {
    const key = `/library/sections/${this.key}/all?title=${title}`;
    const data = await this.fetchItem(key, { title__iexact: title });
    return new this.VIDEO_TYPE(this.server, data, this.key);
  }

  /**
   * Run an analysis on all of the items in this library section.
   * See :func:`~plexapi.base.PlexPartialObject.analyze` for more details.
   */
  async analyze(): Promise<void> {
    const key = `/library/sections/${this.key}/analyze`;
    this.server.query(key, 'post');
  }

  /**
   * Scan this section for new media.
   */
  async update(): Promise<void> {
    const key = `/library/sections/${this.key}/refresh`;
    this.server.query(key);
  }

  /**
   * Cancel update of this Library Section.
   */
  async cancelUpdate(): Promise<void> {
    const key = `/library/sections/${this.key}/refresh`;
    this.server.query(key, 'delete');
  }

  /**
   * Forces a download of fresh media information from the internet.
   * This can take a long time. Any locked fields are not modified.
   */
  async refresh(): Promise<void> {
    const key = `/library/sections/${this.key}/refresh?force=1`;
    this.server.query(key);
  }

  /**
   * Delete the preview thumbnails for items in this library. This cannot
   * be undone. Recreating media preview files can take hours or even days.
   */
  async deleteMediaPreviews(): Promise<void> {
    const key = `/library/sections/${this.key}/indexes`;
    this.server.query(key, 'delete');
  }

  _loadData(data: SectionsDirectory): void {
    console.log('LibrarySection', data);
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
