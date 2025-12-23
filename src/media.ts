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
  declare id?: string;
  /** unknown */
  declare role?: string;
  /**
   * Name of the tag. This will be Animation, SciFi etc for Genres.
   * The name of person for Directors and Roles (ex: Animation, Stephen Graham, etc).
   */
  declare tag: string;
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
  declare aspectRatio: number;
  /**
   * Number of audio channels for this video (ex: 6)
   */
  declare audioChannels: number;
  /**
   * Audio codec used within the video (ex: ac3)
   */
  declare audioCodec: string;
  /**
   * Bitrate of the video (ex: 1624)
   */
  declare bitrate: number;
  /**
   * Length of the video in milliseconds (ex: 6990483)
   */
  declare duration: number;
  /**
   * Height of the video in pixels (ex: 256)
   */
  declare height: number;
  /**
   * Plex ID of this media item
   */
  declare id: number;
  /**
   * True if video has 64 bit offsets
   */
  declare has64bitOffsets: boolean;
  declare optimizedForStreaming: boolean;
  declare title?: string;
  declare videoCodec: string;
  declare videoFrameRate: string;
  declare videoProfile: string;
  /** Width of the video in pixels */
  declare width: number;
  declare parts: MediaPart[];

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

  declare container: string;
  declare duration: number;
  declare file: string;
  declare id: number;
  declare indexes: string;
  declare size: number;
  declare optimizedForStreaming: boolean;
  declare syncItemId: string;
  declare syncState: string;
  declare videoProfile: string;
  declare streams: MediaPartStream[];
  declare exists?: boolean;

  /**
   * Set the selected {@link AudioStream} for this MediaPart.
   * @param stream Audio stream or stream ID to set as selected.
   */
  async setSelectedAudioStream(stream: AudioStream | number): Promise<this> {
    const key = `/library/parts/${this.id}`;
    const params = new URLSearchParams({ allParts: '1' });
    const streamId = typeof stream === 'number' ? stream : stream.id;
    params.set('audioStreamID', streamId.toString());
    await this.server.query(`${key}?${params.toString()}`, 'put');
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
    await this.server.query(`${key}?${params.toString()}`, 'put');
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

  declare id: number;
  declare codec: string;
  declare index: number;
  declare language?: string;
  declare languageCode?: string;
  declare selected?: boolean;
  declare streamType?: number;

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
  declare canAutoSync?: boolean;
  /** The container of the subtitle stream. */
  declare container?: string;
  /** True if this is a forced subtitle. */
  declare forced: boolean;
  /** The format of the subtitle stream (ex: srt). */
  declare format?: string;
  /** The header compression of the subtitle stream. */
  declare headerCompression?: string;
  /** True if this is a hearing impaired (SDH) subtitle. */
  declare hearingImpaired: boolean;
  /** True if the on-demand subtitle is a perfect match. */
  declare perfectMatch?: boolean;
  /** The provider title where the on-demand subtitle is downloaded from. */
  declare providerTitle?: string;
  /** The match score (download count) of the on-demand subtitle. */
  declare score?: number;
  /** The source key of the on-demand subtitle. */
  declare sourceKey?: string;
  /** Unknown. */
  declare transient?: string;
  /** The user id of the user that downloaded the on-demand subtitle. */
  declare userID?: number;

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
    this.forced = Boolean(Number.parseInt(data.forced ?? '0', 10));
    this.format = data.format;
    this.headerCompression = data.headerCompression;
    this.hearingImpaired = Boolean(Number.parseInt(data.hearingImpaired ?? '0', 10));
    this.perfectMatch = Boolean(data.perfectMatch);
    this.providerTitle = data.providerTitle;
    this.score = data.score ? Number.parseInt(data.score, 10) : undefined;
    this.sourceKey = data.sourceKey;
    this.transient = data.transient;
    this.userID = data.userID ? Number.parseInt(data.userID, 10) : undefined;
  }
}

/**
 * Represents a single Lyric stream within a {@link MediaPart}.
 */
