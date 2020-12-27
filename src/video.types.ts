export interface FullShowResponse {
  size: number;
  allowSync: boolean;
  art: string;
  banner: string;
  identifier: string;
  key: string;
  librarySectionID: number;
  librarySectionTitle: string;
  librarySectionUUID: string;
  mediaTagPrefix: string;
  mediaTagVersion: number;
  nocache: boolean;
  parentIndex: number;
  parentTitle: string;
  parentYear: number;
  summary: string;
  theme: string;
  thumb: string;
  title1: string;
  title2: string;
  viewGroup: string;
  viewMode: number;
  Directory: ShowDirectory[];
  Metadata: FullTvMetadata[];
}

export interface ShowDirectory {
  leafCount: number;
  thumb: string;
  viewedLeafCount: number;
  key: string;
  title: string;
}

export interface FullTvMetadata {
  ratingKey: string;
  key: string;
  parentRatingKey: string;
  guid: string;
  parentGuid: string;
  type: string;
  title: string;
  parentKey: string;
  parentTitle: string;
  summary: string;
  index: number;
  parentIndex: number;
  thumb: string;
  art: string;
  parentThumb: string;
  parentTheme: string;
  leafCount: number;
  viewedLeafCount: number;
  addedAt: number;
  updatedAt: number;
}

export interface FullMovieResponse {
  size: number;
  allowSync: boolean;
  identifier: string;
  librarySectionID: number;
  librarySectionTitle: string;
  librarySectionUUID: string;
  mediaTagPrefix: string;
  mediaTagVersion: number;
  Metadata: TitleMetadatum[];
}

export interface TitleMetadatum {
  ratingKey: string;
  key: string;
  guid: string;
  studio: string;
  type: string;
  title: string;
  titleSort?: string;
  librarySectionTitle: string;
  librarySectionID: number;
  librarySectionKey: string;
  contentRating: string;
  summary: string;
  rating: number;
  viewCount?: number;
  lastViewedAt?: number;
  year: number;
  tagline?: string;
  thumb: string;
  art: string;
  duration: number;
  originallyAvailableAt: string;
  addedAt: number;
  updatedAt: number;
  chapterSource?: ChapterSource;
  primaryExtraKey: string;
  ratingImage: string;
  Media: MovieMedia[];
  Genre: MediaTagData[];
  Director: MediaTagData[];
  Writer: MediaTagData[];
  Producer: MediaTagData[];
  Country: MediaTagData[];
  Role: Role[];
  Similar?: MediaTagData[];
  Chapter?: Chapter[];
  Collection?: MediaTagData[];
  Field?: Field[];
  Extras: Extras;
  Related: Related;
}

export interface Chapter extends MediaTagData {
  index: number;
  startTimeOffset: number;
  endTimeOffset: number;
  thumb?: string;
}

export interface MediaTagData {
  id?: number;
  filter?: string;
  tag: string;
}

export interface Extras {
  size: number;
  Metadata: ExtrasMetadatum[];
}

export interface ExtrasMetadatum {
  ratingKey: string;
  key: string;
  guid: string;
  type: string;
  title: string;
  titleSort?: string;
  summary: string;
  index: number;
  year: number;
  thumb: string;
  subtype: string;
  duration: number;
  originallyAvailableAt: string;
  addedAt: number;
  extraType: string;
  Media: PurpleMedia[];
}

export interface PurpleMedia {
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
  premium: boolean;
  Part: PurplePart[];
}

export interface PurplePart {
  id: number;
  duration: number;
  container: string;
  key: string;
  optimizedForStreaming: boolean;
  Stream: PurpleStream[];
}

export interface PurpleStream {
  id: number;
  streamType: number;
  codec: string;
  index: number;
  bitrate?: number;
  height?: number;
  width?: number;
  displayTitle: string;
  selected?: boolean;
  channels?: number;
  language?: string;
  languageCode?: string;
}

export interface Field {
  locked: boolean;
  name: string;
}

export interface MovieMedia {
  id: number;
  duration: number;
  bitrate: number;
  videoProfile: string;
  Part: MoviePart[];
  width?: number;
  height?: number;
  aspectRatio?: number;
  audioChannels?: number;
  audioCodec?: string;
  videoCodec?: string;
  videoResolution?: string;
  container?: string;
  videoFrameRate?: string;
}

export interface MoviePart {
  accessible: boolean;
  exists: boolean;
  id: number;
  key: string;
  duration: number;
  file: string;
  size: number;
  container: string;
  videoProfile: string;
  Stream: MovieStream[];
}

