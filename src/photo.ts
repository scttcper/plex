import { URLSearchParams } from 'node:url';

import { PartialPlexObject } from './base/partialPlexObject.js';
import { Playable } from './base/playable.js';
import { PlexObject } from './base/plexObject.js';
import { fetchItem, findItems, type ItemFilterValue } from './baseFunctionality.js';
import { NotFound } from './exceptions.js';
import { Field, Image, Tag } from './media.js';
import type {
  PhotoalbumData,
  PhotoData,
  PhotoMediaData,
  PhotoMetadataResponse,
  PhotoPartData,
} from './photo.types.js';
import type { MediaContainer } from './util.js';
import { Clip } from './video.js';

function parseOptionalDate(value: number | string | undefined): Date | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }

  if (typeof value === 'number' || /^\d+$/.test(value)) {
    return new Date(Number(value) * 1000);
  }

  return new Date(value);
}

function parseOptionalNumber(value: number | string | undefined): number | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }

  return Number(value);
}

function isAlbumMetadata(item: Record<string, unknown>): boolean {
  return item.type === 'photo' && String(item.key ?? '').endsWith('/children');
}

function isPhotoMetadata(item: Record<string, unknown>): boolean {
  return item.type === 'photo' && !isAlbumMetadata(item);
}

async function fetchPhotoChildren<T>({
  cls,
  containerKeys,
  fallback,
  key,
  options,
  parent,
}: {
  cls: new (...args: any[]) => T;
  containerKeys: string[];
  fallback: (item: Record<string, unknown>) => boolean;
  key: string;
  options?: Record<string, ItemFilterValue>;
  parent: PartialPlexObject;
}): Promise<T[]> {
  const response = await parent.server.query<MediaContainer<Record<string, any[]>>>({ path: key });
  const container = response.MediaContainer;
  const typedItems = containerKeys.flatMap(containerKey => container[containerKey] ?? []);
  const fallbackItems = (container.Metadata ?? []).filter(fallback);
  const items = typedItems.length > 0 ? typedItems : fallbackItems;
  return findItems(items, options, cls, parent.server, parent);
}

export class Photoalbum extends PartialPlexObject {
  static override TAG = 'Directory';
  static override TYPE = 'photo';
  static readonly SEARCH_TYPE = 'photoalbum';

  declare addedAt?: Date;
  declare art?: string;
  declare composite?: string;
  declare fields: Field[];
  declare guid?: string;
  declare images: Image[];
  declare index?: number;
  declare lastRatedAt?: Date;
  declare librarySectionKey?: string;
  declare librarySectionTitle?: string;
  listType = 'photo' as const;
  declare summary?: string;
  declare thumb?: string;
  declare titleSort?: string;
  declare updatedAt?: Date;
  declare userRating?: number;

  async album(title: string): Promise<Photoalbum> {
    const [album] = await this.albums({ title__iexact: title });
    if (!album) {
      throw new NotFound(`Unable to find photo album with title "${title}".`);
    }

    return album;
  }

  async albums(options?: Record<string, string | number>): Promise<Photoalbum[]> {
    const key = this._buildQueryKey(`${this.key}/children`);
    return fetchPhotoChildren<Photoalbum>({
      cls: Photoalbum,
      containerKeys: ['Directory'],
      fallback: isAlbumMetadata,
      key,
      options,
      parent: this,
    });
  }

  async photo(title: string): Promise<Photo> {
    const [photo] = await this.photos({ title__iexact: title });
    if (!photo) {
      throw new NotFound(`Unable to find photo with title "${title}".`);
    }

    return photo;
  }

  async photos(options?: Record<string, string | number>): Promise<Photo[]> {
    const key = this._buildQueryKey(`${this.key}/children`);
    return fetchPhotoChildren<Photo>({
      cls: Photo,
      containerKeys: ['Photo'],
      fallback: isPhotoMetadata,
      key,
      options,
      parent: this,
    });
  }

  async clip(title: string): Promise<Clip> {
    const [clip] = await this.clips({ title__iexact: title });
    if (!clip) {
      throw new NotFound(`Unable to find clip with title "${title}".`);
    }

    return clip;
  }

