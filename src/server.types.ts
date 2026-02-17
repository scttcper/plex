/**
 * returned from the root of a server
 */
export interface ServerRootResponse {
  size: number;
  allowCameraUpload: boolean;
  allowChannelAccess: boolean;
  allowMediaDeletion: boolean;
  allowSharing: boolean;
  allowSync: boolean;
  allowTuners: boolean;
  backgroundProcessing: boolean;
  certificate: boolean;
  companionProxy: boolean;
  countryCode: string;
  diagnostics: string;
  eventStream: boolean;
  friendlyName: string;
  hubSearch: boolean;
  itemClusters: boolean;
  livetv: number;
  machineIdentifier: string;
  mediaProviders: boolean;
  multiuser: boolean;
  myPlex: boolean;
  myPlexMappingState: string;
  myPlexSigninState: string;
  myPlexSubscription: boolean;
  myPlexUsername: string;
  ownerFeatures: string;
  photoAutoTag: boolean;
  platform: string;
  platformVersion: string;
  pluginHost: boolean;
  pushNotifications: boolean;
  readOnlyLibraries: boolean;
  requestParametersInCookie: boolean;
  streamingBrainABRVersion: number;
  streamingBrainVersion: number;
  sync: boolean;
  transcoderActiveVideoSessions: number;
  transcoderAudio: boolean;
  transcoderLyrics: boolean;
  transcoderPhoto: boolean;
  transcoderSubtitles: boolean;
  transcoderVideo: boolean;
  transcoderVideoBitrates: string;
  transcoderVideoQualities: string;
  transcoderVideoResolutions: string;
  updatedAt: number;
  updater: boolean;
  version: string;
  voiceSearch: boolean;
  Directory: Directory[];
  maxUploadBitrate?: number;
  maxUploadBitrateReason?: string;
  maxUploadBitrateReasonMessage?: string;
}

export interface Directory {
  count: number;
  key: string;
  title: string;
}

export interface HistoryMediaContainer {
  size: number;
  totalSize: number;
  offset: number;
  Metadata?: Array<HistoryResult | null | undefined>;
}

export interface HistoryResult {
  key: string;
  ratingKey: string;
  historyKey: string;
  parentKey?: string;
  grandparentKey?: string;
  title: string;
  grandparentTitle?: string;
  type: string;
  thumb: string;
  parentThumb?: string;
  grandparentThumb?: string;
  grandparentArt?: string;
  index?: number;
  parentIndex?: number;
  originallyAvailableAt?: Date;
  viewedAt: number;
  accountID: number;
  deviceID: number;
  librarySectionID: string;
}

export interface PlaylistMediaContainer {
  size: number;
  Metadata: PlaylistMetadata[];
}

export interface PlaylistMetadata {
  ratingKey: string;
  key: string;
  guid: string;
  type: string;
  title: string;
  summary: string;
  playlistType: string;
  addedAt: number;
}

export interface ConnectionInfo {
  size: number;
  Server: ServerConnectionInfo[];
}

export interface ServerConnectionInfo {
  name: string;
  host: string;
  address: string;
  port?: number;
  machineIdentifier: string;
  version: string;
  protocol: string;
  product: string;
  deviceClass: string;
  protocolVersion: string;
  protocolCapabilities: string;
}

export interface HistoryOptions {
  /** Only return the specified number of results. */
  maxResults?: number;
  /** Min datetime to return results from. */
  minDate?: Date;
  /** Request history for a specific ratingKey item. */
  ratingKey?: number | string;
  /** Request history for a specific account ID. */
  accountId?: number | string;
  /** Request history for a specific library section ID. */
  librarySectionId?: number | string;
}

export interface BandwidthOptions {
  /** Time range in seconds (e.g. 6 for 6 seconds, but typically larger). */
  timespan?: number;
  /** Filter by account ID. */
  accountID?: number;
  /** Filter by device ID. */
  deviceID?: number;
  /** Filter by LAN (true) or WAN (false). */
  lan?: boolean;
}

export interface TranscodeImageOptions {
  /** URL of the image to transcode. */
  url: string;
  /** Width of the transcoded image. */
  width: number;
  /** Height of the transcoded image. */
  height: number;
  /** Minimum size (0 or 1). */
  minSize?: number;
  /** Upscale the image (0 or 1). */
  upscale?: number;
  /** Opacity (0-100). */
  opacity?: number;
}
