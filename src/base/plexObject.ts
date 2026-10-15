import { buildQueryKey, type QueryParamValue } from '../baseFunctionality.ts';
import { BadRequest } from '../exceptions.ts';
import type { PlexServer } from '../server.ts';

/**
 * Base class for all? Plex objects
 */
export abstract class PlexObject {
  /** xml element tag */
  static TAG: string | null = null;
  /** xml element type */
  static TYPE: string | null = null;
  readonly server: PlexServer;
  /** Plex relative url, when the payload includes one. */
  declare key?: string;
  /**
   * WeakRef to the parent object that this object is built from.
   */
  readonly parent?: WeakRef<PlexObject>;
  protected _detailsKey: string | undefined;
  protected initpath: string | undefined;
  protected _INCLUDES?: Record<string, string | number>;

  constructor(server: PlexServer, data: unknown, initpath?: string, parent?: PlexObject) {
    this.server = server;
    this.initpath = initpath;
    this.parent = parent ? new WeakRef(parent) : undefined;
    this._loadData(data);
    this._detailsKey = this._buildDetailsKey();
  }

  /**
   * Reload the data for this object from this.key.
   */
  async reload(ekey?: string): Promise<void> {
    const key = ekey ?? this._detailsKey ?? this.key;
    if (!key) {
      throw new Error('Cannot reload an object not built from a URL');
    }

    const data = await this.server.query<{ MediaContainer?: unknown }>({ path: key });
    this._loadData(data.MediaContainer ?? data);
  }

  /**
   * Refreshing a Library or individual item causes the metadata for the item to be
   * refreshed, even if it already has metadata. You can think of refreshing as
   * "update metadata for the requested item even if it already has some". You should
   * refresh a Library or individual item if:
   */
  async refresh(): Promise<void> {
    if (!this.key) {
      throw new BadRequest('Refreshing requires an object built with a key.');
    }
    await this.server.query({ path: `${this.key}/refresh`, method: 'put' });
  }

  /**
   * Returns true if this object was built from a parent of the given class.
   */
  isChildOf(cls: abstract new (...args: any[]) => PlexObject): boolean {
    return this.parent?.deref() instanceof cls;
  }

  protected _buildDetailsKey(args: Record<string, boolean | number> = {}): string | undefined {
    let detailsKey = this.key;
    if (detailsKey && this._INCLUDES !== undefined) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(this._INCLUDES)) {
        const value = args[k] ?? v;
        if (![false, 0, '0'].includes(value)) {
          params.set(k, (value === true ? 1 : value).toString());
        }
      }

      const searchParams = params.toString();
      if (searchParams.length > 0) {
        detailsKey += `?${searchParams}`;
      }
    }

    return detailsKey;
  }

  protected _buildQueryKey(
    key: string | number,
    params: Record<string, QueryParamValue> = {},
  ): string {
    return buildQueryKey(key, params);
  }

  protected abstract _loadData(data: unknown): void;
}
