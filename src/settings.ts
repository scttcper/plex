import { URLSearchParams } from 'node:url';

import { PlexObject } from './base/plexObject.ts';
import { BadRequest, NotFound } from './exceptions.ts';
import { lowerFirst, parsePlexBoolean } from './util.ts';

export type SettingType = 'bool' | 'double' | 'enum' | 'int' | 'text';
export type SettingValue = boolean | number | string;
export type SettingEnumValues = Record<string, string> | string[];

export interface SettingResponse {
  id: string;
  label: string;
  summary: string;
  type: SettingType;
  default: SettingValue;
  value: SettingValue;
  hidden: boolean;
  advanced: boolean;
  group: string;
  enumValues?: string;
}

export class Settings extends PlexObject {
  static key = '/:/prefs';
  declare _settings: Record<string, Setting>;
  declare _data: SettingResponse[];

  all(): Setting[] {
    return Object.entries(this._settings)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(x => x[1]);
  }

  get(id: string): Setting {
    const lowerId = lowerFirst(id);
    if (Object.hasOwn(this._settings, lowerId)) {
      return this._settings[lowerId];
    }

    throw new NotFound(`Invalid setting id: ${id}`);
  }

  groups(): Partial<Record<string, Setting[]>> {
    const groups = new Map<string, Setting[]>();
    for (const setting of this.all()) {
      const group = groups.get(setting.group) ?? [];
      group.push(setting);
      groups.set(setting.group, group);
    }
    return Object.fromEntries(groups);
  }

  group(name: string): Setting[] {
    return this.all().filter(setting => setting.group === name);
  }

  /** Persist pending settings and reload the values accepted by Plex. */
  async save(): Promise<void> {
    const params = new URLSearchParams();
    for (const setting of this.all()) {
      if (setting._setValue !== null) {
        params.set(setting.id, setting.toQueryValue());
      }
    }
    if (params.size === 0) {
      return;
    }
    const path = this.initpath ?? Settings.key;
    await this.server.query({ path: `${path}?${params}`, method: 'put' });
    const data = await this.server.query<{ MediaContainer: { Setting?: SettingResponse[] } }>({
      path,
    });
    this._loadData(data.MediaContainer.Setting ?? []);
  }

  override _loadData(data: SettingResponse[]) {
    this._data = data;

    const previous = this._settings;
    this._settings = Object.fromEntries(
      data.map(elem => {
        const id = lowerFirst(elem.id);
        const setting = previous && Object.hasOwn(previous, id) ? previous[id] : undefined;
        if (setting) {
          setting._loadData(elem);
        }
        return [id, setting ?? new Setting(this.server, elem, this.initpath)];
      }),
    );
  }
}

/**
 * Represents a single Plex setting
 */
export class Setting extends PlexObject {
  /** Setting id (or name). */
  declare id: string;
  /** Short description of what this setting is. */
  declare label: string;
  /** Long description of what this setting is. */
  declare summary: string;
  /** Setting type (text, int, double, bool). */
  declare type: SettingType;
  /** Default value for this setting. */
  declare default: SettingValue;
  /** Current value for this setting. */
  declare value: SettingValue;
  /** True if this is a hidden setting. */
  declare hidden: boolean;
  /** True if this is an advanced setting. */
  declare advanced: boolean;
  /** Group name this setting is categorized as. */
  declare group: string;
  /** List or dictionary of valis values for this setting. */
  declare enumValues?: SettingEnumValues;
  _setValue: SettingValue | null = null;

  /**
   * Set a new value for this setitng. NOTE: You must call {@link Settings.save} before
   * any changes to setting values are persisted to the PlexServer.
   */
  set(value: SettingValue): void {
    const castValue = this._cast(value);
    if (typeof castValue !== typeof this.value) {
      throw new BadRequest(`Invalid value for ${this.id}: expected ${this.type}.`);
    }

    if (this.enumValues) {
      const allowedValues = Array.isArray(this.enumValues)
        ? this.enumValues
        : Object.keys(this.enumValues);
      const allowedValue = this.toQueryValue(castValue);
      if (!allowedValues.includes(allowedValue)) {
        throw new BadRequest(`Invalid value for ${this.id}: ${castValue} not in ${allowedValues}`);
      }
    }

    this._setValue = castValue;
  }

  toQueryValue(value: SettingValue = this._setValue ?? this.value): string {
    if (this.type === 'bool') {
      return value ? '1' : '0';
    }

    return value.toString();
  }

  override _loadData(data: SettingResponse) {
    this._setValue = null;
    this.id = data.id;
    this.label = data.label;
    this.summary = data.summary;
    this.type = data.type;
    this.default = this._cast(data.default);
    this.value = this._cast(data.value);
    this.hidden = parsePlexBoolean(data.hidden);
    this.advanced = parsePlexBoolean(data.advanced);
    this.group = data.group;
    this.enumValues = this._getEnumValues(data.enumValues);
  }

  private _cast(value: SettingValue): SettingValue {
    switch (this.type) {
      case 'bool': {
        return parsePlexBoolean(value);
      }

      case 'double':
      case 'int': {
        const numericValue = Number(value);
        if (Number.isNaN(numericValue)) {
          throw new BadRequest(`Invalid value for ${this.id}: expected ${this.type}.`);
        }

        return numericValue;
      }

      case 'enum':
      case 'text': {
        return value.toString();
      }

      default: {
        const settingType = this.type as string;
        throw new BadRequest(`Unknown setting type "${settingType}" for ${this.id}.`);
      }
    }
  }

  private _getEnumValues(enumValues?: string): SettingEnumValues | undefined {
    if (!enumValues) {
      return undefined;
    }

    if (enumValues.includes(':')) {
      return Object.fromEntries(enumValues.split('|').map(value => value.split(':', 2)));
    }

    return enumValues.split('|');
  }
}

export class Preferences extends Setting {
  static override TAG = 'Preferences' as const;
  FILTER = 'preferences' as const;
}
