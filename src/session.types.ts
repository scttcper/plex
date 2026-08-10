import type { Track } from './audio.ts';
import type { Photo } from './photo.ts';
import type { PlexBoolean } from './util.ts';
import type { Clip, Episode, Movie } from './video.ts';

export interface PlexSessionUser {
  readonly id: number;
  readonly title: string;
  readonly thumb?: string;
}

export interface PlexSessionPlayer {
  readonly machineIdentifier: string;
  readonly state: string;
  readonly title: string;
  readonly address?: string;
  readonly device?: string;
  readonly local?: boolean;
  readonly model?: string;
  readonly platform?: string;
  readonly platformVersion?: string;
  readonly product?: string;
  readonly profile?: string;
  readonly relayed?: boolean;
  readonly remotePublicAddress?: string;
  readonly secure?: boolean;
  readonly userId?: number;
  readonly version?: string;
}

export interface PlexPlaybackSession {
  readonly id: string;
  readonly bandwidth: number;
  /** Common values include `lan`, `wan`, and `cellular`. */
  readonly location: string;
}

export interface PlexTranscodeSession {
  readonly id: string;
  readonly complete: boolean;
  readonly context: string;
  readonly error: boolean;
  readonly progress: number;
  readonly size: number;
  readonly speed: number;
  readonly throttled: boolean;
  readonly audioChannels?: number;
  readonly audioCodec?: string;
  readonly audioDecision?: string;
  readonly container?: string;
  readonly duration?: number;
  readonly hardwareDecoding?: string;
  readonly hardwareDecodingTitle?: string;
  readonly hardwareEncoding?: string;
  readonly hardwareEncodingTitle?: string;
  readonly hardwareFullPipeline?: boolean;
  readonly hardwareRequested?: boolean;
  readonly height?: number;
  readonly maxOffsetAvailable?: number;
  readonly minOffsetAvailable?: number;
  readonly protocol?: string;
  readonly remaining?: number;
  readonly sourceAudioCodec?: string;
  readonly sourceVideoCodec?: string;
  readonly startedAt?: Date;
  readonly subtitleDecision?: string;
  readonly videoCodec?: string;
  readonly videoDecision?: string;
  readonly width?: number;
}

export type PlexSessionItem = (Clip | Episode | Movie | Photo | Track) & {
  live: boolean;
  player: PlexSessionPlayer;
  sessionKey: number;
  user: PlexSessionUser;
  session?: PlexPlaybackSession;
  transcodeSession?: PlexTranscodeSession;
};

export interface PlexSessionUserData {
  readonly id: string;
  readonly title: string;
  readonly thumb?: string;
}

export interface PlexSessionPlayerData {
  readonly machineIdentifier: string;
  readonly state: string;
  readonly title: string;
  readonly address?: string;
  readonly device?: string;
  readonly model?: string;
  readonly platform?: string;
  readonly platformVersion?: string;
  readonly product?: string;
  readonly profile?: string;
  readonly remotePublicAddress?: string;
  readonly version?: string;
  readonly local?: PlexBoolean;
  readonly relayed?: PlexBoolean;
  readonly secure?: PlexBoolean;
  readonly userID?: number;
}

export interface PlexPlaybackSessionData {
  readonly id: string;
  readonly bandwidth: number;
  readonly location: string;
}

export interface PlexTranscodeSessionData {
  readonly key: string;
  readonly complete: PlexBoolean;
  readonly context: string;
  readonly error: PlexBoolean;
  readonly progress: number;
  readonly size: number;
  readonly speed: number;
  readonly throttled: PlexBoolean;
  readonly audioChannels?: number;
  readonly audioCodec?: string;
  readonly audioDecision?: string;
  readonly container?: string;
  readonly duration?: number;
  readonly height?: number;
  readonly maxOffsetAvailable?: number;
  readonly minOffsetAvailable?: number;
  readonly protocol?: string;
  readonly remaining?: number;
  readonly sourceAudioCodec?: string;
  readonly sourceVideoCodec?: string;
  readonly subtitleDecision?: string;
  readonly timeStamp?: number;
  readonly transcodeHwDecoding?: string;
  readonly transcodeHwDecodingTitle?: string;
  readonly transcodeHwEncoding?: string;
  readonly transcodeHwEncodingTitle?: string;
  readonly transcodeHwFullPipeline?: PlexBoolean;
  readonly transcodeHwRequested?: PlexBoolean;
  readonly videoCodec?: string;
  readonly videoDecision?: string;
  readonly width?: number;
}

export interface PlexSessionMetadataData {
  readonly key: string;
  readonly ratingKey: string;
  readonly sessionKey: string;
  readonly title: string;
  readonly type: 'clip' | 'episode' | 'movie' | 'photo' | 'track';
  readonly live?: PlexBoolean;
  readonly Player: PlexSessionPlayerData;
  readonly Session?: PlexPlaybackSessionData;
  readonly TranscodeSession?: PlexTranscodeSessionData;
  readonly User: PlexSessionUserData;
}
