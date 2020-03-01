export interface LibraryRootResponse {
  size: number;
  allowSync: boolean;
  art: string;
  content: string;
  identifier: string;
  mediaTagPrefix: string;
  mediaTagVersion: number;
  title1: string;
  title2: string;
  Directory: Directory[];
}

export interface Directory {
  key: string;
  title: string;
}

export interface SectionsResponse {
  size: number;
  allowSync: boolean;
  identifier: string;
  mediaTagPrefix: string;
  mediaTagVersion: number;
  title1: string;
  Directory: SectionsDirectory[];
}

export interface SectionsDirectory {
  allowSync: boolean;
  art: string;
  composite: string;
  filters: boolean;
  refreshing: boolean;
  thumb: string;
  key: string;
  type: string;
  title: string;
  agent: string;
  scanner: string;
  language: string;
  uuid: string;
  updatedAt: number;
  createdAt: number;
  scannedAt: number;
  content: boolean;
  directory: boolean;
  contentChangedAt: number;
  Location: Location[];
}

export interface Location {
  id: number;
  path: string;
}

export interface MediaItems {
  size: number;
  allowSync: boolean;
  art: string;
  identifier: string;
  librarySectionID: number;
  librarySectionTitle: string;
  librarySectionUUID: string;
  mediaTagPrefix: string;
  mediaTagVersion: number;
  thumb: string;
  title1: string;
  title2: string;
  viewGroup: string;
  viewMode: number;
  Metadata: MediaItem[];
}

export interface MediaItem {
  ratingKey: string;
  userRating?: number;
  audienceRating?: number;
  audienceRatingImage?: string;
  originalTitle?: string;
  key: string;
  guid: string;
  studio: string;
  type: string;
  title: string;
  titleSort: string;
  contentRating: string;
  summary: string;
  rating: number;
  viewCount?: number;
  viewOffset?: number;
  lastViewedAt?: number;
  year: number;
  tagline: string;
  thumb: string;
  art: string;
  duration: number;
  originallyAvailableAt: string;
  addedAt: number;
  updatedAt: number;
  chapterSource: string;
  primaryExtraKey: string;
  ratingImage: string;
  Media: Media[];
  Genre: Country[];
  Director: Country[];
  Writer: Country[];
  Country: Country[];
  Role: Country[];
}

export interface Country {
  tag: string;
}

export interface Media {
  id: number;
  duration: number;
  bitrate: number;
  videoProfile: string;
  Part: Part[];
}

export interface Part {
  id: number;
  key: string;
  duration: number;
  file: string;
  size: number;
  container: string;
  videoProfile: string;
}
