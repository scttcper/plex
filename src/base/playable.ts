import { URLSearchParams } from 'node:url';

import type { AudioStream, Media, MediaPart, MediaPartStream, SubtitleStream } from '../media.js';
import { PlayQueue, type PlayQueue as PlayQueueType } from '../playqueue.js';
import type { CreatePlayQueueOptions } from '../playqueue.types.js';

import { PartialPlexObject } from './partialPlexObject.js';

/**
 * This is a general place to store functions specific to media that is Playable.
 * Things were getting mixed up a bit when dealing with Shows, Season, Artists,
 * Albums which are all not playable.
 */
export abstract class Playable extends PartialPlexObject {
  /** (int): Active session key. */
  declare sessionKey: any;
  /** (str): Username of the person playing this item (for active sessions). */
  declare usernames: any;
  /** (:class:`~plexapi.client.PlexClient`): Client objects playing this item (for active sessions). */
  declare players: any;
  /** (:class:`~plexapi.media.Session`): Session object, for a playing media file. */
  declare session: any;
  /** (:class:`~plexapi.media.TranscodeSession`): Transcode Session object if item is being transcoded (None otherwise). */
  declare transcodeSessions: any;
  /** (datetime): Datetime item was last viewed (history). */
  declare viewedAt: any;
  /** (int): Playlist item ID (only populated for :class:`~plexapi.playlist.Playlist` items). */
  declare playlistItemID?: number;

  /**
   * Returns a new PlayQueue from this media item.
   *
   * @param options Options for creating the PlayQueue
   * @returns New PlayQueue instance
   */
  async createPlayQueue(options: CreatePlayQueueOptions = {}): Promise<PlayQueueType> {
    return PlayQueue.create(this.server, this, options);
  }

  /**
   * Returns a stream URL that can be used for playback.
   * @param params Additional URL parameters for transcoding options.
   */
  getStreamURL(params: Record<string, string> = {}): string {
    const finalParams: Record<string, string> = {
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
    const searchParams = new URLSearchParams(finalParams);
    return this.server
      .url('/video/:/transcode/universal/start.m3u8', {
        includeToken: true,
        params: searchParams,
      })
      .toString();
  }

  /**
   * Returns all MediaPart objects across all Media entries.
   */
  iterParts(): MediaPart[] {
    const media: Media[] = (this as any).media ?? [];
    return media.flatMap(m => m.parts ?? []);
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

  /**
   * Returns all video streams from all media (first part of each).
   */
  videoStreams(): MediaPartStream[] {
    const media: Media[] = (this as any).media ?? [];
    return media.flatMap(m => {
      const firstPart = m.parts?.[0];
      if (!firstPart) {
        return [];
      }

      return firstPart.streams.filter(s => s.streamType === 1);
    });
  }

  /**
   * Update the play progress for this media item.
   * @param time Current playback time in milliseconds.
   * @param state Playback state ('playing', 'paused', 'stopped'). Default 'stopped'.
   */
  async updateProgress(
    time: number,
    state: 'playing' | 'paused' | 'stopped' = 'stopped',
  ): Promise<void> {
    const key = `/:/progress?key=${this.ratingKey}&identifier=com.plexapp.plugins.library&time=${time}&state=${state}`;
    await this.server.query({ path: key, method: 'post' });
  }

  /**
   * Update the timeline for this media item.
   * @param time Current playback time in milliseconds.
   * @param state Playback state ('playing', 'paused', 'stopped').
   * @param duration Total duration in milliseconds.
   */
  async updateTimeline(
    time: number,
    state: 'playing' | 'paused' | 'stopped',
    duration: number,
  ): Promise<void> {
    const key = `/:/timeline?ratingKey=${this.ratingKey}&key=${this.key}&identifier=com.plexapp.plugins.library&time=${time}&state=${state}&duration=${duration}`;
    await this.server.query({ path: key, method: 'post' });
  }
}