  async clips(options?: Record<string, string | number>): Promise<Clip[]> {
    const key = this._buildQueryKey(`${this.key}/children`);
    return fetchPhotoChildren<Clip>({
      cls: Clip,
      containerKeys: ['Video'],
      fallback: item => item.type === 'clip',
      key,
      options,
      parent: this,
    });
  }

  override getWebURL({ base }: { base?: string } = {}): string {
    const params = new URLSearchParams({ key: this.key, legacy: '1' });
    return this.server._buildWebURL({ base, endpoint: 'details', params });
  }

  protected override _loadFullData(data: PhotoMetadataResponse<PhotoalbumData>): void {
    this._loadData(data.Metadata[0]);
  }

  protected override _loadData(data: PhotoalbumData): void {
    this.addedAt = parseOptionalDate(data.addedAt);
    this.art = data.art;
    this.composite = data.composite;
    this.fields = data.Field?.map(d => new Field(this.server, d, undefined, this)) ?? [];
    this.guid = data.guid;
    this.images = data.Image?.map(d => new Image(this.server, d, undefined, this)) ?? [];
    this.index = parseOptionalNumber(data.index);
    this.key = (data.key ?? '').replace('/children', '');
    this.lastRatedAt = parseOptionalDate(data.lastRatedAt);
    this.librarySectionID = parseOptionalNumber(data.librarySectionID);
    this.librarySectionKey = data.librarySectionKey;
    this.librarySectionTitle = data.librarySectionTitle;
    this.ratingKey = data.ratingKey?.toString();
    this.summary = data.summary;
    this.thumb = data.thumb;
    this.title = data.title;
    this.titleSort = data.titleSort ?? data.title;
    this.type = data.type;
    this.updatedAt = parseOptionalDate(data.updatedAt);
    this.userRating = parseOptionalNumber(data.userRating);
  }
}

export class PhotoMedia extends PlexObject {
  static override TAG = 'Media';

  declare aspectRatio?: number;
  declare bitrate?: number;
  declare container?: string;
  declare duration?: number;
  declare height?: number;
  declare id?: number;
  declare optimizedForStreaming?: boolean;
  declare parts: PhotoPart[];
  declare videoCodec?: string;
  declare videoFrameRate?: string;
  declare videoProfile?: string;
  declare width?: number;

  protected override _loadData(data: PhotoMediaData): void {
    this.aspectRatio = parseOptionalNumber(data.aspectRatio);
    this.bitrate = parseOptionalNumber(data.bitrate);
    this.container = data.container;
    this.duration = parseOptionalNumber(data.duration);
    this.height = parseOptionalNumber(data.height);
    this.id = parseOptionalNumber(data.id);
    this.optimizedForStreaming =
      data.optimizedForStreaming === true ||
      data.optimizedForStreaming === 1 ||
      data.optimizedForStreaming === '1';
    this.parts = data.Part?.map(part => new PhotoPart(this.server, part, undefined, this)) ?? [];
    this.videoCodec = data.videoCodec;
    this.videoFrameRate = data.videoFrameRate;
    this.videoProfile = data.videoProfile;
    this.width = parseOptionalNumber(data.width);
  }
}

export class PhotoPart extends PlexObject {
  static override TAG = 'Part';

  declare container?: string;
  declare duration?: number;
  declare file?: string;
  declare id?: number;
  declare size?: number;
  declare videoProfile?: string;

  originalUrl(): string | undefined {
    return this.key ? this.server.url(this.key, { includeToken: true }).toString() : undefined;
  }

  protected override _loadData(data: PhotoPartData): void {
    this.container = data.container;
    this.duration = parseOptionalNumber(data.duration);
    this.file = data.file;
    this.id = parseOptionalNumber(data.id);
    this.key = data.key;
    this.size = parseOptionalNumber(data.size);
    this.videoProfile = data.videoProfile;
  }
}

export class Photo extends Playable {
  static override TAG = 'Photo';
  static override TYPE = 'photo';
  static readonly METADATA_TYPE = 'photo';

