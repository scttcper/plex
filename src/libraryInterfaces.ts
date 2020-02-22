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
