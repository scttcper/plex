import { PlexObject } from './base/plexObject.ts';
import { fetchItems } from './baseFunctionality.ts';
import { BadRequest, NotFound, Unsupported } from './exceptions.ts';
import type { Location } from './library.types.ts';
import type {
  CustomOptimizationTarget,
  OptimizeOptions,
  OptimizationPreset,
  OptimizationState,
} from './optimized.types.ts';
import type { PlexServer } from './server.ts';
import { parsePlexBoolean, type MediaContainer, type PlexBoolean } from './util.ts';
import { Clip, Episode, Movie } from './video.ts';

export type OptimizedMediaItem = Clip | Episode | Movie;

export interface OptimizableVideo {
  key: string;
  librarySectionID?: number;
  title?: string;
  type?: string;
  section(): Promise<{
    locations: Location[];
    uuid: string;
  }>;
}

export type CreateOptimizedVersionOptions = OptimizeOptions & { item: OptimizableVideo };

const PRESET_TAGS = {
  mobile: 'Optimized for Mobile',
  original: 'Original Quality',
  tv: 'Optimized for TV',
} as const satisfies Record<OptimizationPreset, string>;

interface OptimizationTargetTagData {
  id: number;
  tag: string;
}

type OptimizationResolution = `${number}x${number}`;

interface OptimizationStatus {
  itemsCompleteCount: number;
  itemsCount: number;
  itemsSuccessfulCount: number;
  state: OptimizationState;
  totalSize: number;
}

interface OptimizationMediaSettings {
  advancedSubtitles: string;
  maxVideoBitrate?: number;
  subtitles: string;
  videoBitrate?: number;
  videoQuality?: number;
  videoResolution?: OptimizationResolution;
}

interface OptimizationPolicy {
  scope: 'all' | 'count';
  unwatched: boolean;
  value?: number;
}

interface OptimizationLocation {
  librarySectionID: number;
  uri: string;
}

interface OptimizationDevice {
  profile: string;
}

interface OptimizedResponse {
  composite: string;
  Device: OptimizationDevice;
  id: number;
  Location: OptimizationLocation;
  MediaSettings: OptimizationMediaSettings;
  Policy: Omit<OptimizationPolicy, 'unwatched'> & { unwatched: PlexBoolean };
  Status: OptimizationStatus;
  target: string;
  targetTagID?: number;
  title: string;
  type: 42;
}

interface OptimizedMediaItemResponse {
  processingState?: OptimizationState;
  type: 'clip' | 'episode' | 'movie';
}

interface TranscodeJobResponse {
  generatorID: number;
  key: string;
  progress: number;
  ratingKey: string;
  remaining: number;
  size: number;
  speed: number;
  targetTagID?: number;
  thumb: string;
  title: string;
  type: string;
}

interface BackgroundProcessingPlaylistResponse {
  addedAt: number;
  guid: string;
  key: string;
  playlistType: 'backgroundProcessing';
  ratingKey: string;
  summary: string;
  title: string;
  type: 'playlist';
}

/** A Plex optimized-media group and its conversion status. */
export class Optimized extends PlexObject {
  static override TAG = 'Item';

  declare composite: string;
  declare device: OptimizationDevice;
  declare id: number;
  declare location: OptimizationLocation;
  declare mediaSettings: OptimizationMediaSettings;
  declare policy: OptimizationPolicy;
  declare status: OptimizationStatus;
  declare target: string;
  declare targetTagID?: number;
  declare title: string;
  readonly type = 42 as const;

  /** Return the movie, episode, or clip members represented by this optimized group. */
  async items(): Promise<OptimizedMediaItem[]> {
    const items = await fetchItems<OptimizedMediaItemResponse>(this.server, `${this.key}/items`);
    return items.map(item => createOptimizedMediaItem(this.server, item, this.key, this));
  }

  /** Remove this optimized group and its generated media. */
  async remove(): Promise<void> {
    await this.server.query({ path: this.key, method: 'delete' });
  }

