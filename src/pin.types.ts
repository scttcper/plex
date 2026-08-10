export type PlexPinLoginMode = 'pin' | 'oauth';

export interface CreatePlexPinLoginOptions {
  /** Stable identifier for the client requesting authentication. */
  readonly clientIdentifier?: string;
  /** Use `oauth` to generate a Plex web authentication URL. Defaults to `pin`. */
  readonly mode?: PlexPinLoginMode;
  /** Product name shown by Plex during authentication. */
  readonly product?: string;
  /** Request timeout in milliseconds. */
  readonly requestTimeout?: number;
  readonly signal?: AbortSignal;
}

export interface ResumePlexPinLoginOptions extends CreatePlexPinLoginOptions {
  readonly id: number;
}

export interface CheckPlexPinOptions {
  readonly signal?: AbortSignal;
}

export interface WaitForPlexPinOptions extends CheckPlexPinOptions {
  /** Delay between status requests in milliseconds. Defaults to one second. */
  readonly pollInterval?: number;
  /** Maximum time to wait in milliseconds. Defaults to two minutes. */
  readonly timeout?: number;
}

export interface PlexPinOAuthUrlOptions {
  readonly forwardUrl?: string;
}

export interface LinkPlexPinOptions {
  readonly code: string;
}

export interface PlexPinAuthentication {
  readonly newRegistration: boolean;
  readonly token: string;
}
