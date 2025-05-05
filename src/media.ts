import { PlexObject } from './base/plexObject.js';
import type {
  ChapterData,
  MarkerData,
  MediaData,
  MediaPartData,
  MediaPartStreamData,
} from './video.types.js';

/**
 * Base class for media tags used for filtering and searching your library
 * items or navigating the metadata of media items in your library. Tags are
 * the construct used for things such as Country, Director, Genre, etc.
 */
abstract class MediaTag extends PlexObject {
  static override TAG: string;
  /** Tag ID (This seems meaningless except to use it as a unique id). */
  id?: string;
  /** unknown */
  role?: string;
  /**
   * Name of the tag. This will be Animation, SciFi etc for Genres.
   * The name of person for Directors and Roles (ex: Animation, Stephen Graham, etc).
   */
  tag!: string;
  abstract FILTER: string;

  // async items(): Promise<any[]> {
  //   if (!this.key) {
  //     throw new Error(`Key is not defined for this tag: ${this.tag}`);
  //   }

  //   return fetchItems(this.server, this.key);
  // }

  protected _loadData(data: any): void {
    this.key = data.key;
    this.id = data.id;
    this.role = data.role;
    this.tag = data.tag;
  }
}

export class Media extends PlexObject {
  static override TAG = 'Media' as const;
  aspectRatio!: number;
  /**
   * Number of audio channels for this video (ex: 6)
   */
  audioChannels!: number;
  /**
   * Audio codec used within the video (ex: ac3)
   */
  audioCodec!: string;
  /**
   * Bitrate of the video (ex: 1624)
   */
  bitrate!: number;
  /**
   * Length of the video in milliseconds (ex: 6990483)
   */
  duration!: number;
  /**
   * Height of the video in pixels (ex: 256)
   */
  height!: number;
  /**
   * Plex ID of this media item
   */
  id!: number;
  /**
   * True if video has 64 bit offsets
   */
  has64bitOffsets!: boolean;
  optimizedForStreaming!: boolean;
  title?: string;
  videoCodec!: string;
  videoFrameRate!: string;
  videoProfile!: string;
  /** Width of the video in pixels */
  width!: number;
  parts!: MediaPart[];

  protected _loadData(data: MediaData) {
    this.aspectRatio = data.aspectRatio;
    this.audioChannels = data.audioChannels;
    this.audioCodec = data.audioCodec;
    this.bitrate = data.bitrate;
    this.duration = data.duration;
    this.height = data.height;
    this.id = data.id;
    this.has64bitOffsets = data.has64bitOffsets;
    this.optimizedForStreaming = data.optimizedForStreaming;
    this.title = data.title;
    this.videoCodec = data.videoCodec;
    this.videoFrameRate = data.videoFrameRate;
    this.videoProfile = data.videoProfile;
    this.width = data.width;
    this.parts = data.Part.map(part => new MediaPart(this.server, part, undefined, this));
  }
}

export class MediaPart extends PlexObject {
  static override TAG = 'Part' as const;

  container!: string;
  duration!: number;
  file!: string;
  id!: number;
  indexes!: string;
  size!: number;
  optimizedForStreaming!: boolean;
  syncItemId!: string;
  syncState!: string;
  videoProfile!: string;
  streams!: MediaPartStream[];
  exists?: boolean;

  /**
   * Set the selected {@link AudioStream} for this MediaPart.
   * @param stream Audio stream or stream ID to set as selected.
   */
  async setSelectedAudioStream(stream: AudioStream | number): Promise<this> {
    const key = `/library/parts/${this.id}`;
    const params = new URLSearchParams({ allParts: '1' });
    const streamId = typeof stream === 'number' ? stream : stream.id;
    params.set('audioStreamID', streamId.toString());
    await this.server.query(key + '?' + params.toString(), 'put');
    return this;
  }

