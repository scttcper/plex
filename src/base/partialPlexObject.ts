import { URLSearchParams } from 'node:url';

import type { Section } from '../library.js';
import { SearchResult, searchType } from '../search.js';
import type { MatchSearchResult } from '../search.types.js';
import type { HistoryOptions } from '../server.types.js';
import { getAgentIdentifier, ltrim, type MediaContainer, tagHelper } from '../util.js';

import { PlexObject } from './plexObject.js';

export abstract class PartialPlexObject extends PlexObject {
  override _INCLUDES = {
    checkFiles: 0,
    includeAllConcerts: 0,
    includeBandwidths: 1,
    includeChapters: 1,
    includeChildren: 0,
    includeConcerts: 0,
    includeExternalMedia: 0,
    includeExtras: 0,
    includeFields: 'thumbBlurHash,artBlurHash',
    includeGeolocation: 1,
    includeLoudnessRamps: 1,
    includeMarkers: 1,
    includeOnDeck: 0,
    includePopularLeaves: 0,
    includePreferences: 0,
    includeRelated: 0,
    includeRelatedCount: 0,
    includeReviews: 0,
    includeStations: 0,
  };

  declare ratingKey?: string;
  declare title?: string;
  declare type?: string;
  declare year?: number;
  declare librarySectionID?: number;

  protected override _detailsKey = this._buildDetailsKey();

  /**
   * Tell Plex Media Server to performs analysis on it this item to gather
   *  information. Analysis includes:
   *  * Gather Media Properties: All of the media you add to a Library has
   *      properties that are useful to know–whether it's a video file, a
   *      music track, or one of your photos (container, codec, resolution, etc).
   *  * Generate Default Artwork: Artwork will automatically be grabbed from a
   *      video file. A background image will be pulled out as well as a
   *      smaller image to be used for poster/thumbnail type purposes.
   *  * Generate Video Preview Thumbnails: Video preview thumbnails are created,
   *      if you have that feature enabled. Video preview thumbnails allow
   *      graphical seeking in some Apps. It's also used in the Plex Web App Now
   *      Playing screen to show a graphical representation of where playback
   *      is. Video preview thumbnails creation is a CPU-intensive process akin
   *      to transcoding the file.
   *  * Generate intro video markers: Detects show intros, exposing the
   *      'Skip Intro' button in clients.
   */
  async analyze() {
    const key = `/${ltrim(this.key, ['/'])}/analyze`;
    await this.server.query({ path: key, method: 'put' });
  }

  /**
   * load full data / reload the data for this object from this.key.
   */
  override async reload(ekey?: string, args?: any): Promise<void> {
    this._detailsKey = this._buildDetailsKey(args);
    const key = ekey ?? this._detailsKey ?? this.key;
    if (!key) {
      throw new Error('Cannot reload an object not built from a URL');
    }

    this.initpath = key;
    const data = await this.server.query({ path: key });
    const innerData = data.MediaContainer ?? data;
    this._loadFullData(innerData);
  }

  /**
   * Retruns True if this is already a full object. A full object means all attributes
   * were populated from the api path representing only this item. For example, the
   * search result for a movie often only contain a portion of the attributes a full
   * object (main url) for that movie would contain.
   */
  get isFullObject(): boolean {
    return !this.key || (this._detailsKey || this.key) === this.initpath;
  }

  /**
   * Use match result to update show metadata.
   * @param options Match options.
   */
  async fixMatch({
    searchResult,
    auto = false,
    agent = '',
  }: {
    searchResult?: SearchResult;
    auto?: boolean;
    agent?: string;
  } = {}): Promise<void> {
    const key = `/library/metadata/${this.ratingKey}/match`;
    if (auto) {
      const autoMatch = await this.matches();
      if (autoMatch.length > 0) {
        searchResult = autoMatch[0];
      } else {
        throw new Error(`No matches found using this agent: (${agent})`);
      }
    } else if (!searchResult) {
      throw new Error('Must either provide a searchResult or set auto parameter to true');
    }

    const params = new URLSearchParams({ guid: searchResult.guid, name: searchResult.name });
    const url = `${key}?${params.toString()}`;
    await this.server.query({ path: url, method: 'put' });
  }

  /**
   * @param options Match options.
   *
   *  Examples:
   *  1. video.matches()
   *  2. video.matches({ title: "something", year: "2020" })
   *  3. video.matches({ title: "something" })
   *  4. video.matches({ year: "2020" })
   *  5. video.matches({ title: "something", year: "" })
   *  6. video.matches({ title: "", year: "2020" })
   *  7. video.matches({ title: "", year: "" })
   *
   *  1. The default behaviour in Plex Web = no params in plexapi
   *  2. Both title and year specified by user
   *  3. Year automatically filled in
   *  4. Title automatically filled in
   *  5. Explicitly searches for title with blank year
   *  6. Explicitly searches for blank title with year
   *  7. I don't know what the user is thinking... return the same result as 1
   *
   *  For 2 to 7, the agent and language is automatically filled in
   */
  async matches({
    agent,
    title,
    year,
    language,
  }: {
    agent?: string;
    title?: string;
    year?: string;
    language?: string;
  } = {}): Promise<SearchResult[]> {
    const key = `/library/metadata/${this.ratingKey}/matches`;
    const params = new URLSearchParams({ manual: '1' });

    if (agent && [title, year, language].some(x => x)) {
      const section = await this.section();
      params.append('language', section.language);
      const ident = await getAgentIdentifier(section, agent);
      params.append('agent', ident);
    } else if ([agent, title, year, language].some(x => x)) {
      if (title) {
        params.append('title', title);
      } else {
        params.append('title', this.title);
      }

      if (year) {
        params.append('year', year);
      } else {
        params.append('year', this.year.toString());
      }

      if (language) {
        params.append('language', language);
      } else {
        const section = await this.section();
        params.append('language', section.language);
      }

      if (agent) {
        params.append('agent', agent);
      } else {
        const section = await this.section();
        params.append('agent', section.agent);
      }
    }

    const data = await this.server.query<MediaContainer<{ SearchResult: MatchSearchResult[] }>>({
      path: `${key}?${params.toString()}`,
    });
    return data.MediaContainer.SearchResult.map(r => new SearchResult(this.server, r));
  }

