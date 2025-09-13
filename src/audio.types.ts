import type { MediaTagData } from './video.types.js';

export interface UltraBlurColorsData {
  topLeft?: string;
  topRight?: string;
  bottomRight?: string;
  bottomLeft?: string;
}

export interface AlbumData {
  // Core identifiers and meta
  key: string;
  type: string;
  title: string;
  summary?: string;
  librarySectionID?: number;
  addedAt?: number;
  updatedAt?: number;

  // Album-specific numeric/text fields
  audienceRating?: number;
  leafCount?: number;
  loudnessAnalysisVersion?: number;
  originallyAvailableAt?: string; // YYYY-MM-DD
  parentGuid?: string;
  parentKey?: string;
  parentRatingKey?: number;
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
  UltraBlurColors?: UltraBlurColorsData[];
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
  parentRatingKey?: number;
  parentGuid?: string;
  parentThumb?: string;
  parentTitle?: string;
  parentIndex?: number; // disc number

  grandparentKey?: string;
  grandparentRatingKey?: number;
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
  skipCount?: number;
  source?: string; // remote playlist items
  viewOffset?: number;

  // Tag arrays
  Chapter?: import('./video.types.js').ChapterData[];
  Collection?: MediaTagData[];
  Genre?: MediaTagData[];
  Guid?: MediaTagData[];
  Label?: MediaTagData[];
  Media?: import('./video.types.js').MediaData[];
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

  // Tag arrays
  Country?: MediaTagData[];
  Genre?: MediaTagData[];
  Guid?: MediaTagData[];
  Label?: MediaTagData[];
  Similar?: MediaTagData[];
  Style?: MediaTagData[];
  Collection?: MediaTagData[];
  UltraBlurColors?: UltraBlurColorsData;
  Image?: Array<{ alt?: string; type?: string; url?: string }>;
}
