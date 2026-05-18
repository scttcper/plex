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

export enum Status {
  Online = 'online',
  Offline = 'offline',
}

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

export enum Protocol {
  HTTP = 'http',
  HTTPS = 'https',
}

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