  /**
   * Set the selected {@link SubtitleStream} for this MediaPart.
   * @param stream Subtitle stream or stream ID to set as selected.
   */
  async setSelectedSubtitleStream(stream: SubtitleStream | number): Promise<this> {
    const key = `/library/parts/${this.id}`;
    const params = new URLSearchParams({ allParts: '1' });
    const streamId = typeof stream === 'number' ? stream : stream.id;
    params.set('subtitleStreamID', streamId.toString());
    await this.server.query(key + '?' + params.toString(), 'put');
    return this;
  }

  /**
   * Returns a list of {@link AudioStream} objects in this MediaPart.
   */
  audioStreams(): AudioStream[] {
    return this.streams.filter((stream): stream is AudioStream => stream instanceof AudioStream);
  }

  /**
   * Returns a list of {@link SubtitleStream} objects in this MediaPart.
   */
  subtitleStreams(): SubtitleStream[] {
    return this.streams.filter(
      (stream): stream is SubtitleStream => stream instanceof SubtitleStream,
    );
  }

  /**
   * Returns a list of {@link LyricStream} objects in this MediaPart.
   */
  lyricStreams(): LyricStream[] {
    return this.streams.filter((stream): stream is LyricStream => stream instanceof LyricStream);
  }

  protected _loadData(data: MediaPartData) {
    this.container = data.container;
    this.duration = data.duration;
    this.file = data.file;
    this.id = data.id;
    this.key = data.key;
    this.size = data.size;
    this.optimizedForStreaming = data.optimizedForStreaming;
    this.videoProfile = data.videoProfile;
    this.exists = data.exists;
    this.streams =
      data.Stream?.map(stream => new MediaPartStream(this.server, stream, undefined, this)) ?? [];
  }
}

export class MediaPartStream extends PlexObject {
  static override TAG = 'Stream' as const;

  id!: number;
  codec!: string;
  index!: number;
  language?: string;
  languageCode?: string;
  selected?: boolean;
  streamType?: number;

  protected _loadData(data: MediaPartStreamData) {
    this.id = data.id;
    this.codec = data.codec;
    this.index = data.index;
    this.language = data.language;
    this.languageCode = data.languageCode;
    this.selected = data.selected;
    this.streamType = data.streamType;
  }
}

/**
 * Represents a single Subtitle stream within a {@link MediaPart}.
 */
export class SubtitleStream extends MediaPartStream {
  static override TAG = 'Stream' as const;
  static STREAMTYPE = 3;
  /** True if the subtitle stream can be auto synced. */
  canAutoSync?: boolean;
  /** The container of the subtitle stream. */
  container?: string;
  /** True if this is a forced subtitle. */
  forced!: boolean;
  /** The format of the subtitle stream (ex: srt). */
  format?: string;
  /** The header compression of the subtitle stream. */
  headerCompression?: string;
  /** True if this is a hearing impaired (SDH) subtitle. */
  hearingImpaired!: boolean;
  /** True if the on-demand subtitle is a perfect match. */
  perfectMatch?: boolean;
  /** The provider title where the on-demand subtitle is downloaded from. */
  providerTitle?: string;
  /** The match score (download count) of the on-demand subtitle. */
  score?: number;
  /** The source key of the on-demand subtitle. */
  sourceKey?: string;
  /** Unknown. */
  transient?: string;
  /** The user id of the user that downloaded the on-demand subtitle. */
  userID?: number;

  /**
   * Sets this subtitle stream as the selected subtitle stream.
   * Alias for `MediaPart.setSelectedSubtitleStream`.
   */
  async setSelected(): Promise<void> {
    const parent = this.parent?.deref() as MediaPart;
    if (!parent) {
      throw new Error('SubtitleStream must have a parent MediaPart');
    }
    await parent.setSelectedSubtitleStream(this);
  }

  protected override _loadData(data: any): void {
    super._loadData(data);
    this.canAutoSync = Boolean(data.canAutoSync); // Use !! for boolean casting from potential string/number
    this.container = data.container;
    this.forced = Boolean(parseInt(data.forced ?? '0', 10));
    this.format = data.format;
    this.headerCompression = data.headerCompression;
    this.hearingImpaired = Boolean(parseInt(data.hearingImpaired ?? '0', 10));
    this.perfectMatch = Boolean(data.perfectMatch);
    this.providerTitle = data.providerTitle;
    this.score = data.score ? parseInt(data.score, 10) : undefined;
    this.sourceKey = data.sourceKey;
    this.transient = data.transient;
    this.userID = data.userID ? parseInt(data.userID, 10) : undefined;
  }
}

