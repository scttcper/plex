export interface UserResponse {
  user: User;
}

export interface User {
  $: UserClass;
  subscription: SubscriptionElement[];
  profile: ProfileElement[];
  entitlements: Entitlements[];
  services: UserService[];
  queueUid: string[];
}

export interface UserClass {
  id: string;
  uuid: string;
  username: string;
  title: string;
  email: string;
  locale: string;
  emailOnlyAuth: string;
  hasPassword: string;
  protected: string;
  thumb: string;
  authToken: string;
  mailingListStatus: 'active';
  mailingListActive: string;
  scrobbleTypes: string;
  country: string;
  subscriptionDescription: string;
  restricted: string;
  home: string;
  guest: string;
  homeSize: string;
  homeAdmin: string;
  maxHomeSize: string;
  certificateVersion: string;
  rememberExpiresAt: string;
  adsConsent: string;
  adsConsentSetAt: string;
  adsConsentReminderAt: string;
  queueEmail: string;
}

export interface ProfileElement {
  $: Profile;
}

export interface Profile {
  autoSelectAudio: string;
  defaultAudioLanguage: string;
  defaultSubtitleLanguage: string;
  autoSelectSubtitle: string;
  defaultSubtitleAccessibility: string;
  defaultSubtitleForced: string;
}

export interface UserService {
  service: ServiceService[];
}

export interface ServiceService {
  $: Service;
}

export interface Service {
  identifier: string;
  endpoint: string;
  token?: string;
  status: Status;
  secret?: string;
}

export enum Status {
  Online = 'online',
  Offline = 'offline',
}

export interface SubscriptionElement {
  $: Subscription;
  features: SubscriptionFeature[];
}

export interface Subscription {
  active: string;
  subscribedAt: string;
  status: 'active' | 'Inactive';
  paymentService: string;
  plan: string;
}

export interface SubscriptionFeature {
  feature: FeatureFeature[];
}

export interface FeatureFeature {
  $: Feature;
}

export interface Feature {
  id: string;
}

export interface Entitlements {
  entitlement: EntitlementEntitlement[];
}

export interface EntitlementEntitlement {
  $: Entitlement;
}

export interface Entitlement {
  id: string;
}
