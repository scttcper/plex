import type { CommonSenseMediaData, ImageData, UltraBlurColorsData } from './media.types.ts';
import type { PlexBoolean } from './util.ts';
import type {
  ChapterSource,
  EpisodeMetadata,
  MarkerData,
  MediaPartStreamData,
  MediaTagData,
} from './video.types.ts';

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
  ratingKey: string;
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
  totalSize?: number;
  totalDuration?: number;
  totalStorage?: number;
  totalViewSize?: number;
  Location: Location[];
}

export interface Location {
  id: number;
  path: string;
}

export type { PlexBoolean } from './util.ts';

export interface MediaProvidersResponse {
  MediaProvider?: MediaProviderData[];
}

export interface MediaProviderData {
  identifier: string;
  Feature?: MediaProviderFeatureData[];
}

export interface MediaProviderFeatureData {
  type: string;
  Directory?: MediaProviderDirectoryData[];
}

export interface MediaProviderDirectoryData {
  id: number | string;
  durationTotal?: number | string;
  storageTotal?: number | string;
}

export interface FolderData {
  key: string;
  title: string;
}

export interface LibraryTagData {
  key?: string;
  count?: number | string;
  id?: number | string;
  filter?: string;
  librarySectionID?: number | string;
  librarySectionKey?: string;
  librarySectionTitle?: string;
  librarySectionType?: number | string;
  reason?: string;
  reasonID?: number | string;
  reasonTitle?: string;
  score?: number | string;
  type?: string;
  tag: string;
  tagKey?: string;
  tagType?: number | string;
  tagValue?: number | string;
  thumb?: string;
}

export interface FirstCharacterData {
  key: string;
  title: string;
  size: number;
}

export interface LibraryTimelineData {
  size: number | string;
  allowSync: PlexBoolean;
  art?: string;
  content: string;
  identifier: string;
  latestEntryTime: number | string;
  mediaTagPrefix: string;
  mediaTagVersion: number | string;
  thumb?: string;
  title1: string;
  updateQueueSize: number | string;
  viewGroup: string;
  viewMode?: number | string;
}

export interface ManagedHubData {
  deletable?: PlexBoolean;
  homeVisibility?: string;
  identifier: string;
  librarySectionID?: number | string;
  promotedToOwnHome?: PlexBoolean;
  promotedToRecommended?: PlexBoolean;
  promotedToSharedHome?: PlexBoolean;
  recommendationsVisibility?: string;
  title: string;
}

export interface FilterChoiceData {
  fastKey: string;
  key: string;
  thumb?: string;
  title: string;
  type: string;
}

export interface FilteringTypeData {
  active?: PlexBoolean;
  key: string;
  title: string;
  type: string;
  Field?: FilteringFieldData[];
  Filter?: FilteringFilterData[];
  Sort?: FilteringSortData[];
}

export interface FilteringFilterData {
  filter: string;
  filterType: string;
  key: string;
  title: string;
  type: string;
}

export interface FilteringSortData {
  active?: PlexBoolean;
  activeDirection?: string;
  default?: string;
  defaultDirection?: string;
  descKey?: string;
  firstCharacterKey?: string;
  key: string;
  title: string;
}

export interface FilteringFieldData {
  key: string;
  title: string;
  type: string;
  subType?: string;
}

export interface FilteringFieldTypeData {
  type: string;
  Operator?: FilteringOperatorData[];
}

export interface FilteringOperatorData {
  key: string;
  title: string;
}

export interface LibraryFilterMetaData {
  Type?: FilteringTypeData[];
  FieldType?: FilteringFieldTypeData[];
}

export interface CommonData {
  Collection?: MediaTagData[];
  Country?: MediaTagData[];
  Director?: MediaTagData[];
  Field?: Array<{ locked?: PlexBoolean; name: string }>;
  Genre?: MediaTagData[];
  Guid?: Guid[];
  Label?: MediaTagData[];
  Mood?: MediaTagData[];
  Producer?: MediaTagData[];
  Rating?: MediaRating[];
  Role?: MediaTag[];
  Style?: MediaTagData[];
  Tag?: MediaTagData[];
  Writer?: MediaTag[];
  contentRating?: string;
  editionTitle?: string;
  grandparentRatingKey?: number | string;
  grandparentTitle?: string;
  guid?: string;
  index?: number | string;
  key?: string;
  mixedFields: string;
  originallyAvailableAt?: string;
  parentRatingKey?: number | string;
  parentTitle?: string;
  ratingKey?: number | string;
  studio?: string;
  summary?: string;
  tagline?: string;
  title?: string;
  titleSort?: string;
  type?: string;
  year?: number | string;
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
  Metadata: MovieData[];
}