/**
 * Represents a single Lyric stream within a {@link MediaPart}.
 */
export class LyricStream extends MediaPartStream {
  static override TAG = 'Stream' as const;
  static STREAMTYPE = 4;
  /** The format of the lyric stream (ex: lrc). */
  format?: string;
  /** The minimum number of lines in the (timed) lyric stream. */
  minLines?: number;
  /** The provider of the lyric stream (ex: com.plexapp.agents.lyricfind). */
  provider?: string;
  /** True if the lyrics are timed to the track. */
  timed!: boolean;

  protected override _loadData(data: any): void {
    super._loadData(data);
    this.format = data.format;
    this.minLines = data.minLines ? parseInt(data.minLines, 10) : undefined;
    this.provider = data.provider;
    this.timed = Boolean(parseInt(data.timed ?? '0', 10));
  }
}

/**
 * Represents a single Role (actor/actress) media tag.
 */
export class Role extends MediaTag {
  static override TAG = 'Role' as const;
  FILTER = 'role' as const;
}

/**
 * Represents a single Genre media tag.
 */
export class Genre extends MediaTag {
  static override TAG = 'Genre' as const;
  FILTER = 'genre' as const;
}

/**
 * Represents a single Country media tag.
 */
export class Country extends MediaTag {
  static override TAG = 'Country' as const;
  FILTER = 'country' as const;
}

/**
 * Represents a single Writer media tag.
 */
export class Writer extends MediaTag {
  static override TAG = 'Writer' as const;
  FILTER = 'writer' as const;
}

/**
 * Represents a single Director media tag.
 */
export class Director extends MediaTag {
  static override TAG = 'Director' as const;
  FILTER = 'director' as const;
}

export class Similar extends MediaTag {
  static override TAG = 'Similar' as const;
  FILTER = 'similar' as const;
}

export class Producer extends MediaTag {
  static override TAG = 'Producer' as const;
  FILTER = 'producer' as const;
}

export class Marker extends MediaTag {
  static override TAG = 'Marker' as const;
  FILTER = 'marker' as const;

  type!: 'intro' | 'credits';
  startTimeOffset!: number;
  endTimeOffset!: number;

  protected override _loadData(data: MarkerData) {
    this.type = data.type;
    this.startTimeOffset = data.startTimeOffset;
    this.endTimeOffset = data.endTimeOffset;
  }
}

/**
 * Represents a single Chapter media tag.
 */
export class Chapter extends MediaTag {
  static override TAG = 'Chapter' as const;
  FILTER = 'chapter' as const;

  startTimeOffset!: number;
  endTimeOffset!: number;
  thumb?: string;

  protected override _loadData(data: ChapterData) {
    this.startTimeOffset = data.startTimeOffset;
    this.endTimeOffset = data.endTimeOffset;
    this.thumb = data.thumb;
  }
}

/**
 * Represents a single Collection media tag.
 */
export class Collection extends MediaTag {
  static override TAG = 'Collection' as const;
  FILTER = 'collection' as const;
}

export class Optimized extends PlexObject {
  static override TAG = 'Item';
  id!: string;
  composite!: any;
  title!: any;
  type!: any;
  target!: any;
  targetTagID!: any;

  // TODO: Implement items()

  /**
   * Remove this Optimized item.
   */
  async remove(): Promise<void> {
    const key = `${this.key}/${this.id}`;
    await this.server.query(key, 'delete');
  }

  /**
   * Rename this Optimized item.
   * @param title New title for the item.
   */
  async rename(title: string): Promise<void> {
    const key = `${this.key}/${this.id}?Item[title]=${encodeURIComponent(title)}`;
    await this.server.query(key, 'put');
  }