export class LyricStream extends MediaPartStream {
  static override TAG = 'Stream' as const;
  static STREAMTYPE = 4;
  /** The format of the lyric stream (ex: lrc). */
  declare format?: string;
  /** The minimum number of lines in the (timed) lyric stream. */
  declare minLines?: number;
  /** The provider of the lyric stream (ex: com.plexapp.agents.lyricfind). */
  declare provider?: string;
  /** True if the lyrics are timed to the track. */
  declare timed: boolean;

  protected override _loadData(data: any): void {
    super._loadData(data);
    this.format = data.format;
    this.minLines = data.minLines ? Number.parseInt(data.minLines, 10) : undefined;
    this.provider = data.provider;
    this.timed = Boolean(Number.parseInt(data.timed ?? '0', 10));
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

  declare type: 'intro' | 'credits';
  declare startTimeOffset: number;
  declare endTimeOffset: number;

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

  declare startTimeOffset: number;
  declare endTimeOffset: number;
  declare thumb?: string;

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

/** Represents a single Label media tag. */
export class Label extends MediaTag {
  static override TAG = 'Label' as const;
  FILTER = 'label' as const;
}

/** Represents a single Style media tag. */
export class Style extends MediaTag {
  static override TAG = 'Style' as const;
  FILTER = 'style' as const;
}

/** Represents a single Format media tag. */
export class Format extends MediaTag {
  static override TAG = 'Format' as const;
  FILTER = 'format' as const;
}

/** Represents a single Subformat media tag. */
export class Subformat extends MediaTag {
  static override TAG = 'Subformat' as const;
  FILTER = 'subformat' as const;
}

export class Optimized extends PlexObject {
  static override TAG = 'Item';
  declare id: string;
  declare composite: any;
  declare title: any;
  declare type: any;
  declare target: any;
  declare targetTagID: any;

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
  declare id: string;

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
  declare image: string;

  /**
   * The type of rating (e.g. audience or critic).
   */
  declare type: 'audience' | 'critic';

  /**
   * The rating value.
   */
  declare value: number;

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
  declare provider: string;

  /**
   * Unique key identifying the resource.
   */
  declare ratingKey: string;

  /**
   * True if the resource is currently selected.
   */
  declare selected: boolean;

  /**
   * The URL to retrieve the resource thumbnail.
   */
  declare thumb: string;

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
  declare visualImpaired: boolean;

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
    this.bitDepth = data.bitDepth ? Number.parseInt(data.bitDepth, 10) : undefined;
    this.bitrateMode = data.bitrateMode;
    this.channels = data.channels ? Number.parseInt(data.channels, 10) : undefined;
    this.duration = data.duration ? Number.parseInt(data.duration, 10) : undefined;
    this.profile = data.profile;
    this.samplingRate = data.samplingRate ? Number.parseInt(data.samplingRate, 10) : undefined;
    this.streamIdentifier = data.streamIdentifier
      ? Number.parseInt(data.streamIdentifier, 10)
      : undefined;
    this.visualImpaired = Boolean(Number.parseInt(data.visualImpaired ?? '0', 10));

    // Track only attributes
    this.albumGain = data.albumGain ? Number.parseFloat(data.albumGain) : undefined;
    this.albumPeak = data.albumPeak ? Number.parseFloat(data.albumPeak) : undefined;
    this.albumRange = data.albumRange ? Number.parseFloat(data.albumRange) : undefined;
    this.endRamp = data.endRamp;
    this.gain = data.gain ? Number.parseFloat(data.gain) : undefined;
    this.loudness = data.loudness ? Number.parseFloat(data.loudness) : undefined;
    this.lra = data.lra ? Number.parseFloat(data.lra) : undefined;
    this.peak = data.peak ? Number.parseFloat(data.peak) : undefined;
    this.startRamp = data.startRamp;
  }
}

/** Represents a single Image media tag. */
export class Image extends PlexObject {
  static override TAG = 'Image' as const;

  /** The alt text for the image. */
  declare alt?: string;
  /** The type of image (e.g. coverPoster, background, snapshot). */
  declare type?: string;
  /** The API URL (/library/metadata/<ratingKey>/thumb/<thumbid>). */
  declare url?: string;

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
  declare locked: boolean;
  /** The name of the field. */
  declare name: string;

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
