import { setTimeout as sleep } from 'node:timers/promises';

import { ofetch } from 'ofetch';

import { BASE_HEADERS, TIMEOUT, X_PLEX_IDENTIFIER, X_PLEX_PRODUCT } from './config.ts';
import { BadRequest } from './exceptions.ts';
import type {
  CreatePlexPinLoginOptions,
  PlexPinAuthentication,
  PlexPinLocation,
  PlexPinLoginMode,
  PlexPinOAuthUrlOptions,
  ResumePlexPinLoginOptions,
  WaitForPlexPinOptions,
} from './pin.types.ts';

const PINS_URL = 'https://clients.plex.tv/api/v2/pins';

interface PlexPinLocationData {
  readonly code: string;
  readonly european_union_member: boolean;
  readonly continent_code: string;
  readonly country: string;
  readonly city?: string;
  readonly time_zone: string;
  readonly postal_code?: string;
  readonly in_privacy_restricted_country: boolean;
  readonly in_privacy_restricted_region: boolean;
  readonly subdivisions?: string;
  readonly coordinates?: string;
}

interface PlexPinDataBase {
  readonly id: number;
  readonly code: string;
  readonly product: string;
  readonly trusted: boolean;
  readonly qr: string;
  readonly clientIdentifier: string;
  readonly location: PlexPinLocationData;
  readonly expiresIn: number;
  readonly createdAt: string;
  readonly expiresAt: string;
}

type PlexPinData = PlexPinDataBase &
  (
    | { readonly authToken: null; readonly newRegistration: null }
    | { readonly authToken: string; readonly newRegistration: boolean }
  );

function requestHeaders(clientIdentifier: string, product: string): Headers {
  const headers = new Headers(BASE_HEADERS);
  headers.set('Accept', 'application/json');
  headers.set('X-Plex-Client-Identifier', clientIdentifier);
  headers.set('X-Plex-Product', product);
  return headers;
}

function pinLocation(data: PlexPinLocationData): PlexPinLocation {
  return {
    countryCode: data.code,
    continentCode: data.continent_code,
    country: data.country,
    europeanUnionMember: data.european_union_member,
    timeZone: data.time_zone,
    inPrivacyRestrictedCountry: data.in_privacy_restricted_country,
    inPrivacyRestrictedRegion: data.in_privacy_restricted_region,
    city: data.city,
    postalCode: data.postal_code,
    subdivisions: data.subdivisions,
    coordinates: data.coordinates,
  };
}

function pinAuthentication(data: PlexPinData): PlexPinAuthentication | null {
  return data.authToken === null
    ? null
    : { newRegistration: data.newRegistration, token: data.authToken };
}

/** Create, inspect, and wait for a Plex PIN or OAuth login. */
export class MyPlexPinLogin {
  readonly id: number;
  readonly code: string;
  readonly product: string;
  readonly trusted: boolean;
  readonly qrCodeUrl: string;
  readonly clientIdentifier: string;
  readonly location: PlexPinLocation;
  readonly createdAt: Date;
  readonly mode: PlexPinLoginMode;
  expiresAt: Date;
  expiresInSeconds: number;
  #authentication: PlexPinAuthentication | null;
  readonly #timeout: number;

  private constructor(
    data: PlexPinData,
    { mode = 'link', timeout = TIMEOUT }: CreatePlexPinLoginOptions,
  ) {
    this.id = data.id;
    this.code = data.code;
    this.product = data.product;
    this.trusted = data.trusted;
    this.qrCodeUrl = data.qr;
    this.clientIdentifier = data.clientIdentifier;
    this.location = pinLocation(data.location);
    this.createdAt = new Date(data.createdAt);
    this.mode = mode;
    this.expiresAt = new Date(data.expiresAt);
    this.expiresInSeconds = data.expiresIn;
    this.#authentication = pinAuthentication(data);
    this.#timeout = timeout;
  }