  /**
   * Reprocess a removed Conversion item that is still a listed Optimize item.
   * @param ratingKey The rating key of the item to reprocess.
   */
  async reprocess(ratingKey: string | number): Promise<void> {
    const key = `${this.key}/${this.id}/${ratingKey}/enable`;
    await this.server.query(key, 'put');
  }

  protected _loadData(data: any) {
    this.id = data.id;
    this.composite = data.composite;
    this.title = data.title;
    this.type = data.type;
    this.target = data.target;
    this.targetTagID = data.targetTagID;
  }
}

/**
 * Base class for guid tags used only for Guids, as they contain only a string identifier
 */
class GuidTag extends PlexObject {
  /**
   * The guid for external metadata sources (e.g. IMDB, TMDB, TVDB). ex - imdb://tt3222784
   */
  id!: string;

  protected _loadData(data: any) {
    this.id = data.id;
  }
}

export class Guid extends GuidTag {
  static override TAG = 'Guid' as const;
}

/**
 * Represents a single Rating media tag.
 */
export class Rating extends PlexObject {
  static override TAG = 'Rating' as const;

  /**
   * The uri for the rating image
   * (e.g. ``imdb://image.rating``, ``rottentomatoes://image.rating.ripe``,
   * ``rottentomatoes://image.rating.upright``, ``themoviedb://image.rating``).
   */
  image!: string;

  /**
   * The type of rating (e.g. audience or critic).
   */
  type!: 'audience' | 'critic';

  /**
   * The rating value.
   */
  value!: number;

  protected _loadData(data: any) {
    this.image = data.image;
    this.type = data.type;
    this.value = data.value;
  }
}

/**
 * Base class for all Art, Poster, and Theme objects.
 */
abstract class BaseResource extends PlexObject {
  /**
   * The source of the resource. 'local' for local files (e.g. theme.mp3),
   */
  provider!: string;

  /**
   * Unique key identifying the resource.
   */
  ratingKey!: string;

  /**
   * True if the resource is currently selected.
   */
  selected!: boolean;

  /**
   * The URL to retrieve the resource thumbnail.
   */
  thumb!: string;

  async select() {
    const key = this.key.slice(0, -1);
    const params = new URLSearchParams();
    params.append('url', this.ratingKey);
    return this.server.query(`${key}?${params.toString()}`, 'put');
  }

  resourceFilepath(): string {
    if (this.ratingKey.startsWith('media://')) {
      return `Media/localhost/${this.ratingKey.split('://')[1]}`;
    }

    const parent = this.parent?.deref();

    if (this.ratingKey.startsWith('metadata://') && parent) {
      return `${parent.metadataDirectory}/Contents/_combined/${this.ratingKey.split('://')[1]}`;
    }

    if (this.ratingKey.startsWith('upload://') && parent) {
      return `${parent.metadataDirectory}/Uploads/${this.ratingKey.split('://')[1]}`;
    }

    return this.ratingKey;
  }

  protected _loadData(data: any) {
    this.key = data.key;
    this.provider = data.provider;
    this.ratingKey = data.ratingKey;
    this.selected = data.selected;
    this.thumb = data.thumb;
  }
}

/**
 * Represents a single Art object.
 */
export class Art extends BaseResource {
  static override TAG = 'Art';
}

/**
 * Represents a single Poster object.
 */
export class Poster extends BaseResource {
  static override TAG = 'Photo';
}

/**
 * Represents a single Theme object.
 */
export class Theme extends BaseResource {
  static override TAG = 'Theme';
}

/**
 * Represents a single Audio stream within a {@link MediaPart}.
 */
