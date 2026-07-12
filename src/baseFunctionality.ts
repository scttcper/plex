import { URLSearchParams } from 'node:url';

import type { PlexObject } from './base/plexObject.ts';
import { X_PLEX_CONTAINER_SIZE } from './config.ts';
import { NotFound } from './exceptions.ts';
import type { PlexServer } from './server.ts';
import type { MediaContainer } from './util.ts';

export type QueryParamValue = string | number | boolean | null | undefined;
export type ItemFilterPrimitive = string | number | boolean;
export type ItemFilterValue = ItemFilterPrimitive | ItemFilterPrimitive[];
export type PlexItemData = Record<string, unknown>;
export type PlexItemParent = unknown;

export interface FetchItemsOptions {
  containerTag?: string | null;
  containerStart?: number;
  containerSize?: number;
  maxResults?: number;
}

export interface PlexItemConstructor<T> {
  readonly TAG?: string | null;
  new (server: PlexServer, data: PlexItemData, initpath?: string, parent?: PlexObject): T;
}

type PlexItemContainer = Record<string, unknown> & {
  size?: number | string;
  totalSize?: number | string;
};
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
  contains: (value, query) => String(value).includes(String(query)),
  icontains: (value, query) => String(value).toLowerCase().includes(String(query).toLowerCase()),
  ne: (value, query) => value !== query,
  in: (value, query) =>
    Array.isArray(query) ? query.some(candidate => candidate === value) : query === value,
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
export async function fetchItem<T>(
  server: PlexServer,
  ekey: string | number,
  options: Record<string, ItemFilterValue> | undefined,
  Cls: PlexItemConstructor<T>,
  parent?: PlexItemParent,
): Promise<T> {
  const key = typeof ekey === 'number' ? `/library/metadata/${ekey.toString()}` : ekey;
  const items = await fetchItems(server, key, options, Cls, parent, { maxResults: 1 });
  const [item] = items;
  if (item !== undefined) {
    return item;
  }

  throw new NotFound(`Unable to find item at "${key}".`);
}

export async function fetchItemData<T = PlexItemData>(
  server: PlexServer,
  ekey: string | number,
  options?: Record<string, ItemFilterValue>,
  cls?: Pick<PlexItemConstructor<unknown>, 'TAG'>,
): Promise<T> {
  const key = typeof ekey === 'number' ? `/library/metadata/${ekey.toString()}` : ekey;
  const items = await fetchItems<PlexItemData>(server, key, options, undefined, undefined, {
    containerTag: cls?.TAG,
    maxResults: 1,
  });
  const [item] = items;
  if (item !== undefined) {
    return item as T;
  }

  throw new NotFound(`Unable to find item at "${key}".`);
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
  fetchOptions?: FetchItemsOptions,
): Promise<T[]>;
export async function fetchItems<T = PlexItemData>(
  server: PlexServer,
  ekey: string,
  options?: Record<string, ItemFilterValue>,
  Cls?: undefined,
  parent?: PlexItemParent,
  fetchOptions?: FetchItemsOptions,
): Promise<T[]>;
export async function fetchItems<T = PlexItemData>(
  server: PlexServer,
  ekey: string,
  options?: Record<string, ItemFilterValue>,
  Cls?: PlexItemConstructor<T>,
  parent?: PlexItemParent,
  fetchOptions: FetchItemsOptions = {},
): Promise<T[]> {
  const keyParams = new URLSearchParams(ekey.split('?', 2)[1] ?? '');
  let containerStart =
    fetchOptions.containerStart ?? optionalNumber(keyParams.get('X-Plex-Container-Start')) ?? 0;
  const keyContainerSize = optionalNumber(keyParams.get('X-Plex-Container-Size'));
  const requestedContainerSize = fetchOptions.containerSize ?? keyContainerSize;
  let inferredContainerSize: number | undefined;
  const maxResults = fetchOptions.maxResults;
  const results: T[] = [];
  const hasLocalFilters = Object.keys(options ?? {}).length > 0;
  let firstPage = true;

  while (maxResults === undefined || results.length < maxResults) {
    const remaining = maxResults === undefined ? undefined : maxResults - results.length;
    const defaultContainerSize =
      hasLocalFilters || remaining === undefined
        ? X_PLEX_CONTAINER_SIZE
        : Math.min(X_PLEX_CONTAINER_SIZE, remaining);
    const containerSize = requestedContainerSize ?? inferredContainerSize ?? defaultContainerSize;
    const hasExplicitWindowOverride =
      fetchOptions.containerStart !== undefined || fetchOptions.containerSize !== undefined;
    const pageKey =
      firstPage && !hasExplicitWindowOverride
        ? ekey
        : buildContainerKey(ekey, containerStart, containerSize);
    const response = await server.query<MediaContainer<PlexItemContainer>>({ path: pageKey });
    const { MediaContainer } = response;
    const elems = containerItems(MediaContainer, Cls?.TAG ?? fetchOptions.containerTag);
    results.push(...findItems(elems, options, Cls, server, parent, pageKey));

    const totalSize = optionalNumber(MediaContainer.totalSize);
    const rawPageSize = optionalNumber(MediaContainer.size) ?? elems.length;
    inferredContainerSize ??= rawPageSize;
    containerStart += rawPageSize;
    firstPage = false;
    if (rawPageSize === 0 || totalSize === undefined || containerStart >= totalSize) {
      break;
    }
  }

  return maxResults === undefined ? results : results.slice(0, maxResults);
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
  initpath?: string,
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
  initpath?: string,
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
        items.push(new Cls(server, elem as PlexItemData, initpath, parent as PlexObject));
      }
    }
  }

  return items;
}

function checkAttrs(elem: unknown, obj: Record<string, ItemFilterValue> = {}): boolean {
  const attrsFound: Record<string, boolean> = {};
  for (const [attr, query] of Object.entries(obj)) {
    const [path, , operator] = getAttrOperator(attr);
    const values = nestedValues(elem, path);
    attrsFound[attr] = values.some(value => operator(value, query));
  }

  return Object.values(attrsFound).every(x => x);
}

function buildContainerKey(key: string, start: number, size: number): string {
  const [path, search = ''] = key.split('?', 2);
  const params = new URLSearchParams(search);
  params.set('X-Plex-Container-Start', start.toString());
  params.set('X-Plex-Container-Size', size.toString());
  return `${path}?${params.toString()}`;
}

function containerItems(container: PlexItemContainer, tag?: string | null): PlexItemData[] {
  const value = container[tag ?? 'Metadata'] ?? container.Metadata;
  return Array.isArray(value) ? (value as PlexItemData[]) : [];
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const result = Number(value);
  return Number.isNaN(result) ? undefined : result;
}

function getAttrOperator(attr: string): [string[], keyof typeof OPERATORS, ItemOperator] {
  // OPERATORS
  for (const [op, operator] of Object.entries(OPERATORS)) {
    if (attr.endsWith(`__${op}`)) {
      const path = attr.split('__').slice(0, -1);
      return [path, op as keyof typeof OPERATORS, operator];
    }
  }

  return [attr.split('__'), 'exact', OPERATORS.exact];
}

function nestedValues(value: unknown, path: string[]): unknown[] {
  if (path.length === 0) {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(item => nestedValues(item, path));
  }

  if (typeof value !== 'object' || value === null) {
    return [];
  }

  const [key, ...rest] = path;
  return nestedValues((value as Record<string, unknown>)[key], rest);
}
