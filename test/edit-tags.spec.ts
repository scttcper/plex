import { describe, expect, it, vi } from 'vitest';

import { PlexServer } from '../src/server.ts';
import { Movie } from '../src/video.ts';

describe('metadata tag edits', () => {
  it('preserves current custom tags absent from the hydrated model', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const item = new Movie(server, {
      key: '/library/metadata/10',
      ratingKey: '10',
      type: 'movie',
      librarySectionID: 1,
    });
    vi.spyOn(server, 'query').mockResolvedValue({
      MediaContainer: { Metadata: [{ PluginTag: [{ tag: 'Original' }] }] },
    });
    const edit = vi.spyOn(item, 'edit').mockImplementation(async () => {});
    vi.spyOn(item, 'reload').mockImplementation(async () => {});
    await item.editTags({ tag: 'pluginTag', items: ['Original', 'New', 'New'] });
    expect(edit).toHaveBeenCalledExactlyOnceWith({
      'pluginTag[0].tag.tag': 'Original',
      'pluginTag[1].tag.tag': 'New',
      'pluginTag.locked': 1,
    });
  });

  it('fails before writing if existing tags have an unexpected shape', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const item = new Movie(server, { key: '/library/metadata/10', ratingKey: '10' });
    vi.spyOn(server, 'query').mockResolvedValue({
      MediaContainer: { Metadata: [{ Genre: [{ title: 'Unrecognized' }] }] },
    });
    const edit = vi.spyOn(item, 'edit');
    await expect(item.editTags({ tag: 'genre', items: ['New'] })).rejects.toThrow(
      'Invalid metadata',
    );
    expect(edit).not.toHaveBeenCalled();
  });

  it('fails before writing when metadata is missing', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const item = new Movie(server, { key: '/library/metadata/10', ratingKey: '10' });
    vi.spyOn(server, 'query').mockResolvedValue({ MediaContainer: { Metadata: [] } });
    const edit = vi.spyOn(item, 'edit');
    await expect(item.editTags({ tag: 'genre', items: ['New'] })).rejects.toThrow(
      'current metadata',
    );
    expect(edit).not.toHaveBeenCalled();
  });

  it('removes only the supplied tags and preserves commas inside names', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const item = new Movie(server, { key: '/library/metadata/10', ratingKey: '10' });
    const query = vi.spyOn(server, 'query');
    const edit = vi.spyOn(item, 'edit').mockImplementation(async () => {});
    vi.spyOn(item, 'reload').mockImplementation(async () => {});
    await item.editTags({ tag: 'country', items: ['A, B', 'C & D'], remove: true, locked: false });
    expect(edit).toHaveBeenCalledExactlyOnceWith({
      'country[].tag.tag-': 'A%2C%20B,C%20%26%20D',
      'country.locked': 0,
    });
    expect(query).not.toHaveBeenCalled();
  });
});
