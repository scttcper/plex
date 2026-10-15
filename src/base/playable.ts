import { URLSearchParams } from 'node:url';

import type { PlexClient } from '../client.ts';
import type { PlayMediaOptions } from '../client.types.ts';
import {
  type AudioStream,
  type LyricStream,
  Media,
  type MediaPart,
  type SubtitleStream,
  type VideoStream,
} from '../media.ts';
import type { PlayQueue } from '../playqueue.ts';
import type { CreatePlayQueueOptions } from '../playqueue.types.ts';
import type {
  PlexPlaybackSession,
  PlexSessionPlayer,
  PlexSessionUser,
  PlexTranscodeSession,
} from '../session.types.ts';

import { PartialPlexObject } from './partialPlexObject.ts';

/** Common transcoder parameters; Plex and plugins can accept additional parameters. */
/** Playback states reported to Plex. */
export type PlaybackState = 'playing' | 'paused' | 'stopped' | 'buffering';

export interface UpdateProgressOptions {
  /** Milliseconds watched. */
  time: number;
  /** Defaults to stopped. */
  state?: PlaybackState;
}

export interface UpdateTimelineOptions extends UpdateProgressOptions {
  /** Item duration in milliseconds. Defaults to the item's duration. */
  duration?: number;
}

export interface StreamUrlOptions {
  /** Common values include hls and dash. Defaults to hls. */
  protocol?: string;
  mediaIndex?: number | string;
  partIndex?: number | string;
  /** Playback offset in seconds. */
  offset?: number | string;
  maxVideoBitrate?: number | string;
  videoResolution?: string;
  directPlay?: boolean | number | string;
  directStream?: boolean | number | string;
  [parameter: string]: string | number | boolean | undefined;
}

/**
 * This is a general place to store functions specific to media that is Playable.
 * Things were getting mixed up a bit when dealing with Shows, Season, Artists,
 * Albums which are all not playable.
 */
export abstract class Playable extends PartialPlexObject {
  /** Whether the active session is live TV. */
  declare live?: boolean;
  /** Server-local key for an active playback session. */
  declare sessionKey?: number;
  /** Usernames associated with this active playback. */
  usernames: string[] = [];
  /** Clients associated with this active playback. */
  players: PlexSessionPlayer[] = [];
  /** Bandwidth allocations associated with this active playback. */
  sessions: PlexPlaybackSession[] = [];
  /** Transcodes associated with this active playback. */
  transcodeSessions: PlexTranscodeSession[] = [];
  /** Account currently playing this item. */
  declare user?: PlexSessionUser;
  /** Client currently playing this item. */
  declare player?: PlexSessionPlayer;
  /** Bandwidth allocation for the active playback, when one exists. */
  declare session?: PlexPlaybackSession;
  /** Active transcode associated with this playback, when Plex includes it. */
  declare transcodeSession?: PlexTranscodeSession;
  /** Datetime item was last viewed (history). */
  declare viewedAt?: Date;
  /** (int): Playlist item ID (only populated for :class:`~plexapi.playlist.Playlist` items). */
  declare playlistItemID?: number;
  /** Queue-local item ID (only populated for PlayQueue items). */
  declare playQueueItemID?: number;

  get isPlayed(): boolean {
    return 'viewCount' in this && typeof this.viewCount === 'number' && this.viewCount > 0;
  }

  async markPlayed(): Promise<void> {
    await this.server.query({
      path: `/:/scrobble?key=${this.ratingKey}&identifier=com.plexapp.plugins.library`,
    });
    await this.reload();
  }

  async markUnplayed(): Promise<void> {
    await this.server.query({
      path: `/:/unscrobble?key=${this.ratingKey}&identifier=com.plexapp.plugins.library`,
    });
    await this.reload();
  }

  async play(client: PlexClient, options: PlayMediaOptions = {}): Promise<void> {
    await client.playMedia(this, options);
  }

