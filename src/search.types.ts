import type { UltraBlurColorsData } from './audio.types.js';

export interface MatchSearchResult {
  thumb: string;
  guid: string;
  name: string;
  score: number;
  year: number;
  lifespanEnded: boolean;
}

export interface AgentData {
  hasAttribution?: boolean;
  hasPrefs: boolean;
  identifier: string;
  primary?: boolean;
  name?: string;
  id?: number;
  MediaType?: {
    name: string;
    mediaType: number;
    Language?: {
      code: string;
      title?: string;
    };
  };
  Language?: {
    code: string;
    title?: string;
  };
}

export interface SearchResultContainer {
  title: string;
  type: string;
  key?: string;
  hubKey?: string;
  hubIdentifier: string;
  context: string;
  librarySectionID?: number | string;
  size: number;
  more: boolean;
  promoted?: boolean | number | string;
  random?: boolean | number | string;
  style: string;
  Directory?: Directory[];
  Metadata?: SearchResult[];
}

export interface Directory {
  key: string;
  librarySectionID: number;
  librarySectionKey: string;
  librarySectionTitle: string;
  librarySectionType: number;
  reason: string;
  reasonID: number;
  reasonTitle: string;
  type: string;
  id: number;
  filter: string;
  tag: string;
  tagType: number;
  count: number;
  thumb?: string;
}

export interface SearchResult {
  allowSync?: boolean;
  librarySectionTitle: string;
  ratingKey: string;
  key: string;
  guid: string;
  slug?: string;
  studio?: string;
  type: string;
  title: string;
  contentRating?: string;
  contentRatingAge?: number;
  summary?: string;
  rating?: number;
  audienceRating?: number;
  audienceRatingImage?: string;
  viewCount?: number;
  lastViewedAt?: number;
  year?: number;
  tagline?: string;
  thumb?: string;
  art?: string;
  duration?: number;
  originallyAvailableAt?: string;
  addedAt?: number;
  updatedAt?: number;
  chapterSource?: string;
  primaryExtraKey?: string;
  ratingImage?: string;
  Image?: Array<{ alt?: string; type?: string; url?: string }>;
  UltraBlurColors?: UltraBlurColorsData;
  Media?: Media[];
  Genre?: CollectionTagData[];
  Director?: CollectionTagData[];
  Writer?: CollectionTagData[];
  Country?: CollectionTagData[];
  Collection?: CollectionTagData[];
  Role?: CollectionTagData[];
  parentRatingKey?: string;
  grandparentRatingKey?: string;
  parentGuid?: string;
  grandparentGuid?: string;
  titleSort?: string;
  grandparentKey?: string;
  parentKey?: string;
  grandparentTitle?: string;
  parentTitle?: string;
  index?: number;
  parentIndex?: number;
  parentThumb?: string;
  grandparentThumb?: string;
  grandparentArt?: string;
  grandparentTheme?: string;
  librarySectionID?: number | string;
  librarySectionKey?: string;
  librarySectionUUID?: string;
  reason?: string;
  reasonID?: number;
  reasonTitle?: string;
  banner?: string;
  theme?: string;
  leafCount?: number;
  viewedLeafCount?: number;
  childCount?: number;
  Field?: Field[];
  Location?: Location[];
}

interface CollectionTagData {
  tag: string;
}

interface Field {
  locked: boolean;
  name: string;
}

interface Location {
  path: string;
}

export interface Media {
  id: number;
  duration: number;
  bitrate: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
  audioChannels?: number;
  audioCodec?: string;
  videoCodec?: string;
  videoResolution?: string;
  container?: string;
  videoFrameRate?: string;
  optimizedForStreaming?: boolean | number;
  has64bitOffsets?: boolean;
  hasVoiceActivity?: boolean;
  videoProfile: string;
  Part: Part[];
  audioProfile?: string;
}

export interface Part {
  id: number;
  key: string;
  duration: number;
  file: string;
  size: number;
  container: string;
  has64bitOffsets?: boolean;
  optimizedForStreaming?: boolean;
  videoProfile: string;
  audioProfile?: string;
}
