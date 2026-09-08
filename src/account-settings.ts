import { BadRequest } from './exceptions.ts';
import type { MyPlexAccount } from './myplex.ts';
import { parsePlexBoolean, type PlexBoolean } from './util.ts';

export type OnlineMediaSourceVisibility = 'opt_in' | 'opt_out' | 'opt_out_managed';

/** A Plex account's setting for an online media source. */
export class AccountOptOut {
  readonly account: MyPlexAccount;
  readonly key: string;
  /** Plex may introduce additional server-defined values. */
  value: string;

  constructor(account: MyPlexAccount, key: string, value: string) {
    this.account = account;
    this.key = key;
    this.value = value;
  }

  async setVisibility(value: OnlineMediaSourceVisibility): Promise<void> {
    if (this.key === 'tv.plex.provider.music' && value === 'opt_out_managed') {
      throw new BadRequest('Music does not support opting out only managed users.');
    }
    const params = new URLSearchParams({ key: this.key, value });
    await this.account.query({
      url: `${onlineMediaSourcesUrl(this.account)}?${params}`,
      method: 'post',
    });
    this.value = value;
  }
}

export function onlineMediaSourcesUrl(account: MyPlexAccount): string {
  if (!account.uuid) {
    throw new BadRequest('Connect the account before reading or changing online media sources.');
  }
  return `https://plex.tv/api/v2/user/${encodeURIComponent(account.uuid)}/settings/opt_outs`;
}

export interface GeoLocationData {
  city?: string;
  code?: string;
  continent_code?: string;
  coordinates?: string;
  country?: string;
  european_union_member?: PlexBoolean | 'Unknown';
  in_privacy_restricted_country?: PlexBoolean | 'Unknown';
  in_privacy_restricted_region?: PlexBoolean | 'Unknown';
  postal_code?: string;
  subdivisions?: string;
  time_zone?: string;
}

/** Geographic information returned by Plex's GeoIP service. */
export class GeoLocation {
  readonly city?: string;
  readonly code?: string;
  readonly continentCode?: string;
  readonly coordinates?: readonly [latitude: number, longitude: number];
  readonly country?: string;
  readonly europeanUnionMember?: boolean;
  readonly inPrivacyRestrictedCountry?: boolean;
  readonly inPrivacyRestrictedRegion?: boolean;
  readonly postalCode?: string;
  readonly subdivisions?: string;
  readonly timezone?: string;

  constructor(data: GeoLocationData) {
    this.city = data.city;
    this.code = data.code;
    this.continentCode = data.continent_code;
    const coordinates = data.coordinates?.split(',');
    if (
      coordinates?.length === 2 &&
      coordinates.every(value => value.trim() !== '' && Number.isFinite(Number(value)))
    ) {
      this.coordinates = [Number(coordinates[0]), Number(coordinates[1])];
    }
    this.country = data.country;
    this.europeanUnionMember = optionalBoolean(data.european_union_member);
    this.inPrivacyRestrictedCountry = optionalBoolean(data.in_privacy_restricted_country);
    this.inPrivacyRestrictedRegion = optionalBoolean(data.in_privacy_restricted_region);
    this.postalCode = data.postal_code;
    this.subdivisions = data.subdivisions;
    this.timezone = data.time_zone;
  }
}

function optionalBoolean(value: PlexBoolean | 'Unknown' | undefined): boolean | undefined {
  return value === undefined || value === 'Unknown' ? undefined : parsePlexBoolean(value);
}
