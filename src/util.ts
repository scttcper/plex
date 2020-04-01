export interface MediaContainer<T> {
  MediaContainer: T;
}

export interface MetadataContainer<T extends { Metadata: any }> {
  MediaContainer: T;
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
  userPlaylistItem: 1001,
} as const;
