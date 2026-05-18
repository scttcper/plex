import type { ImageData, UltraBlurColorsData } from './media.types.js';
import type { MediaTagData } from './video.types.js';

export interface AlbumData {
  // Core identifiers and meta
  key: string;
  type: string;
  title: string;
  ratingKey?: string;
  guid?: string;
  index?: number | string;
  summary?: string;
  thumb?: string;
  art?: string;
  librarySectionID?: number | string;
  addedAt?: number;
  updatedAt?: number;
  lastViewedAt?: number;
  viewCount?: number;

  // Album-specific numeric/text fields
  audienceRating?: number;
  leafCount?: number;
  loudnessAnalysisVersion?: number | string;
  originallyAvailableAt?: string; // YYYY-MM-DD
  parentGuid?: string;
  parentKey?: string;
  parentRatingKey?: number | string;
  parentTheme?: string;
  parentThumb?: string;
  parentTitle?: string;
  rating?: number;
  studio?: string;
  viewedLeafCount?: number;
  year?: number;

  // Tag arrays
  Collection?: MediaTagData[];
  Format?: MediaTagData[];
  Genre?: MediaTagData[];
  Guid?: MediaTagData[];
  Label?: MediaTagData[];
  Style?: MediaTagData[];
  Subformat?: MediaTagData[];
  UltraBlurColors?: UltraBlurColorsData;
  Image?: ImageData[];
}

export interface TrackData {
  // Core identifiers and meta
  key: string;
  type: string;
  title?: string;
  rating?: number;
  year?: number;
  index?: number;
  addedAt?: number;
  updatedAt?: number;

  // Relationships
  parentKey?: string;
  parentRatingKey?: number | string;
  parentGuid?: string;
  parentStudio?: string;
  parentThumb?: string;
  parentTitle?: string;
  parentYear?: number | string;
  parentIndex?: number; // disc number

  grandparentKey?: string;
  grandparentRatingKey?: number | string;
  grandparentGuid?: string;
  grandparentThumb?: string;
  grandparentTitle?: string;
  grandparentArt?: string;
  grandparentTheme?: string;

  // Misc
  audienceRating?: number;
  chapterSource?: string;
  duration?: number;
  originalTitle?: string;
  primaryExtraKey?: string;
  ratingCount?: number | string;
  skipCount?: number;
  source?: string; // remote playlist items
  lastViewedAt?: number;
  viewCount?: number;
  viewOffset?: number;
  thumb?: string;
  art?: string;
  summary?: string;
  ratingKey?: string;
  guid?: string;

  // Tag arrays
  Chapter?: Array<import('./video.types.js').ChapterData>;
  Collection?: MediaTagData[];
  Genre?: MediaTagData[];
  Guid?: MediaTagData[];
  Image?: ImageData[];
  Label?: MediaTagData[];
  Media?: Array<import('./video.types.js').MediaData>;
}

export interface ArtistData {
  // Core identifiers and meta
  key: string;
  type: string;
  title?: string;
  rating?: number;
  albumSort?: number | string;
  audienceRating?: number;
  theme?: string;
  ratingKey?: string;
  guid?: string;
  titleSort?: string;
  summary?: string;
  index?: number;
  thumb?: string;
  art?: string;
  addedAt?: number;
  updatedAt?: number;
  lastViewedAt?: number;
  viewCount?: number;

  // Tag arrays
  Country?: MediaTagData[];
  Genre?: MediaTagData[];
  Guid?: MediaTagData[];
  Label?: MediaTagData[];
  Similar?: MediaTagData[];
  Style?: MediaTagData[];
  Collection?: MediaTagData[];
  UltraBlurColors?: UltraBlurColorsData;
  Image?: ImageData[];
}
