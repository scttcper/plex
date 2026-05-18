export interface SearchResultData {
  guid: string;
  name: string;
  score: number;
  year: number;
  lifespanEnded: boolean;
}

export interface ImageData {
  alt?: string;
  type?: string;
  url?: string;
}

export interface UltraBlurColorsData {
  topLeft?: string;
  topRight?: string;
  bottomRight?: string;
  bottomLeft?: string;
}

export interface CommonSenseMediaData {
  AgeRating?: AgeRatingData[];
  anyGood?: string;
  id?: number | string;
  key?: string;
  oneLiner?: string;
  ParentalAdvisoryTopic?: ParentalAdvisoryTopicData[];
  parentsNeedToKnow?: string;
  TalkingPoint?: TalkingPointData[];
}

export interface AgeRatingData {
  age?: number | string;
  ageGroup?: string;
  rating?: number | string;
  ratingCount?: number | string;
  type?: string;
}

export interface TalkingPointData {
  tag?: string;
}

export interface ParentalAdvisoryTopicData {
  id?: string;
  label?: string;
  positive?: boolean | number | string;
  rating?: number | string;
  tag?: string;
}
