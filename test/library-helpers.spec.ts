import { describe, expect, it, vi } from 'vitest';

import {
  BadRequest,
  ShowSection,
  type EditableLibraryItem,
  type PlexServer,
} from '../src/index.js';

const sectionData = {
  uuid: 'show-section-uuid',
  key: '2',
  agent: 'com.plexapp.agents.thetvdb',
  allowSync: true,
  art: '/:/resources/show-fanart.jpg',
  composite: '/library/sections/2/composite',
  filters: true,
  language: 'en-US',
  Location: [],
  refreshing: false,
  scanner: 'Plex TV Series',
  thumb: '/:/resources/show.png',
  title: 'TV Shows',
  type: 'show',
  updatedAt: 1,
  createdAt: 1,
  scannedAt: 1,
};

describe('LibrarySection edit helpers', () => {
  it('accepts child items that belong to the section through their parent', async () => {
    const query = vi.fn().mockResolvedValue({
      MediaContainer: {
        Common: [{ key: '/library/sections/2/common', mixedFields: '' }],
      },
    });
    const section = new ShowSection({ query } as unknown as PlexServer, sectionData);
    const item = {
      ratingKey: '101',
      title: 'Pilot',
      type: 'episode',
      parent: new WeakRef(section),
    } as unknown as EditableLibraryItem;

    const common = await section.common(item);

    expect(common.ratingKeys).toEqual([101]);
    expect(query).toHaveBeenCalledWith({
      path: '/library/sections/2/common?id=101&type=4',
    });
  });

  it('rejects child items from another section parent', async () => {
    const query = vi.fn();
    const section = new ShowSection({ query } as unknown as PlexServer, sectionData);
    const otherSection = new ShowSection({ query } as unknown as PlexServer, {
      ...sectionData,
      key: '3',
      uuid: 'other-show-section-uuid',
    });
    const item = {
      ratingKey: '101',
      title: 'Pilot',
      type: 'episode',
      parent: new WeakRef(otherSection),
    } as unknown as EditableLibraryItem;

    await expect(section.common(item)).rejects.toThrow(BadRequest);
    expect(query).not.toHaveBeenCalled();
  });
});
