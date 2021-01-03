import { URLSearchParams } from 'url';

import type { PlexServer } from '../server';

/**
 * Base class for all? Plex objects
 */
export abstract class PlexObject {
  /** xml element tag */
  static TAG: string | null = null;
  /** xml element type */
  static TYPE: string | null = null;
  /** plex relative url */
  key!: string;
  _details_key: string;
  _INCLUDES?: Record<string, string | number>;
  /**
   * WeakRef to the parent object that this object is built from.
   */
  public readonly parent?: WeakRef<any>;
  protected initpath: string;

  constructor(
    public readonly server: PlexServer,
    data: any,
    initpath?: string,
    parent?: PlexObject,
  ) {
    this.initpath = initpath ?? this.key;
    this.parent = parent ? new WeakRef(parent) : undefined;
    this._loadData(data);
    this._details_key = this._buildDetailsKey();
  }

  /**
   * Reload the data for this object from self.key.
   */
  async reload(ekey?: string): Promise<void> {
    const key = ekey ?? this._details_key ?? this.key;
    if (!key) {
      throw new Error('Cannot reload an object not built from a URL');
    }

    const data = await this.server.query(key);
    const innerData = data.MediaContainer ? data.MediaContainer : data;
    this._loadData(innerData);
  }

  isChildOf(cls: any): boolean {
    const parent = this.parent?.deref();
    return (parent && parent.constructor === cls.constructor) || false;
  }

  protected _buildDetailsKey(args: Record<string, boolean | number> = {}) {
    let details_key = this.key;
    if (details_key && this._INCLUDES !== undefined) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(this._INCLUDES)) {
        let value = args[k] ?? v;
        if (![false, 0, '0'].includes(value)) {
          params.set(k, (value === true ? 1 : value).toString());
        }
      }

      if ([...params.keys()].length) {
        details_key += '?' + params.toString();
      }
    }

    return details_key;
  }

  protected abstract _loadData(data: any): void;
}
