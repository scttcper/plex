import type { Playable } from './base/playable.js';

export interface PlayQueueResponse {
  /** PlayQueue identifier */
  identifier: string;
  /** Media tag prefix path */
  mediaTagPrefix: string;
  /** Media tag version number */
  mediaTagVersion: number;
  /** Unique ID of the PlayQueue */
  playQueueID: number;
  /** ID of the last added item, defines where "Up Next" region starts */
  playQueueLastAddedItemID?: number;
  /** The queue item ID of the currently selected item */
  playQueueSelectedItemID: number;
  /** The offset of the selected item in the PlayQueue */
  playQueueSelectedItemOffset: number;
  /** ID of the currently selected item, matches ratingKey */
  playQueueSelectedMetadataItemID: number;
  /** True if the PlayQueue is shuffled */
  playQueueShuffled: boolean;
  /** Original URI used to create the PlayQueue */
  playQueueSourceURI: string;
  /** Total number of items in the PlayQueue */
  playQueueTotalCount: number;
  /** Version of the PlayQueue, increments on changes */
  playQueueVersion: number;
  /** Total size of the PlayQueue (alias for playQueueTotalCount) */
  size: number;
}

export interface CreatePlayQueueOptions {
  /** Media item in the PlayQueue where playback should begin */
  startItem?: Playable;
  /** Start the playqueue shuffled */
  shuffle?: boolean;
  /** Start the playqueue with repeat enabled */
  repeat?: boolean;
  /** Include chapters */
  includeChapters?: boolean;
  /** Include related content */
  includeRelated?: boolean;
  /** Include additional items after the initial item */
  continuous?: boolean;
}

export interface GetPlayQueueOptions {
  /** If server should transfer ownership */
  own?: boolean;
  /** The playQueueItemID of the center of the window */
  center?: number;
  /** Number of items to return from each side of the center item */
  window?: number;
  /** Include items before the center */
  includeBefore?: boolean;
  /** Include items after the center */
  includeAfter?: boolean;
}

export interface AddPlayQueueItemOptions {
  /** If true, add item to front of "Up Next" section */
  playNext?: boolean;
  /** Refresh the PlayQueue from server before updating */
  refresh?: boolean;
}

export interface MovePlayQueueItemOptions {
  /** Item to place the moved item after */
  after?: Playable;
  /** Refresh the PlayQueue from server before updating */
  refresh?: boolean;
}