export interface MovieData {
  ratingKey: string;
  userRating?: number;
  audienceRating?: number;
  audienceRatingImage?: string;
  originalTitle?: string;
  key: string;
  guid: string;
  studio?: string;
  type: string;
  title: string;
  titleSort?: string;
  librarySectionID?: number;
  contentRating?: string;
  summary?: string;
  rating?: number;
  viewCount?: number;
  viewOffset?: number;
  lastViewedAt?: number;
  year: number;
  tagline?: string;
  thumb?: string;
  art?: string;
  duration?: number;
  editionTitle?: string;
  originallyAvailableAt?: string;
  addedAt: number;
  updatedAt: number;
  chapterSource?: ChapterSource;
  primaryExtraKey?: string;
  ratingImage?: string;
  Media?: Media[];
  Genre?: MediaTag[];
  Director?: MediaTag[];
  Writer?: MediaTag[];
  Country?: MediaTag[];
  Collection?: MediaTagData[];
  CommonSenseMedia?: CommonSenseMediaData[];
  Role?: MediaTag[];
  Similar?: MediaTagData[];
  Producer?: MediaTagData[];
  Extras?: ExtrasData[];
  Guid?: Guid[];
  Image?: ImageData[];
  Marker?: MarkerData[];
  Rating?: MediaRating[];
  UltraBlurColors?: UltraBlurColorsData;
}

export interface MediaTag {
  tag: string;
}

export interface Media {
  id: number;
  duration: number;
  bitrate?: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
  audioChannels?: number;
  audioCodec?: string;
  audioProfile?: string;
  container?: string;
  has64bitOffsets?: boolean;
  hasVoiceActivity?: boolean;
  optimizedForStreaming?: boolean;
  videoCodec?: string;
  videoFrameRate?: string;
  videoProfile?: string;
  videoResolution?: string;
  Part: Part[];
}

export interface Guid {
  id: string;
}

export interface Part {
  id: number;
  key: string;
  duration: number;
  file: string;
  size: number;
  container: string;
  audioProfile?: string;
  has64bitOffsets?: boolean;
  optimizedForStreaming?: boolean;
  videoProfile?: string;
  Stream?: MediaPartStreamData[];
}

export interface FullShowData {
  size: number;
  allowSync: boolean;
  identifier: string;
  librarySectionID: number;
  librarySectionTitle: string;
  librarySectionUUID: string;
  mediaTagPrefix: string;
  mediaTagVersion: number;
  Metadata: ShowData[];
}

export interface ShowData {
  ratingKey: string;
  key: string;
  guid: string;
  studio?: string;
  type: string;
  title: string;
  librarySectionTitle?: string;
  librarySectionID?: number;
  librarySectionKey?: string;
  parentKey?: string;
  parentRatingKey?: string;
  parentTitle?: string;
  contentRating?: string;
  contentRatingAge?: number | string;
  summary?: string;
  index: number;
  rating?: number;
  audienceRating?: number;
  audienceRatingImage?: string;
  year: number;
  thumb: string;
  art: string;
  banner?: string;
  theme: string;
  duration?: number;
  editionTitle?: string;
  originallyAvailableAt?: string;
  leafCount: number;
  viewedLeafCount: number;
  childCount: number;
  addedAt: number;
  updatedAt: number;
  Genre?: MediaTag[];
  Role?: MediaTag[];
  Country?: MediaTag[];
  CommonSenseMedia?: CommonSenseMediaData[];
  Image?: ImageData[];
  UltraBlurColors?: UltraBlurColorsData;
  slug?: string;
  tagline?: string;
  OnDeck?: { Metadata?: EpisodeMetadata };
}

export interface CollectionData {
  ratingKey: string;
  key: string;
  guid: string;
  type: string;
  title: string;
  titleSort?: string;
  smart?: PlexBoolean;
  content?: string;
  collectionMode?: number;
  collectionSort?: number;
  librarySectionTitle: string;
  librarySectionID: number;
  librarySectionKey: string;
  contentRating: string;
  subtype: string;
  summary: string;
  index: number;
  rating?: number;
  userRating?: number;
  thumb: string;
  art?: string;
  addedAt: number;
  updatedAt: number;
  childCount: string;
  size: number;
  maxYear: string;
  minYear: string;
}

export interface ExtrasData {
  ratingKey: string;
  key: string;
  guid: string;
  type: string;
  title: string;
  titleSort: string;
  summary: string;
  index: number;
  thumb: string;
  subtype: string;
  duration: number;
  addedAt: number;
  extraType: number;
  Media: ExtrasMedia[];
}

export interface ExtrasMedia {
  id: number;
  duration: number;
  bitrate: number;
  width: number;
  height: number;
  aspectRatio: number;
  audioCodec: string;
  videoCodec: string;
  videoResolution: string;
  container: string;
  optimizedForStreaming: number;
  protocol: string;
  premium: boolean;
  Part: Array<{
    id: number;
    duration: number;
    container: string;
    key: string;
    Stream: ExtrasStream[];
  }>;
}

interface ExtrasStream {
  id: number;
  streamType: number;
  codec: string;
  index: number;
  bitrate?: number;
  height?: number;
  width?: number;
  displayTitle: string;
  extendedDisplayTitle: string;
  selected?: boolean;
  channels?: number;
}

interface MediaRating {
  image: string;
  /**
   * ex 8.3
   */
  value: number;
  /**
   * ex 'audience'
   */
  type: string;
}