  /** Request a new Plex PIN. */
  static async create({
    clientIdentifier = X_PLEX_IDENTIFIER,
    mode = 'link',
    product = X_PLEX_PRODUCT,
    timeout = TIMEOUT,
  }: CreatePlexPinLoginOptions = {}): Promise<MyPlexPinLogin> {
    const data = await ofetch<PlexPinData>(PINS_URL, {
      method: 'POST',
      headers: requestHeaders(clientIdentifier, product),
      query: mode === 'oauth' ? { strong: true } : undefined,
      timeout,
      retry: 0,
    });
    return new MyPlexPinLogin(data, { mode, timeout });
  }

  /** Resume a PIN login using its Plex identifier. */
  static async resume({
    id,
    clientIdentifier = X_PLEX_IDENTIFIER,
    mode = 'link',
    product = X_PLEX_PRODUCT,
    timeout = TIMEOUT,
  }: ResumePlexPinLoginOptions): Promise<MyPlexPinLogin> {
    const data = await ofetch<PlexPinData>(`${PINS_URL}/${id}`, {
      headers: requestHeaders(clientIdentifier, product),
      timeout,
      retry: 0,
    });
    return new MyPlexPinLogin(data, { mode, timeout });
  }

  get authenticated(): boolean {
    return this.#authentication !== null;
  }

  get token(): string | null {
    return this.#authentication?.token ?? null;
  }

  get newRegistration(): boolean | null {
    return this.#authentication?.newRegistration ?? null;
  }

  /** Build the Plex web authentication URL for an OAuth PIN. */
  oauthUrl({ forwardUrl }: PlexPinOAuthUrlOptions = {}): string {
    if (this.mode !== 'oauth') {
      throw new BadRequest('oauthUrl is only available for OAuth PIN logins.');
    }

    const params = new URLSearchParams({
      clientID: this.clientIdentifier,
      code: this.code,
      'context[device][product]': this.product,
      'context[device][version]': BASE_HEADERS['X-Plex-Version'],
      'context[device][platform]': BASE_HEADERS['X-Plex-Platform'],
      'context[device][platformVersion]': BASE_HEADERS['X-Plex-Platform-Version'],
      'context[device][device]': BASE_HEADERS['X-Plex-Device'],
      'context[device][deviceName]': BASE_HEADERS['X-Plex-Device-Name'],
    });
    if (forwardUrl) {
      params.set('forwardUrl', forwardUrl);
    }
    return `https://app.plex.tv/auth#?${params.toString()}`;
  }

  /** Fetch the current authentication state from Plex. */
  async check({ signal }: { signal?: AbortSignal } = {}): Promise<PlexPinAuthentication | null> {
    const data = await ofetch<PlexPinData>(`${PINS_URL}/${this.id}`, {
      headers: requestHeaders(this.clientIdentifier, this.product),
      signal,
      timeout: this.#timeout,
      retry: 0,
    });
    this.expiresAt = new Date(data.expiresAt);
    this.expiresInSeconds = data.expiresIn;
    this.#authentication = pinAuthentication(data);
    return this.#authentication;
  }

  /** Poll Plex until the PIN is authenticated, expires, times out, or is aborted. */
  async wait({
    pollInterval = 1000,
    timeout = 120_000,
    signal,
  }: WaitForPlexPinOptions = {}): Promise<PlexPinAuthentication> {
    if (!Number.isFinite(pollInterval) || pollInterval <= 0) {
      throw new BadRequest('pollInterval must be a positive number.');
    }
    if (!Number.isFinite(timeout) || timeout <= 0) {
      throw new BadRequest('timeout must be a positive number.');
    }
    if (this.#authentication !== null) {
      return this.#authentication;
    }

    const deadline = Math.min(Date.now() + timeout, this.expiresAt.getTime());
    while (Date.now() < deadline) {
      signal?.throwIfAborted();
      const authentication = await this.check({ signal });
      if (authentication !== null) {
        return authentication;
      }

      const remaining = deadline - Date.now();
      if (remaining > 0) {
        await sleep(Math.min(pollInterval, remaining), undefined, { signal });
      }
    }

    throw new DOMException('Plex PIN login timed out or expired.', 'TimeoutError');
  }
}
