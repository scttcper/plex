import type { PlexBoolean } from './util.ts';

export interface UserResponse {
  id: number;
  uuid: string;
  username: string;
  title: string;
  email: string;
  friendlyName?: string;
  locale: string | null;
  confirmed?: boolean;
  joinedAt?: number;
  emailOnlyAuth: boolean;
  hasPassword: boolean;
  protected: boolean;
  thumb: string;
  authToken: string;
  mailingListStatus: 'active' | 'inactive';
  mailingListActive: boolean;
  scrobbleTypes: string;
  country: string;
  subscription?: Subscription;
  subscriptionDescription: null | string;
  restricted: boolean;
  anonymous?: null;
  home: boolean;
  guest: boolean;
  homeSize: number;
  homeAdmin: boolean;
  maxHomeSize: number;
  certificateVersion: number;
  rememberExpiresAt: number;
  profile: Profile;
  entitlements: string[];
  roles?: string[];
  services: Service[];
  adsConsent: null;
  adsConsentSetAt: null;
  adsConsentReminderAt: null;
  experimentalFeatures?: boolean;
  twoFactorEnabled?: boolean;
  backupCodesCreated?: boolean;
  attributionPartner?: null | string;
  queueEmail: string;
  queueUid: Record<string, unknown>;
}

export interface Profile {
  autoSelectAudio: boolean;
  defaultAudioAccessibility?: number;
  defaultAudioLanguage: string;
  defaultAudioLanguages?: string[] | null;
  defaultSubtitleLanguage: string;
  defaultSubtitleLanguages?: string[] | null;
  autoSelectSubtitle: number;
  defaultSubtitleAccessibility: number;
  defaultSubtitleForced: number;
  watchedIndicator?: number;
  mediaReviewsVisibility?: number;
  mediaReviewsLanguages?: string[] | null;
  mediaPostsVisibility?: boolean;
}

export interface Service {
  identifier: string;
  endpoint: string;
  token?: string;
  status: Status;
  secret?: string | null;
}

export const Status = {
  Online: 'online',
  Offline: 'offline',
} as const;

export type Status = (typeof Status)[keyof typeof Status];

export interface Subscription {
  active: boolean;
  subscribedAt: string | null;
  status: string;
  paymentService: null | string;
  plan: null | string;
  features: string[];
}

/**
 * returned from https://plex.tv/api/v2/resources
 */
export interface ResourcesResponse {
  name: string;
  product: string;
  productVersion: string;
  platform: string;
  platformVersion: string;
  device: null | string;
  clientIdentifier: string;
  createdAt: string;
  lastSeenAt: string;
  provides: string;
  ownerId: number | null;
  sourceTitle: null | string;
  publicAddress: string;
  accessToken: null | string;
  searchEnabled?: boolean;
  owned: boolean;
  home: boolean;
  synced: boolean;
  relay: boolean;
  presence: boolean;
  httpsRequired: boolean;
  publicAddressMatches: boolean;
  dnsRebindingProtection?: boolean;
  natLoopbackSupported?: boolean;
  connections: Connection[];
}

export interface Connection {
  protocol: Protocol;
  address: string;
  port: number;
  uri: string;
  local: boolean;
  relay: boolean;
  IPv6: boolean;
}

export const Protocol = {
  HTTP: 'http',
  HTTPS: 'https',
} as const;

export type Protocol = (typeof Protocol)[keyof typeof Protocol];

export interface Device {
  $: {
    id: string;
    name: string;
    publicAddress: string;
    product: string;
    productVersion: string;
    platform: string;
    platformVersion: string;
    device: string;
    model: string;
    vendor: string;
    provides: string;
    clientIdentifier: string;
    version: string;
    token: string;
    createdAt: string;
    lastSeenAt: string;
    screenResolution: string;
    screenDensity: string;
  };
  Connection?: Array<{ $: { uri: string } }>;
}

export interface WebLogin {
  id: number;
  code: string;
  uri: string;
}

export interface MyPlexServerShareData {
  $: {
    id?: string;
    accountID?: string;
    serverId?: string;
    machineIdentifier?: string;
    name?: string;
    lastSeenAt?: string;
    numLibraries?: string;
    allLibraries?: PlexBoolean;
    owned?: PlexBoolean;
    pending?: PlexBoolean;
  };
}

