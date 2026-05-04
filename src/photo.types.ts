import type { MediaTagData } from './video.types.js';

export type PhotoItemType = 'photo';

export interface PhotoalbumData {
  addedAt?: number | string;
  art?: string;
  composite?: string;
  guid?: string;
  index?: number | string;
  key: string;
  lastRatedAt?: number | string;
  librarySectionID?: number | string;
  librarySectionKey?: string;
  librarySectionTitle?: string;
  ratingKey?: number | string;
  summary?: string;
  thumb?: string;
  title: string;
  titleSort?: string;
  type: PhotoItemType;
  updatedAt?: number | string;
  userRating?: number | string;
  Field?: Array<{ locked?: boolean | number | string; name: string }>;
  Image?: Array<{ alt?: string; type?: string; url?: string }>;
}

export interface PhotoData {
  addedAt?: number | string;
  createdAtAccuracy?: string;
  createdAtTZOffset?: number | string;
  guid?: string;
  index?: number | string;
  key: string;
  lastRatedAt?: number | string;
  librarySectionID?: number | string;
  librarySectionKey?: string;
  librarySectionTitle?: string;
  originallyAvailableAt?: string;
  parentGuid?: string;
  parentIndex?: number | string;
  parentKey?: string;
  parentRatingKey?: number | string;
  parentThumb?: string;
  parentTitle?: string;
  ratingKey?: number | string;
  source?: string;
  summary?: string;
  thumb?: string;
  title: string;
  titleSort?: string;
  type: PhotoItemType;
  updatedAt?: number | string;
  userRating?: number | string;
  year?: number | string;
  Field?: Array<{ locked?: boolean | number | string; name: string }>;
  Image?: Array<{ alt?: string; type?: string; url?: string }>;
  Media?: PhotoMediaData[];
  Tag?: MediaTagData[];
}

export interface PhotoMediaData {
  id?: number | string;
  duration?: number | string;
  bitrate?: number | string;
  width?: number | string;
  height?: number | string;
  aspectRatio?: number | string;
  audioCodec?: string;
  videoCodec?: string;
  videoFrameRate?: string;
  videoProfile?: string;
  container?: string;
  optimizedForStreaming?: boolean | number | string;
  Part?: PhotoPartData[];
}

export interface PhotoPartData {
  id?: number | string;
  key?: string;
  duration?: number | string;
  file?: string;
  size?: number | string;
  container?: string;
  videoProfile?: string;
}

export interface PhotoMetadataResponse<T> {
  Metadata: T[];
}