  /** Unmatches metadata match from object. */
  async unmatch() {
    const key = `/library/metadata/${this.ratingKey}/unmatch`;
    return this.server.query({ path: key, method: 'put' });
  }

  /**
   * Get Play History for a media item.
   * @param options Filter and paging options.
   */
  async history(options: Omit<HistoryOptions, 'ratingKey'> = {}) {
    return this.server.history({ ...options, ratingKey: this.ratingKey });
  }

  async section(): Promise<Section> {
    return (await this.server.library()).sectionByID(this.librarySectionID);
  }

  /**
   * Delete a media element. This has to be enabled under settings > server > library in plex webui.
   */
  async delete(): Promise<any> {
    return this.server.query({ path: this.key, method: 'delete' });
  }

  /** Add a collection(s). */
  async addCollection(collections: string[]) {
    await this._editTags('collection', collections);
  }

  /** Remove a collection(s). */
  async removeCollection(collections: string[]) {
    await this._editTags('collection', collections, { remove: true });
  }

  /** Add a label(s). */
  async addLabel(labels: string[]) {
    await this._editTags('label', labels);
  }

  /** Remove a label(s). */
  async removeLabel(labels: string[]) {
    await this._editTags('label', labels, { remove: true });
  }

  /** Add a genre(s). */
  async addGenre(genres: string[]) {
    await this._editTags('genre', genres);
  }

  /** Remove a genre(s). */
  async removeGenre(genres: string[]) {
    await this._editTags('genre', genres, { remove: true });
  }

  getWebURL({ base }: { base?: string } = {}): string {
    return this._getWebURL({ base });
  }

  /**
   * Edit an object.
   * @param changeObj Obj of settings to edit.
   * Example:
   *  {'type': 1,
   *  'id': movie.ratingKey,
   *  'title.value': 'New Title',
   *  'collection[0].tag.tag': 'Super',
   *  'collection.locked': 0}
   */
  async edit(changeObj: Record<string, string | number>) {
    if (this.librarySectionID === undefined) {
      await this.reload();
      if (this.librarySectionID === undefined) {
        throw new Error('Missing librarySectionID');
      }
    }

    if (changeObj.id === undefined) {
      if (!this.ratingKey) {
        throw new Error('Missing ratingKey');
      }

      changeObj.id = this.ratingKey;
    }

    if (changeObj.type === undefined) {
      changeObj.type = searchType(this.type);
    }

    const strObj = Object.fromEntries(
      Object.entries(changeObj).map(([key, value]) => [key, value.toString()]),
    );
    const params = new URLSearchParams(strObj);
    const url = this.server.url(`/library/sections/${this.librarySectionID}/all`, {
      includeToken: true,
      params,
    });
    await this.server.query({ path: url.toString(), method: 'put' });
  }

  /** Set the title. */
  async editTitle(title: string): Promise<void> {
    await this.edit({ 'title.value': title, 'title.locked': 1 });
  }

  /** Set the sort title. */
  async editSortTitle(sortTitle: string): Promise<void> {
    await this.edit({ 'titleSort.value': sortTitle, 'titleSort.locked': 1 });
  }

  /** Set the summary. */
  async editSummary(summary: string): Promise<void> {
    await this.edit({ 'summary.value': summary, 'summary.locked': 1 });
  }

  /** Set the content rating (e.g. PG-13, R, TV-MA). */
  async editContentRating(contentRating: string): Promise<void> {
    await this.edit({ 'contentRating.value': contentRating, 'contentRating.locked': 1 });
  }

  /** Set the studio. */
  async editStudio(studio: string): Promise<void> {
    await this.edit({ 'studio.value': studio, 'studio.locked': 1 });
  }

  /** Set the originally available at date (release date). */
  async editOriginallyAvailableAt(date: string): Promise<void> {
    await this.edit({ 'originallyAvailableAt.value': date, 'originallyAvailableAt.locked': 1 });
  }

  protected abstract _loadFullData(data: any): void;

  /**
   * Get the Plex Web URL with the correct parameters.
   * Private method to allow overriding parameters from subclasses.
   */
  private _getWebURL({ base }: { base?: string } = {}): string {
    const params = new URLSearchParams();
    params.append('key', this.key);
    return this.server._buildWebURL({ base, endpoint: 'details', params });
  }

  /**
   * Helper to edit and refresh a tags.
   * @param tag tag name
   * @param items list of tags to add
   * @param options
   */
  private async _editTags(
    tag: string,
    items: string[],
    { locked = true, remove = false }: { locked?: boolean; remove?: boolean } = {},
  ) {
    const value = (this as any)[`${tag}s`];
    const existingCols = value?.filter((x: any) => x && remove).map((x: any) => x.tag) ?? [];
    const d = tagHelper(tag, [...existingCols, ...items], { locked, remove });
    await this.edit(d);
    await this.reload();
  }
}