export class AudioStream extends MediaPartStream {
  static override TAG = 'Stream' as const;
  static STREAMTYPE = 2;
  /** The audio channel layout of the audio stream (ex: 5.1(side)). */
  audioChannelLayout?: string;
  /** The bit depth of the audio stream (ex: 16). */
  bitDepth?: number;
  /** The bitrate mode of the audio stream (ex: cbr). */
  bitrateMode?: string;
  /** The number of audio channels of the audio stream (ex: 6). */
  channels?: number;
  /** The duration of audio stream in milliseconds. */
  duration?: number;
  /** The profile of the audio stream. */
  profile?: string;
  /** The sampling rate of the audio stream (ex: 48000) */
  samplingRate?: number;
  /** The stream identifier of the audio stream. */
  streamIdentifier?: number;
  /** True if this is a visually impaired (AD) audio stream. */
  visualImpaired!: boolean;

  // Track only attributes
  /** The gain for the album. */
  albumGain?: number;
  /** The peak for the album. */
  albumPeak?: number;
  /** The range for the album. */
  albumRange?: number;
  /** The end ramp for the track. */
  endRamp?: string;
  /** The gain for the track. */
  gain?: number;
  /** The loudness for the track. */
  loudness?: number;
  /** The lra for the track. */
  lra?: number;
  /** The peak for the track. */
  peak?: number;
  /** The start ramp for the track. */
  startRamp?: string;

  /**
   * Sets this audio stream as the selected audio stream.
   * Alias for {@link MediaPart.setSelectedAudioStream}.
   */
  async setSelected(): Promise<void> {
    const parent = this.parent?.deref() as MediaPart;
    if (!parent) {
      throw new Error('AudioStream must have a parent MediaPart');
    }
    await parent.setSelectedAudioStream(this);
  }

  protected override _loadData(data: any): void {
    super._loadData(data);
    this.audioChannelLayout = data.audioChannelLayout;
    this.bitDepth = data.bitDepth ? parseInt(data.bitDepth, 10) : undefined;
    this.bitrateMode = data.bitrateMode;
    this.channels = data.channels ? parseInt(data.channels, 10) : undefined;
    this.duration = data.duration ? parseInt(data.duration, 10) : undefined;
    this.profile = data.profile;
    this.samplingRate = data.samplingRate ? parseInt(data.samplingRate, 10) : undefined;
    this.streamIdentifier = data.streamIdentifier ? parseInt(data.streamIdentifier, 10) : undefined;
    this.visualImpaired = Boolean(parseInt(data.visualImpaired ?? '0', 10));

    // Track only attributes
    this.albumGain = data.albumGain ? parseFloat(data.albumGain) : undefined;
    this.albumPeak = data.albumPeak ? parseFloat(data.albumPeak) : undefined;
    this.albumRange = data.albumRange ? parseFloat(data.albumRange) : undefined;
    this.endRamp = data.endRamp;
    this.gain = data.gain ? parseFloat(data.gain) : undefined;
    this.loudness = data.loudness ? parseFloat(data.loudness) : undefined;
    this.lra = data.lra ? parseFloat(data.lra) : undefined;
    this.peak = data.peak ? parseFloat(data.peak) : undefined;
    this.startRamp = data.startRamp;
  }
}

/** Represents a single Image media tag. */
export class Image extends PlexObject {
  static override TAG = 'Image' as const;

  /** The alt text for the image. */
  alt?: string;
  /** The type of image (e.g. coverPoster, background, snapshot). */
  type?: string;
  /** The API URL (/library/metadata/<ratingKey>/thumb/<thumbid>). */
  url?: string;

  protected _loadData(data: any): void {
    this.alt = data.alt;
    this.type = data.type;
    // Assuming server.url is needed to make this a complete URL
    this.url = data.url ? this.server.url(data.url, true)?.toString() : undefined;
  }
}

/** Represents a single Field. */
export class Field extends PlexObject {
  static override TAG = 'Field' as const;

  /** True if the field is locked. */
  locked!: boolean;
  /** The name of the field. */
  name!: string;

  protected _loadData(data: any): void {
    // Convert potential string '1' or '0' to boolean
    this.locked = data.locked === '1' || data.locked === true;
    this.name = data.name;
  }
}

/** Represents a single Mood media tag. */
export class Mood extends MediaTag {
  static override TAG = 'Mood' as const;
  override FILTER = 'mood' as const;
}