  /** Rename this optimized group. */
  async rename(title: string): Promise<this> {
    const params = new URLSearchParams({ 'Item[title]': title });
    await this.server.query({ path: `${this.key}?${params.toString()}`, method: 'put' });
    this.title = title;
    return this;
  }

  /** Re-enable processing for a removed member that remains in this optimized group. */
  async reprocess(ratingKey: string | number): Promise<void> {
    await this.server.query({ path: `${this.key}/${ratingKey.toString()}/enable`, method: 'put' });
  }

  protected _loadData(data: OptimizedResponse): void {
    this.id = data.id;
    const [basePath] = this.initpath.split('?', 1);
    this.key = `${basePath}/${this.id.toString()}`;
    this.composite = data.composite;
    this.title = data.title;
    this.target = data.target;
    this.targetTagID = data.targetTagID;
    this.status = data.Status;
    this.mediaSettings = data.MediaSettings;
    this.policy = { ...data.Policy, unwatched: parsePlexBoolean(data.Policy.unwatched) };
    this.location = data.Location;
    this.device = data.Device;
  }
}

/** An active Plex background transcode job. */
export class TranscodeJob extends PlexObject {
  static override TAG = 'TranscodeJob';

  declare generatorID: number;
  declare progress: number;
  declare ratingKey: string;
  declare remaining: number;
  declare size: number;
  declare speed: number;
  declare targetTagID?: number;
  declare thumb: string;
  declare title: string;
  declare type: string;

  protected _loadData(data: TranscodeJobResponse): void {
    this.generatorID = data.generatorID;
    this.key = data.key;
    this.progress = data.progress;
    this.ratingKey = data.ratingKey;
    this.remaining = data.remaining;
    this.size = data.size;
    this.speed = data.speed;
    this.targetTagID = data.targetTagID;
    this.thumb = data.thumb;
    this.title = data.title;
    this.type = data.type;
  }
}

export async function fetchOptimizedItems(server: PlexServer): Promise<Optimized[]> {
  const playlist = await backgroundProcessingPlaylist(server);
  return fetchItems(server, playlist.key, undefined, Optimized, server);
}

export async function createOptimizedVersion(
  server: PlexServer,
  { item, ...options }: CreateOptimizedVersionOptions,
): Promise<Optimized> {
  validateOptimizeOptions(options);
  const playlist = await backgroundProcessingPlaylist(server);
  const existingIds = new Set(
    (await fetchItems(server, playlist.key, undefined, Optimized, server)).map(group => group.id),
  );
  const section = await item.section();
  const locationID = resolveLocationID(options.location, section.locations);
  const target = await resolveTarget(server, options);
  const params = optimizationParams(item, section.uuid, locationID, target, options);

  await server.query({ path: `${playlist.key}?${params.toString()}`, method: 'put' });

  const groups = await fetchItems(server, playlist.key, undefined, Optimized, server);
  const created = groups.find(group => !existingIds.has(group.id));
  if (!created) {
    throw new NotFound('Plex did not return the newly created optimized-media group.');
  }

  return created;
}

async function backgroundProcessingPlaylist(
  server: PlexServer,
): Promise<BackgroundProcessingPlaylistResponse> {
  const response = await server.query<
    MediaContainer<{ Metadata?: BackgroundProcessingPlaylistResponse[] }>
  >({ path: '/playlists?type=42' });
  const [playlist] = response.MediaContainer.Metadata ?? [];
  if (!playlist) {
    throw new NotFound('Plex did not return its background processing playlist.');
  }
  return playlist;
}

async function resolveTarget(
  server: PlexServer,
  options: OptimizeOptions,
): Promise<{ target: string; targetTagID?: number }> {
  if (typeof options.target !== 'string') {
    return {
      target: options.target.name ?? `Custom: ${options.target.profile}`,
    };
  }

  const response = await server.query<MediaContainer<{ Tag?: OptimizationTargetTagData[] }>>({
    path: '/library/tags?type=42',
  });
  const tagName = PRESET_TAGS[options.target];
  const tag = response.MediaContainer.Tag?.find(candidate => candidate.tag === tagName);
  if (!tag) {
    throw new NotFound(`Plex did not return the "${tagName}" optimization preset.`);
  }
  return { target: '', targetTagID: tag.id };
}

