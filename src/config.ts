import os from 'node:os';

import { getMAC, parseMAC } from '@ctrl/mac-address';

// PlexAPI Settings
export const PROJECT = 'PlexAPI';
export const VERSION = '3.3.0';
/**
 * Default timeout for requests in milliseconds.
 */
export const TIMEOUT = 30_000;
export const X_PLEX_CONTAINER_SIZE = 100;
export const X_PLEX_ENABLE_FAST_CONNECT = false as const;

// Plex Header Configuation
export const X_PLEX_PROVIDES = 'controller';
export const X_PLEX_PLATFORM = os.type();
export const X_PLEX_PLATFORM_VERSION = os.release();
export const X_PLEX_PRODUCT = PROJECT;
export const X_PLEX_VERSION = VERSION;
export const X_PLEX_DEVICE = X_PLEX_PLATFORM;
export const X_PLEX_DEVICE_NAME = os.hostname();
const mac = getMAC();
const base16Mac: string = parseMAC(mac).toLong().toString(16);
export const X_PLEX_IDENTIFIER = `0x${base16Mac}`;

type PlexHeaderName =
  | 'X-Plex-Platform'
  | 'X-Plex-Platform-Version'
  | 'X-Plex-Provides'
  | 'X-Plex-Product'
  | 'X-Plex-Version'
  | 'X-Plex-Device'
  | 'X-Plex-Device-Name'
  | 'X-Plex-Client-Identifier'
  | 'X-Plex-Language'
  | 'X-Plex-Sync-Version'
  | 'X-Plex-Features';

/** X-Plex headers sent with every request. Change them with {@link setPlexHeaders}. */
export const BASE_HEADERS: Record<PlexHeaderName, string> = {
  'X-Plex-Platform': X_PLEX_PLATFORM,
  'X-Plex-Platform-Version': X_PLEX_PLATFORM_VERSION,
  'X-Plex-Provides': X_PLEX_PROVIDES,
  'X-Plex-Product': X_PLEX_PRODUCT,
  'X-Plex-Version': X_PLEX_VERSION,
  'X-Plex-Device': X_PLEX_DEVICE,
  'X-Plex-Device-Name': X_PLEX_DEVICE_NAME,
  'X-Plex-Client-Identifier': X_PLEX_IDENTIFIER,
  'X-Plex-Language': 'en',
  'X-Plex-Sync-Version': '2',
  'X-Plex-Features': 'external-media',
};

export interface PlexHeaderOptions {
  /** App name Plex shows for this device. Defaults to `PlexAPI`. */
  product?: string;
  /** App version. */
  version?: string;
  /** Unique id for this install. Keep it stable so Plex sees a single device. */
  identifier?: string;
  /** Device model (ex: Linux, iPhone). */
  device?: string;
  /** Device name shown in Plex. Defaults to the hostname. */
  deviceName?: string;
  /** Platform (ex: Linux, Darwin). */
  platform?: string;
  platformVersion?: string;
  /** Preferred metadata language (ex: en, de). */
  language?: string;
  /** Capabilities this device provides (ex: controller, player). */
  provides?: string;
}

const headerNames = {
  product: 'X-Plex-Product',
  version: 'X-Plex-Version',
  identifier: 'X-Plex-Client-Identifier',
  device: 'X-Plex-Device',
  deviceName: 'X-Plex-Device-Name',
  platform: 'X-Plex-Platform',
  platformVersion: 'X-Plex-Platform-Version',
  language: 'X-Plex-Language',
  provides: 'X-Plex-Provides',
} as const satisfies Record<keyof PlexHeaderOptions, PlexHeaderName>;

/**
 * Override the X-Plex headers sent with every request, so Plex shows your app instead of
 * PlexAPI. Call it before connecting, existing tokens stay tied to the old identifier.
 *
 * @example
 * ```ts
 * setPlexHeaders({ product: 'My App', version: '1.0.0', identifier: storedInstallId });
 * ```
 */
export function setPlexHeaders(options: PlexHeaderOptions): void {
  for (const [option, header] of Object.entries(headerNames) as Array<
    [keyof PlexHeaderOptions, PlexHeaderName]
  >) {
    const value = options[option];
    if (value !== undefined) {
      BASE_HEADERS[header] = value;
    }
  }
}
