import { beforeAll, describe, expect, it } from 'vitest';

import {
  Photo,
  PhotoMedia,
  PhotoPart,
  PhotoSection,
  Unsupported,
  type PlexServer,
} from '../src/index.js';

import { createClient } from './test-client.js';

const PHOTO_SECTION_TITLE = 'Photos';
const PHOTO_FIXTURE_PATH = '/data/Photos/Cute Cat.jpg';

let plex: PlexServer;
let section: PhotoSection;
let fixturePhoto: Photo;

describe('Photo libraries', () => {
  beforeAll(async () => {
    plex = await createClient();
    const library = await plex.library();
    section = await library.section<PhotoSection>(PHOTO_SECTION_TITLE);
    const photos = await section.searchPhotos({ maxresults: 10 });
    const photo = photos.find(item => item.locations.includes(PHOTO_FIXTURE_PATH));

    if (!photo) {
      throw new Error(
        `Photos fixture not found. Run bootstraptest with --create-photos and ${PHOTO_FIXTURE_PATH}.`,
      );
    }

    fixturePhoto = photo;
  });

  it('discovers the Photos section as a PhotoSection', async () => {
    const library = await plex.library();
    const sections = await library.sections();

    expect(sections.find(item => item.title === PHOTO_SECTION_TITLE)).toBeInstanceOf(PhotoSection);
    expect(section).toBeInstanceOf(PhotoSection);
    expect(section.type).toBe('photo');
    expect(section.locations.map(location => location.path)).toContain('/data/Photos');
  });

  it('searches real photos with typed media and original urls', async () => {
    const photos = await section.searchPhotos({ maxresults: 10 });

    expect(photos.flatMap(photo => photo.locations)).toContain(PHOTO_FIXTURE_PATH);
    expect(fixturePhoto).toBeInstanceOf(Photo);
    expect(fixturePhoto.title).toBe('Cute Cat');
    expect(fixturePhoto.type).toBe('photo');
    expect(fixturePhoto.media[0]).toBeInstanceOf(PhotoMedia);
    expect(fixturePhoto.media[0].parts[0]).toBeInstanceOf(PhotoPart);
    expect(fixturePhoto.locations).toContain(PHOTO_FIXTURE_PATH);
    expect(fixturePhoto.originalUrl()).toContain('/library/parts/');
    expect(fixturePhoto.originalUrl()).toContain('X-Plex-Token=');
  });

  it('returns recently added photos as Photo instances', async () => {
    const photos = await section.recentlyAddedPhotos(10);

    expect(photos[0]).toBeInstanceOf(Photo);
    expect(photos.flatMap(photo => photo.locations)).toContain(PHOTO_FIXTURE_PATH);
  });

  it('rejects collections for photo libraries', async () => {
    await expect(section.collections()).rejects.toThrow(Unsupported);
  });
});
