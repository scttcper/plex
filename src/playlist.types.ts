import type { ArtistData } from './audio.types.ts';

export interface PlaylistResponse {
  ratingKey: string;
  key: string;
  guid: string;
  type: string;
  title: string;
  summary: string;
  smart: boolean;
  playlistType: string;
  composite: string;
  leafCount: number;
  addedAt: number;
  updatedAt: number;

  // below props might be for audio playlists?
  allowSync?: boolean;
  duration?: number;
  durationInSeconds?: number;
  /** Nested artist that a personalized "Mix For You" playlist is centered on. */
  Directory?: Array<ArtistData & { centroid?: boolean | number | string }>;
}

export interface PlaylistItemData {
  type: string;
  playlistItemID?: number;
}

export interface PlaylistContainerResponse {
  MediaContainer: {
    Metadata: PlaylistResponse[];
  };
}