  declare addedAt?: Date;
  declare createdAtAccuracy?: string;
  declare createdAtTZOffset?: number;
  declare fields: Field[];
  declare guid?: string;
  declare images: Image[];
  declare index?: number;
  declare lastRatedAt?: Date;
  declare librarySectionKey?: string;
  declare librarySectionTitle?: string;
  listType = 'photo' as const;
  declare media: PhotoMedia[];
  declare originallyAvailableAt?: Date;
  declare parentGuid?: string;
  declare parentIndex?: number;
  declare parentKey?: string;
  declare parentRatingKey?: number;
  declare parentThumb?: string;
  declare parentTitle?: string;
  declare sourceURI?: string;
  declare summary?: string;
  declare tags: Tag[];
  declare thumb?: string;
  declare titleSort?: string;
  declare updatedAt?: Date;
  declare userRating?: number;

  get locations(): string[] {
    return this.media
      .flatMap(media => media.parts)
      .map(part => part.file)
      .filter(Boolean);
  }

  /**
   * Returns authenticated URLs for the original photo files exposed by Plex.
   * This does not download files or write to disk.
   */
  originalUrls(): string[] {
    return this.media
      .flatMap(media => media.parts)
      .map(part => part.originalUrl())
      .filter(Boolean)
      .map(url => url);
  }

  /**
   * Returns the first authenticated original file URL, when Plex exposes one.
   * This does not download files or write to disk.
   */
  originalUrl(): string | undefined {
    return this.originalUrls()[0];
  }

  async photoalbum(): Promise<Photoalbum> {
    if (!this.parentKey) {
      throw new Error('Missing parentKey to fetch photo album');
    }

    const key = this._buildQueryKey(this.parentKey);
    const data = await fetchItem(this.server, key);
    return new Photoalbum(this.server, data, this.parentKey, this);
  }

  override getWebURL({ base }: { base?: string } = {}): string {
    const params = new URLSearchParams({
      key: this.parentKey ?? this.key,
      legacy: '1',
    });
    return this.server._buildWebURL({ base, endpoint: 'details', params });
  }

  protected override _loadFullData(data: PhotoMetadataResponse<PhotoData>): void {
    this._loadData(data.Metadata[0]);
  }

  protected override _loadData(data: PhotoData): void {
    this.addedAt = parseOptionalDate(data.addedAt);
    this.createdAtAccuracy = data.createdAtAccuracy;
    this.createdAtTZOffset = parseOptionalNumber(data.createdAtTZOffset);
    this.fields = data.Field?.map(d => new Field(this.server, d, undefined, this)) ?? [];
    this.guid = data.guid;
    this.images = data.Image?.map(d => new Image(this.server, d, undefined, this)) ?? [];
    this.index = parseOptionalNumber(data.index);
    this.key = data.key;
    this.lastRatedAt = parseOptionalDate(data.lastRatedAt);
    this.librarySectionID = parseOptionalNumber(data.librarySectionID);
    this.librarySectionKey = data.librarySectionKey;
    this.librarySectionTitle = data.librarySectionTitle;
    this.media = data.Media?.map(d => new PhotoMedia(this.server, d, undefined, this)) ?? [];
    this.originallyAvailableAt = parseOptionalDate(data.originallyAvailableAt);
    this.parentGuid = data.parentGuid;
    this.parentIndex = parseOptionalNumber(data.parentIndex);
    this.parentKey = data.parentKey;
    this.parentRatingKey = parseOptionalNumber(data.parentRatingKey);
    this.parentThumb = data.parentThumb;
    this.parentTitle = data.parentTitle;
    this.ratingKey = data.ratingKey?.toString();
    this.sourceURI = data.source;
    this.summary = data.summary;
    this.tags = data.Tag?.map(d => new Tag(this.server, d, undefined, this)) ?? [];
    this.thumb = data.thumb;
    this.title = data.title;
    this.titleSort = data.titleSort ?? data.title;
    this.type = data.type;
    this.updatedAt = parseOptionalDate(data.updatedAt);
    this.userRating = parseOptionalNumber(data.userRating);
    this.year = parseOptionalNumber(data.year);
  }
}
