import type { ValueOf } from 'type-fest';

import { PlexObject } from './base/plexObject.ts';
import type { AgentData, MatchSearchResult } from './search.types.ts';
import { rsplit } from './util.ts';

export class SearchResult extends PlexObject {
  static override TAG = 'SearchResult';

  declare guid: string;
  declare name: string;
  declare score: number;
  declare year: number;
  declare lifespanEnded: boolean;

  protected _loadData(data: MatchSearchResult) {
    this.guid = data.guid;
    this.lifespanEnded = data.lifespanEnded;
    this.name = data.name;
    this.score = data.score;
    this.year = data.year;
  }
}

/**
 * Represents a single Agent
 */
export class Agent extends PlexObject {
  static override TAG = 'Agent';

  declare hasAttribution?: boolean;
  declare hasPrefs: boolean;
  declare identifier: string;
  declare primary?: boolean;
  declare shortIdentifier: string;
  declare name?: string;
  declare id?: number;
  declare mediaType?: number;
  declare languageCode?: string;
  // languageCode: any[] = [];

  protected _loadData(data: AgentData) {
    this.hasAttribution = data.hasAttribution;
    this.hasPrefs = data.hasPrefs;
    this.identifier = data.identifier;
    this.primary = data.primary;
    this.shortIdentifier = rsplit(this.identifier, '.', 1)[1];
    this.name = data.name ?? data.MediaType?.name;
    this.id = data.id;
    this.mediaType = data.MediaType?.mediaType;
    this.languageCode = data.Language?.code ?? data.MediaType?.Language?.code;
  }
}

export const SEARCHTYPES = {
  movie: 1,
  show: 2,
  season: 3,
  episode: 4,
  trailer: 5,
  comic: 6,
  person: 7,
  artist: 8,
  album: 9,
  track: 10,
  picture: 11,
  clip: 12,
  photo: 13,
  photoalbum: 14,
  playlist: 15,
  playlistFolder: 16,
  collection: 18,
  optimizedVersion: 42,
  userPlaylistItem: 1001,
} as const;

type SearchTypesValues = ValueOf<typeof SEARCHTYPES>;

/**
 * Returns the integer value of the library string type.
 * @param libtype to lookup (movie, show, season, episode, artist, album, track, collection)
 */
export function searchType(
  libtype?: string | number | keyof typeof SEARCHTYPES | SearchTypesValues,
): SearchTypesValues {
  if (
    libtype &&
    Object.values(SEARCHTYPES)
      .map(num => num.toString())
      .includes(`${libtype}`)
  ) {
    return Number(libtype) as SearchTypesValues;
  }

  if (libtype && SEARCHTYPES[libtype as keyof typeof SEARCHTYPES] !== undefined) {
    return SEARCHTYPES[libtype as keyof typeof SEARCHTYPES];
  }

  throw new Error(`Unknown libtype: ${libtype}`);
}
