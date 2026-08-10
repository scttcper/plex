export type PlexPinLoginMode = 'link' | 'oauth';

export interface CreatePlexPinLoginOptions {
  /** Stable identifier for the client requesting authentication. */
  readonly clientIdentifier?: string;
  /** Use `oauth` to generate a Plex web authentication URL. Defaults to `link`. */
  readonly mode?: PlexPinLoginMode;
  /** Product name shown by Plex during authentication. */
  readonly product?: string;
  /** Request timeout in milliseconds. */
  readonly timeout?: number;
}

export interface ResumePlexPinLoginOptions extends CreatePlexPinLoginOptions {
  readonly id: number;
}

export interface WaitForPlexPinOptions {
  /** Delay between status requests in milliseconds. Defaults to one second. */
  readonly pollInterval?: number;
  /** Maximum time to wait in milliseconds. Defaults to two minutes. */
  readonly timeout?: number;
  readonly signal?: AbortSignal;
}

export interface PlexPinOAuthUrlOptions {
  readonly forwardUrl?: string | null;
}

export interface LinkPlexPinOptions {
  readonly code: string;
  readonly clientIdentifier?: string;
}

export interface PlexPinLocation {
  readonly countryCode: string;
  readonly continentCode: string;
  readonly country: string;
  readonly europeanUnionMember: boolean;
  readonly timeZone: string;
  readonly inPrivacyRestrictedCountry: boolean;
  readonly inPrivacyRestrictedRegion: boolean;
  readonly city?: string;
  readonly postalCode?: string;
  readonly subdivisions?: string;
  readonly coordinates?: string;
}

export interface PlexPinAuthentication {
  readonly newRegistration: boolean;
  readonly token: string;
}
