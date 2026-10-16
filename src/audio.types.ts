import type { GuidData, ImageData, UltraBlurColorsData } from './media.types.ts';
import type { ChapterData, Field, MediaData, MediaTagData } from './video.types.ts';

type NumericValue = number | `${number}`;

/** Fields shared by artists, albums, and tracks. */
export interface AudioItemData {
  key: string;
  type: string;
  title?: string;
  ratingKey?: string;
  guid?: string;
  index?: NumericValue;
  summary?: string;
  thumb?: string;
  art?: string;
  artBlurHash?: string;
  thumbBlurHash?: string;
  /** Sonic distance, only on sonically similar results. */
  distance?: NumericValue;
  librarySectionID?: NumericValue;
  librarySectionKey?: string;
  librarySectionTitle?: string;
  addedAt?: number;
  updatedAt?: number;
  lastRatedAt?: number;
  lastViewedAt?: number;
  musicAnalysisVersion?: NumericValue;
  playlistItemID?: number;
  titleSort?: string;
  userRating?: NumericValue;
  viewCount?: number;
  Field?: Field[];
  Image?: ImageData[];
  Location?: Array<{ path: string }>;
  Mood?: MediaTagData[];
  UltraBlurColors?: UltraBlurColorsData;
}

export interface AlbumData extends AudioItemData {
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
  Guid?: GuidData[];
  Label?: MediaTagData[];
  Style?: MediaTagData[];
  Subformat?: MediaTagData[];
}

export interface TrackData extends AudioItemData {
  // Core identifiers and meta
  rating?: number;
  year?: number;

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
  viewOffset?: number;

  // Tag arrays
  Chapter?: ChapterData[];
  Collection?: MediaTagData[];
  Genre?: MediaTagData[];
  Guid?: GuidData[];
  Label?: MediaTagData[];
  Media?: MediaData[];
}

export interface ArtistData extends AudioItemData {
  // Core identifiers and meta
  rating?: number;
  albumSort?: number | string;
  audienceRating?: number;
  theme?: string;

  // Tag arrays
  Country?: MediaTagData[];
  Genre?: MediaTagData[];
  Guid?: GuidData[];
  Label?: MediaTagData[];
  Similar?: MediaTagData[];
  Style?: MediaTagData[];
  Collection?: MediaTagData[];
}