export interface MyPlexUserData {
  $: {
    allowCameraUpload?: PlexBoolean;
    allowChannels?: PlexBoolean;
    allowSync?: PlexBoolean;
    email?: string;
    filterAll?: string;
    filterMovies?: string;
    filterMusic?: string;
    filterPhotos?: string;
    filterTelevision?: string;
    home?: PlexBoolean;
    id?: string;
    protected?: PlexBoolean;
    recommendationsPlaylistId?: string;
    restricted?: string;
    thumb?: string;
    title?: string;
    username?: string;
  };
  Server?: MyPlexServerShareData[];
}

export interface MyPlexInviteData {
  $: {
    createdAt?: string;
    email?: string;
    friend?: PlexBoolean;
    friendlyName?: string;
    home?: PlexBoolean;
    id?: string;
    server?: PlexBoolean;
    thumb?: string;
    username?: string;
  };
  Server?: MyPlexServerShareData[];
}

export interface MyPlexUsersResponse {
  MediaContainer: {
    $: Record<string, string>;
    User?: MyPlexUserData[];
  };
}

export interface MyPlexInvitesResponse {
  MediaContainer: {
    $: Record<string, string>;
    Invite?: MyPlexInviteData[];
  };
}

export interface MyPlexServerSectionData {
  $: {
    id: string;
    key: string;
    type: string;
    title: string;
  };
}

export interface MyPlexServerSectionsResponse {
  MediaContainer: {
    $: Record<string, string>;
    Server?: Array<{
      $: Record<string, string>;
      Section?: MyPlexServerSectionData[];
    }>;
  };
}

export interface WatchlistItemData {
  ratingKey: string;
  key: string;
  guid: string;
  type: 'movie' | 'show';
  title: string;
  addedAt?: number;
  art?: string;
  duration?: number;
  originallyAvailableAt?: string;
  rating?: number;
  slug?: string;
  source?: string;
  thumb?: string;
  titleSort?: string;
  watchlistedAt?: number;
  year?: number;
}

export interface WatchlistResponse {
  MediaContainer: {
    identifier: string;
    librarySectionID?: string;
    librarySectionTitle?: string;
    offset?: number;
    size: number;
    totalSize?: number;
    Metadata?: WatchlistItemData[];
  };
}

interface DiscoverGenreData {
  filter: string;
  id: string;
  key: string;
  ratingKey: string;
  slug: string;
  tag: string;
  type: 'hub';
  context: 'tag.genre';
}

interface DiscoverItemData {
  addedAt?: number;
  art?: string;
  duration?: number;
  guid: string;
  key: string;
  originallyAvailableAt?: string;
  ratingKey: string;
  slug: string;
  source?: string;
  subtype?: string;
  thumb?: string;
  title: string;
  year?: number;
  Genre?: DiscoverGenreData[];
}

export interface DiscoverMovieData extends DiscoverItemData {
  type: 'movie';
}

export interface DiscoverShowData extends DiscoverItemData {
  type: 'show';
  childCount?: number;
  leafCount?: number;
  skipChildren?: boolean;
}

export interface DiscoverSearchResultData {
  Metadata: DiscoverMovieData | DiscoverShowData;
  score: number;
}

export interface DiscoverSearchResponse {
  MediaContainer: {
    identifier: 'tv.plex.provider.discover';
    size: number;
    suggestedTerms?: string[];
    SearchResults?: Array<{
      id: string;
      size: number;
      SearchResult?: DiscoverSearchResultData[];
    }>;
  };
}

export interface UserStateData {
  ratingKey: string;
  type: string;
  lastViewedAt?: number;
  viewCount: number;
  viewedLeafCount?: number;
  viewOffset: number;
  viewState?: 'complete';
  watchlistedAt?: number;
}

export interface UserStateResponse {
  MediaContainer: {
    identifier: string;
    size: number;
    UserState?: UserStateData;
  };
}

export interface ViewStateSyncResponse {
  consent: boolean;
  updatedAt: string;
  deletionRequestedAt: string | null;
}

export type WebhookResponse = Array<string | { url: string }>;