function resolveLocationID(
  location: OptimizeOptions['location'],
  availableLocations: Location[],
): number {
  if (location === undefined || location === 'alongside-original') {
    return -1;
  }
  if (!availableLocations.some(candidate => candidate.id === location.id)) {
    throw new BadRequest(
      `Library location ${location.id.toString()} does not belong to this item.`,
    );
  }
  return location.id;
}

function optimizationParams(
  item: OptimizableVideo,
  sectionUUID: string,
  locationID: number,
  target: { target: string; targetTagID?: number },
  options: OptimizeOptions,
): URLSearchParams {
  const limit = options.limit ?? 0;
  const scope = options.limit === undefined ? 'all' : 'count';
  const uri = optimizationURI(item, sectionUUID);
  const params = new URLSearchParams({
    'Item[type]': '42',
    'Item[title]': options.title ?? item.title ?? 'Optimized Media',
    'Item[target]': target.target,
    'Item[targetTagID]': target.targetTagID?.toString() ?? '',
    'Item[locationID]': locationID.toString(),
    'Item[Location][uri]': uri,
    'Item[Policy][scope]': scope,
    'Item[Policy][value]': limit.toString(),
    'Item[Policy][unwatched]': options.unwatchedOnly ? '1' : '0',
  });

  if (typeof options.target !== 'string') {
    params.set('Item[Device][profile]', options.target.profile);
    params.set('Item[MediaSettings][videoQuality]', options.target.quality.toString());
    params.set(
      'Item[MediaSettings][videoResolution]',
      `${options.target.resolution.width.toString()}x${options.target.resolution.height.toString()}`,
    );
    params.set('Item[MediaSettings][maxVideoBitrate]', options.target.maxBitrate.toString());
    for (const field of [
      'audioBoost',
      'subtitleSize',
      'musicBitrate',
      'photoQuality',
      'photoResolution',
    ]) {
      params.set(`Item[MediaSettings][${field}]`, '');
    }
  }

  return params;
}

function optimizationURI(item: OptimizableVideo, sectionUUID: string): string {
  if (item.type === 'season' || item.type === 'show') {
    return `library:///directory/${encodeURIComponent(`${item.key}/children`)}`;
  }
  return `library://${sectionUUID}/item/${encodeURIComponent(item.key)}`;
}

function validateOptimizeOptions(options: OptimizeOptions): void {
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new BadRequest('Optimization limit must be a positive integer.');
  }
  if (typeof options.target === 'string') {
    return;
  }
  validateCustomTarget(options.target);
}

function validateCustomTarget(target: CustomOptimizationTarget): void {
  if (!target.profile.trim()) {
    throw new BadRequest('Custom optimization profile cannot be empty.');
  }
  if (target.name !== undefined && !target.name.trim()) {
    throw new BadRequest('Custom optimization name cannot be empty.');
  }
  if (!Number.isInteger(target.quality) || target.quality < 0 || target.quality > 100) {
    throw new BadRequest('Custom optimization quality must be an integer from 0 to 100.');
  }
  if (!Number.isInteger(target.maxBitrate) || target.maxBitrate < 1) {
    throw new BadRequest('Custom optimization maxBitrate must be a positive integer.');
  }
  if (
    !Number.isInteger(target.resolution.width) ||
    target.resolution.width < 1 ||
    !Number.isInteger(target.resolution.height) ||
    target.resolution.height < 1
  ) {
    throw new BadRequest('Custom optimization resolution dimensions must be positive integers.');
  }
}

function createOptimizedMediaItem(
  server: PlexServer,
  data: OptimizedMediaItemResponse,
  initpath: string,
  parent: Optimized,
): OptimizedMediaItem {
  switch (data.type) {
    case 'clip': {
      return new Clip(server, data, initpath, parent);
    }
    case 'episode': {
      return new Episode(server, data, initpath, parent);
    }
    case 'movie': {
      return new Movie(server, data, initpath, parent);
    }
    default: {
      throw new Unsupported(`Unsupported optimized-media item type: ${data.type}`);
    }
  }
}