export interface MovieStream {
  id: number;
  streamType: number;
  default?: boolean;
  codec: string;
  index: number;
  bitrate?: number;
  bitDepth?: number;
  chromaLocation?: string;
  chromaSubsampling?: string;
  frameRate?: number;
  hasScalingMatrix?: boolean;
  height?: number;
  level?: number;
  profile?: string;
  refFrames?: number;
  scanType?: string;
  width?: number;
  displayTitle: string;
  selected?: boolean;
  channels?: number;
  language?: string;
  languageCode?: string;
  audioChannelLayout?: string;
  samplingRate?: number;
  title?: string;
  codedHeight?: string;
  codedWidth?: string;
  colorPrimaries?: string;
  colorRange?: string;
  colorSpace?: string;
  colorTrc?: string;
  headerCompression?: boolean;
  forced?: boolean;
}

export interface Related {
  Hub: RelatedHub[];
}

export interface RelatedHub {
  hubKey: string;
  key: string;
  title: string;
  type: string;
  hubIdentifier: string;
  context: string;
  size: number;
  more: boolean;
  style: string;
  Metadata: RelatedMetadata[];
}

export interface RelatedMetadata {
  ratingKey: string;
  key: string;
  guid: string;
  studio: string;
  type: string;
  title: string;
  titleSort?: string;
  librarySectionTitle?: string;
  librarySectionID?: number;
  librarySectionKey?: string;
  contentRating: string;
  summary: string;
  rating?: number;
  year: number;
  tagline?: string;
  thumb: string;
  art: string;
  duration: number;
  originallyAvailableAt: string;
  addedAt: number;
  updatedAt: number;
  chapterSource?: ChapterSource;
  primaryExtraKey?: string;
  ratingImage?: string;
  Media: RelatedMedia[];
  Genre: MediaTagData[];
  Director: MediaTagData[];
  Writer: MediaTagData[];
  Producer?: MediaTagData[];
  Country: MediaTagData[];
  Role: Role[];
  Similar?: MediaTagData[];
  Chapter?: Chapter[];
  Field?: Field[];
  viewCount?: number;
  lastViewedAt?: number;
}

export interface RelatedMedia {
  id: number;
  duration: number;
  bitrate: number;
  videoProfile: string;
  Part: RelatedMediaPart[];
  width?: number;
  height?: number;
  aspectRatio?: number;
  audioChannels?: number;
  audioCodec?: string;
  videoCodec?: string;
  videoResolution?: string;
  container?: string;
  videoFrameRate?: string;
  audioProfile?: string;
}

export interface RelatedMediaPart {
  id: number;
  key: string;
  duration: number;
  file: string;
  size: number;
  container: string;
  videoProfile: string;
  Stream?: MovieStream[];
  audioProfile?: string;
  hasThumbnail?: string;
}

export interface Role {
  id?: number;
  filter?: string;
  tag: string;
  role?: string;
  thumb?: string;
}

export enum ChapterSource {
  Agent = 'agent',
  Media = 'media',
  Mixed = 'mixed',
}

export interface ShowAllLeaves {
  size: number;
  allowSync: boolean;
  art: string;
  banner: string;
  identifier: string;
  key: string;
  librarySectionID: number;
  librarySectionTitle: string;
  librarySectionUUID: string;
  mediaTagPrefix: string;
  mediaTagVersion: number;
  mixedParents: boolean;
  nocache: boolean;
  parentIndex: number;
  parentTitle: string;
  parentYear: number;
  theme: string;
  title1: string;
  title2: string;
  viewGroup: string;
  viewMode: number;
  Metadata: EpisodeMetadata[];
}

export interface EpisodeMetadata {
  ratingKey: string;
  key: string;
  parentRatingKey: string;
  grandparentRatingKey: string;
  guid: string;
  studio: string;
  type: string;
  title: string;
  grandparentKey: string;
  parentKey: string;
  grandparentTitle: string;
  parentTitle: string;
  contentRating: string;
  summary: string;
  index: number;
  parentIndex: number;
  rating: number;
  year: number;
  thumb: string;
  art: string;
  parentThumb: string;
  grandparentThumb: string;
  grandparentArt: string;
  grandparentTheme: string;
  duration: number;
  originallyAvailableAt: Date;
  addedAt: number;
  updatedAt: number;
  Media: EpisodeMedia[];
  Writer?: Array<{ tag: string }>;
  titleSort?: string;
}

export interface EpisodeMedia {
  id: number;
  duration: number;
  bitrate: number;
  width: number;
  height: number;
  aspectRatio: number;
  audioChannels: number;
  audioCodec: string;
  videoCodec: string;
  videoResolution: string;
  container: string;
  videoFrameRate: string;
  optimizedForStreaming: number;
  audioProfile: string;
  has64bitOffsets: boolean;
  videoProfile: string;
  Part: EpisodePart[];
}

export interface EpisodePart {
  id: number;
  key: string;
  duration: number;
  file: string;
  size: number;
  audioProfile: string;
  container: string;
  has64bitOffsets: boolean;
  optimizedForStreaming: boolean;
  videoProfile: string;
}
