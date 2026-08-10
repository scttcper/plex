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
  players: [PlexSessionPlayer];
  sessions: [] | [PlexPlaybackSession];
  sessionKey: number;
  transcodeSessions: [] | [PlexTranscodeSession];
  user: PlexSessionUser;
  usernames: [] | [string];
  session?: PlexPlaybackSession;
  transcodeSession?: PlexTranscodeSession;
};

export interface PlexSessionUserData {
  id: string;
  title: string;
  thumb?: string;
}

export interface PlexSessionPlayerData {
  machineIdentifier: string;
  state: string;
  title: string;
  address?: string;
  device?: string;
  model?: string;
  platform?: string;
  platformVersion?: string;
  product?: string;
  profile?: string;
  remotePublicAddress?: string;
  version?: string;
  local?: PlexBoolean;
  relayed?: PlexBoolean;
  secure?: PlexBoolean;
  userID?: number;
}

export interface PlexTranscodeSessionData {
  key: string;
  complete: PlexBoolean;
  context: string;
  error: PlexBoolean;
  progress: number;
  size: number;
  speed: number;
  throttled: PlexBoolean;
  audioChannels?: number;
  audioCodec?: string;
  audioDecision?: string;
  container?: string;
  duration?: number;
  height?: number;
  maxOffsetAvailable?: number;
  minOffsetAvailable?: number;
  protocol?: string;
  remaining?: number;
  sourceAudioCodec?: string;
  sourceVideoCodec?: string;
  subtitleDecision?: string;
  timeStamp?: number;
  transcodeHwDecoding?: string;
  transcodeHwDecodingTitle?: string;
  transcodeHwEncoding?: string;
  transcodeHwEncodingTitle?: string;
  transcodeHwFullPipeline?: PlexBoolean;
  transcodeHwRequested?: PlexBoolean;
  videoCodec?: string;
  videoDecision?: string;
  width?: number;
}

export interface PlexSessionItemData {
  key: string;
  ratingKey: string;
  sessionKey: string;
  title: string;
  type: 'clip' | 'episode' | 'movie' | 'photo' | 'track';
  live?: PlexBoolean;
  Player: PlexSessionPlayerData;
  Session?: PlexPlaybackSession;
  TranscodeSession?: PlexTranscodeSessionData;
  User: PlexSessionUserData;
}
