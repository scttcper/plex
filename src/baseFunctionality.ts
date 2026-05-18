import { URLSearchParams } from 'node:url';

import type { PlexObject } from './base/plexObject.js';
import type { PlexServer } from './server.js';
import type { MediaContainer } from './util.js';

export type QueryParamValue = string | number | boolean | null | undefined;
export type ItemFilterValue = string | number | boolean;
export type PlexItemData = Record<string, unknown>;
export type PlexItemParent = unknown;

export interface PlexItemConstructor<T> {
  readonly TAG?: string | null;
  new (server: PlexServer, data: PlexItemData, initpath?: string, parent?: PlexObject): T;
}

type PlexItemContainer = Record<string, PlexItemData[] | undefined>;
type ItemOperator = (value: unknown, query: ItemFilterValue) => boolean;

/**
 * Builds a Plex object query path and ensures object fetches include GUID data.
 */
export function buildQueryKey(
  ekey: string | number,
  params: Record<string, QueryParamValue> = {},
): string {
  const key = typeof ekey === 'number' ? `/library/metadata/${ekey.toString()}` : ekey;
  const [path, existingSearch = ''] = key.split('?', 2);
  const searchParams = new URLSearchParams(existingSearch);

  if (!searchParams.has('includeGuids')) {
    searchParams.set('includeGuids', '1');
  }

  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === 'boolean') {
      searchParams.set(name, value ? '1' : '0');
    } else {
      searchParams.set(name, value.toString());
    }
  }

  return `${path}?${searchParams.toString()}`;
}

export const OPERATORS = {
  exact: (value, query) => value === query,
  iexact: (value, query) => String(value).toLowerCase() === String(query).toLowerCase(),
  contains: (value, query) => String(query).includes(String(value)),
  icontains: (value, query) => String(query).toLowerCase().includes(String(value).toLowerCase()),
  ne: (value, query) => value !== query,
  in: (value, query) => String(query).includes(String(value)),
  gt: (value, query) => Number(value) > Number(query),
  gte: (value, query) => Number(value) >= Number(query),
  lt: (value, query) => Number(value) < Number(query),
  lte: (value, query) => Number(value) <= Number(query),
  startswith: (value, query) => String(value).startsWith(String(query)),
  istartswith: (value, query) =>
    String(value).toLowerCase().startsWith(String(query).toLowerCase()),
  endswith: (value, query) => String(value).endsWith(String(query)),
  iendswith: (value, query) => String(value).toLowerCase().endsWith(String(query).toLowerCase()),
  // 'exists': (v: string, q) => v is not None if q else v is None,
  // 'regex': (v: string, q) => re.match(q, v),
  // 'iregex': (v: string, q) => re.match(q, v, flags=re.IGNORECASE),
} satisfies Record<string, ItemOperator>;

/**
 * Load the specified key to find and build the first item with the
 * specified tag and attrs. If no tag or attrs are specified then
 * the first item in the result set is returned.
 *
 * @param ekey Path in Plex to fetch items from. If an int is passed
 * in, the key will be translated to /library/metadata/<key>. This allows
 * fetching an item only knowing its key-id.
 */
export async function fetchItem<T = PlexItemData>(
  server: PlexServer,
  ekey: string | number,
  options?: Record<string, ItemFilterValue>,
  cls?: Pick<PlexItemConstructor<unknown>, 'TAG'>,
): Promise<T> {
  const key = typeof ekey === 'number' ? `/library/metadata/${ekey.toString()}` : ekey;
  const response = await server.query<MediaContainer<PlexItemContainer>>({ path: key });
  const containerKey = cls?.TAG ?? 'Metadata';
  const elems = response.MediaContainer[containerKey] ?? [];
  for (const elem of elems) {
    if (checkAttrs(elem, options)) {
      return elem as T;
    }
  }

  throw new Error('Unable to find item');
}

/**
 * Load the specified key to find and build all items with the specified tag
 * and attrs. See :func:`~plexapi.base.PlexObject.fetchItem` for more details
 * on how this is used.
 */
export async function fetchItems<T>(
  server: PlexServer,
  ekey: string,
  options: Record<string, ItemFilterValue> | undefined,
  Cls: PlexItemConstructor<T>,
  parent?: PlexItemParent,
): Promise<T[]>;
export async function fetchItems<T = PlexItemData>(
  server: PlexServer,
  ekey: string,
  options?: Record<string, ItemFilterValue>,
): Promise<T[]>;
export async function fetchItems<T = PlexItemData>(
  server: PlexServer,
  ekey: string,
  options?: Record<string, ItemFilterValue>,
  Cls?: PlexItemConstructor<T>,
  parent?: PlexItemParent,
): Promise<T[]> {
  const response = await server.query<MediaContainer<PlexItemContainer>>({ path: ekey });
  const { MediaContainer } = response;
  const elems = MediaContainer[Cls?.TAG] ?? MediaContainer.Metadata ?? [];
  return findItems(elems, options, Cls, server, parent);
}

/**
 * Load the specified data to find and build all items with the specified tag
 * and attrs. See :func:`~plexapi.base.PlexObject.fetchItem` for more details
 * on how this is used.
 */
export function findItems<T>(
  data: readonly unknown[] | undefined,
  options: Record<string, ItemFilterValue> | undefined,
  Cls: PlexItemConstructor<T>,
  server: PlexServer,
  parent?: PlexItemParent,
): T[];
export function findItems<T = PlexItemData>(
  data: readonly T[] | undefined,
  options?: Record<string, ItemFilterValue>,
): T[];
export function findItems<T = PlexItemData>(
  data: readonly unknown[] | undefined,
  options: Record<string, ItemFilterValue> = {},
  Cls?: PlexItemConstructor<T>,
  server?: PlexServer,
  parent?: PlexItemParent,
): T[] {
  // if (Cls?.TAG && !('tag' in options)) {
  //   options.etag = Cls.TAG;
  // }

  // if (Cls?.TYPE && !('type' in options)) {
  //   options.type = Cls.TYPE;
  // }

  const items: T[] = [];
  for (const elem of data ?? []) {
    if (checkAttrs(elem, options)) {
      if (Cls === undefined) {
        items.push(elem as T);
      } else if (server !== undefined) {
        items.push(new Cls(server, elem as PlexItemData, undefined, parent as PlexObject));
      }
    }
  }

  return items;
}

function checkAttrs(elem: unknown, obj: Record<string, ItemFilterValue> = {}): boolean {
  const attrsFound: Record<string, boolean> = {};
  for (const [attr, query] of Object.entries(obj)) {
    const [key, , operator] = getAttrOperator(attr);
    const value =
      typeof elem === 'object' && elem !== null
        ? (elem as Record<string, unknown>)[key]
        : undefined;
    attrsFound[key] = operator(value, query);
  }

  return Object.values(attrsFound).every(x => x);
}

function getAttrOperator(attr: string): [string, keyof typeof OPERATORS, ItemOperator] {
  // OPERATORS
  for (const [op, operator] of Object.entries(OPERATORS)) {
    if (attr.endsWith(`__${op}`)) {
      const key = attr.split('__', 1)[0];
      return [key, op as keyof typeof OPERATORS, operator];
    }
  }

  return [attr, 'exact', OPERATORS.exact];
}
