import { PlexObject } from '../src/base';

describe('Base', () => {
  it('should fetch item iexact title', async () => {
    const obj = {
      MediaContainer: {
        Metadata: [{ title: 'no match' }, { title: 'Something' }],
      },
    };
    const plexObject = new PlexObject({ query: async () => obj } as any);
    const result = await plexObject.fetchItem('/', { title__iexact: 'something' });
    expect(result).toEqual(obj.MediaContainer.Metadata[1]);
  });
  it('should fetch item iexact title and exact', async () => {
    const obj = {
      MediaContainer: {
        Metadata: [
          { title: 'something', attr: 1 },
          { title: 'something', attr: 2 },
        ],
      },
    };
    const plexObject = new PlexObject({ query: async () => obj } as any);
    const result = await plexObject.fetchItem('/', { title__iexact: 'something', attr__exact: 2 });
    expect(result).toEqual(obj.MediaContainer.Metadata[1]);
  });
});
