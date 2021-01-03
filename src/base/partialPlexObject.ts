import { URLSearchParams } from 'url';

import { PlexObject } from './plexObject';
import { SearchResult } from '../search';
import { getAgentIdentifier, MediaContainer } from '../util';
import { MatchSearchResult } from '../search.types';

export abstract class PartialPlexObject extends PlexObject {
  _INCLUDES = {
    checkFiles: 1,
    includeAllConcerts: 1,
    includeBandwidths: 1,
    includeChapters: 1,
    includeChildren: 1,
    includeConcerts: 1,
    includeExternalMedia: 1,
    includeExtras: 1,
    includeFields: 'thumbBlurHash,artBlurHash',
    includeGeolocation: 1,
    includeLoudnessRamps: 1,
    includeMarkers: 1,
    includeOnDeck: 1,
    includePopularLeaves: 1,
    includePreferences: 1,
    includeRelated: 1,
    includeRelatedCount: 1,
    includeReviews: 1,
    includeStations: 1,
  };

  ratingKey?: string;
  title?: string;
  year?: number;
  librarySectionID?: number;
  _details_key = this._buildDetailsKey();

  /**
   * load full data / reload the data for this object from self.key.
   */
  async reload(ekey?: string, args?: any): Promise<void> {
    const detailsKey = this._buildDetailsKey(args);
    const key = ekey ?? detailsKey ?? this.key;
    if (!key) {
      throw new Error('Cannot reload an object not built from a URL');
    }

    this.initpath = key;
    const data = await this.server.query(key);
    const innerData = data.MediaContainer ? data.MediaContainer : data;
    this._loadFullData(innerData);
  }

  /**
   * Retruns True if this is already a full object. A full object means all attributes
   * were populated from the api path representing only this item. For example, the
   * search result for a movie often only contain a portion of the attributes a full
   * object (main url) for that movie would contain.
   */
  get isFullObject(): boolean {
    return !this.key || (this._details_key || this.key) === this.initpath;
  }

  /**
   * Use match result to update show metadata.
   * @param searchResult (:class:`~plexapi.media.SearchResult`): Search result from
   *  ~plexapi.base.matches()
   * @param auto True uses first match from matches, False allows user to provide the match
   * @param agent (str): Agent name to be used (imdb, thetvdb, themoviedb, etc.)
   */
  async fixMatch(searchResult: SearchResult, auto: boolean, agent: string) {
    const key = `/library/metadata/${this.ratingKey!}/match`;
    if (auto) {
      // const autoMatch = this.ma
    }
    // TODO: Auto match using first result

    // TODO: incomplete
    return key;
  }

  /**
   *
   * @param agent Agent name to be used (imdb, thetvdb, themoviedb, etc.)
   * @param title Title of item to search for
   * @param year Year of item to search in
   * @param language Language of item to search in
   *
   *  Examples:
   *  1. video.matches()
   *  2. video.matches(title="something", year=2020)
   *  3. video.matches(title="something")
   *  4. video.matches(year=2020)
   *  5. video.matches(title="something", year="")
   *  6. video.matches(title="", year=2020)
   *  7. video.matches(title="", year="")
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
  async matches(
    agent?: string,
    title?: string,
    year?: string,
    language?: string,
  ): Promise<SearchResult[]> {
    const key = `/library/metadata/${this.ratingKey!}/matches`;
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
        params.append('title', this.title!);
      }

      if (year) {
        params.append('year', year);
      } else {
        params.append('year', this.year!.toString());
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

    const data = await this.server.query<MediaContainer<{ SearchResult: MatchSearchResult[] }>>(
      `${key}?${params.toString()}`,
      'get',
    );
    return data.MediaContainer.SearchResult.map(r => new SearchResult(this.server, r));
  }

  /** Unmatches metadata match from object. */
  async unmatch() {
    const key = `/library/metadata/${this.ratingKey!}/unmatch`;
    return this.server.query(key, 'put');
  }

  async section() {
    return (await this.server.library()).sectionByID(this.librarySectionID!);
  }

  protected abstract _loadFullData(data: any): void;
}