  /**
   * Returns a new PlayQueue from this media item.
   *
   * @param options Options for creating the PlayQueue
   * @returns New PlayQueue instance
   */
  async createPlayQueue(options: CreatePlayQueueOptions = {}): Promise<PlayQueue> {
    return this.server.createPlayQueue(this, options);
  }

  /**
   * Returns a stream URL that can be used for playback.
   * @param params Additional URL parameters for transcoding options.
   */
  getStreamURL(params: Readonly<StreamUrlOptions> = {}): string {
    const finalParams: StreamUrlOptions = {
      path: `/library/metadata/${this.ratingKey}`,
      mediaIndex: '0',
      partIndex: '0',
      protocol: 'hls',
      fastSeek: '1',
      directPlay: '0',
      directStream: '1',
      directStreamAudio: '1',
      videoQuality: '100',
      maxVideoBitrate: '20000',
      subtitleSize: '100',
      audioBoost: '100',
      ...params,
    };
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(finalParams)) {
      if (value !== undefined) {
        searchParams.set(key, String(typeof value === 'boolean' ? Number(value) : value));
      }
    }
    return this.server
      .url(
        `/${this.type === 'track' ? 'audio' : 'video'}/:/transcode/universal/start.${finalParams.protocol === 'dash' ? 'mpd' : 'm3u8'}`,
        {
          includeToken: true,
          params: searchParams,
        },
      )
      .toString();
  }

  /**
   * Returns all MediaPart objects across all Media entries.
   */
  iterParts(): MediaPart[] {
    const media: unknown = 'media' in this ? this.media : undefined;
    if (!Array.isArray(media)) {
      return [];
    }

    return media
      .filter((item: unknown): item is Media => item instanceof Media)
      .flatMap(item => item.parts);
  }

  /**
   * Returns all audio streams from all parts.
   */
  audioStreams(): AudioStream[] {
    return this.iterParts().flatMap(part => part.audioStreams());
  }

  /**
   * Returns all subtitle streams from all parts.
   */
  subtitleStreams(): SubtitleStream[] {
    return this.iterParts().flatMap(part => part.subtitleStreams());
  }

  /** Returns all video streams from every media part. */
  videoStreams(): VideoStream[] {
    return this.iterParts().flatMap(part => part.videoStreams());
  }

  lyricStreams(): LyricStream[] {
    return this.iterParts().flatMap(part => part.lyricStreams());
  }

  get hasPreviewThumbnails(): boolean {
    return this.iterParts().some(part => part.hasPreviewThumbnails);
  }

  get hasVoiceActivity(): boolean {
    const media: unknown = 'media' in this ? this.media : undefined;
    return (
      Array.isArray(media) && media.some(item => item instanceof Media && item.hasVoiceActivity)
    );
  }

  /**
   * Set the watched progress for this item. Plex ignores progress of 60 seconds or less,
   * use {@link Playable.markUnplayed} to clear progress instead.
   */
  async updateProgress({ time, state = 'stopped' }: UpdateProgressOptions): Promise<void> {
    const params = new URLSearchParams({
      key: this.ratingKey,
      identifier: 'com.plexapp.plugins.library',
      time: Math.trunc(time).toString(),
      state,
    });
    await this.server.query({ path: `/:/progress?${params.toString()}`, method: 'post' });
  }

  /**
   * Report playback progress for this item the way a player would.
   * Duration defaults to the item's own duration.
   */
  async updateTimeline({
    time,
    state = 'stopped',
    duration = (this as { duration?: number }).duration,
  }: UpdateTimelineOptions): Promise<void> {
    const params = new URLSearchParams({
      ratingKey: this.ratingKey,
      key: this.key,
      identifier: 'com.plexapp.plugins.library',
      time: Math.trunc(time).toString(),
      state,
    });
    if (duration !== undefined) {
      params.set('duration', duration.toString());
    }
    await this.server.query({ path: `/:/timeline?${params.toString()}`, method: 'post' });
  }
}
