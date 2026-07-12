import { describe, expect, it, vi } from 'vitest';

import { PlexObject } from '../src/base/plexObject.ts';
import {
  buildQueryKey,
  fetchItem,
  fetchItems,
  OPERATORS,
  type PlexItemData,
} from '../src/baseFunctionality.ts';
import { NotFound } from '../src/exceptions.ts';
import type { PlexServer } from '../src/server.ts';

class TestItem extends PlexObject {
  static override TAG = 'Metadata';
  declare id: number;
  declare title: string;

  protected override _loadData(data: PlexItemData): void {
    this.id = Number(data.id);
    this.key = `/items/${this.id}`;
    this.title = String(data.title);
  }
}

describe('buildQueryKey', () => {
  it('adds includeGuids to plain keys', () => {
    expect(buildQueryKey('/test/key')).toBe('/test/key?includeGuids=1');
  });

  it('appends includeGuids and params to keys with existing queries', () => {
    expect(buildQueryKey('/test/key?foo=bar', { index: 1, type: 2 })).toBe(
      '/test/key?foo=bar&includeGuids=1&index=1&type=2',
    );
  });

  it('does not duplicate an existing includeGuids parameter', () => {
    expect(buildQueryKey('/test/key?includeGuids=1', { title: 'Rush Hour' })).toBe(
      '/test/key?includeGuids=1&title=Rush+Hour',
    );
  });
});

describe('fetchItems', () => {
  it('paginates MediaContainer results and hydrates every item', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        MediaContainer: {
          Metadata: [
            { id: 1, title: 'one' },
            { id: 2, title: 'two' },
          ],
          size: 2,
          totalSize: 3,
        },
      })
      .mockResolvedValueOnce({
        MediaContainer: {
          Metadata: [{ id: 3, title: 'three' }],
          size: 1,
          totalSize: 3,
        },
      });
    const server = { query } as unknown as PlexServer;

    const items = await fetchItems(server, '/items', undefined, TestItem);

    expect(items).toHaveLength(3);
    expect(items).toEqual([expect.any(TestItem), expect.any(TestItem), expect.any(TestItem)]);
    expect(query).toHaveBeenNthCalledWith(1, { path: '/items' });
    expect(query).toHaveBeenNthCalledWith(2, {
      path: '/items?X-Plex-Container-Start=2&X-Plex-Container-Size=2',
    });
  });

  it('continues paging until a local filter reaches maxResults', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        MediaContainer: {
          Metadata: [
            { id: 1, title: 'one' },
            { id: 2, title: 'two' },
          ],
          size: 2,
          totalSize: 4,
        },
      })
      .mockResolvedValueOnce({
        MediaContainer: {
          Metadata: [
            { id: 3, title: 'target' },
            { id: 4, title: 'four' },
          ],
          size: 2,
          totalSize: 4,
        },
      });
    const server = { query } as unknown as PlexServer;

    const items = await fetchItems(
      server,
      '/items',
      { title__iexact: 'target' },
      TestItem,
      undefined,
      { maxResults: 1 },
    );

    expect(items.map(item => item.title)).toEqual(['target']);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('matches nested Plex metadata fields', async () => {
    const server = {
      query: vi.fn().mockResolvedValue({
        MediaContainer: {
          Metadata: [
            {
              Guid: [{ id: 'imdb://tt123' }],
              id: 1,
              title: 'one',
            },
          ],
          size: 1,
          totalSize: 1,
        },
      }),
    } as unknown as PlexServer;

    const items = await fetchItems(
      server,
      '/items',
      { Guid__id__iexact: 'IMDB://TT123' },
      TestItem,
    );

    expect(items.map(item => item.title)).toEqual(['one']);
  });

  it('hydrates one item and throws NotFound when no item matches', async () => {
    const foundServer = {
      query: vi.fn().mockResolvedValue({
        MediaContainer: { Metadata: [{ id: 1, title: 'one' }], size: 1, totalSize: 1 },
      }),
    } as unknown as PlexServer;
    const emptyServer = {
      query: vi.fn().mockResolvedValue({
        MediaContainer: { Metadata: [], size: 0, totalSize: 0 },
      }),
    } as unknown as PlexServer;

    const item = await fetchItem(foundServer, '/items', undefined, TestItem);

    expect(item).toBeInstanceOf(TestItem);
    await expect(fetchItem(emptyServer, '/items', undefined, TestItem)).rejects.toBeInstanceOf(
      NotFound,
    );
  });
});

describe('local filter operators', () => {
  it('uses value-contains-query semantics', () => {
    expect(OPERATORS.contains('foobar', 'foo')).toBe(true);
    expect(OPERATORS.icontains('FooBar', 'foo')).toBe(true);
    expect(OPERATORS.contains('foo', 'foobar')).toBe(false);
  });

  it('checks membership without string coercion', () => {
    expect(OPERATORS.in(2, [1, 2, 3])).toBe(true);
    expect(OPERATORS.in('2', [1, 2, 3])).toBe(false);
    expect(OPERATORS.in('2', '12')).toBe(false);
  });
});
