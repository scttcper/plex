import type { CreatePlayQueueOptions } from './playqueue.types.ts';
import type { PlexServer } from './server.ts';
import type { PlexBoolean } from './util.ts';

/** Media types accepted by Plex remote-control playback commands. */
export type ClientMediaType = 'video' | 'music' | 'photo';

/** Repeat modes accepted by Plex players: 0 off, 1 repeat one, 2 repeat all. */
export type ClientRepeatMode = 0 | 1 | 2;

/** Player attributes returned by `/resources`, `/clients`, and session players. */
export interface Player {
  machineIdentifier: string;
  deviceClass: string;
  platform: string;
  platformVersion: string;
  product: string;
  protocol: string;
  protocolCapabilities: string;
  protocolVersion: string;
  title: string;
  version: string;
  /** Some endpoints name the player instead of titling it. */
  name?: string;
  address?: string;
  device?: string;
  local?: PlexBoolean;
  model?: string;
  profile?: string;
  relayed?: PlexBoolean;
  remotePublicAddress?: string;
  secure?: PlexBoolean;
  state?: string;
  userID?: number | `${number}`;
  vendor?: string;
}

export interface PlexClientOptions {
  /** Server this client is connected to. Required for proxying commands through the server. */
  server?: PlexServer;
  /** Player data used to populate attributes without connecting to the client. */
  data?: Partial<Player>;
  /** HTTP URL used to connect directly to the client. Defaults to `http://localhost:32400`. */
  baseurl?: string;
  /** Player to select when the client's `/resources` endpoint lists more than one. */
  identifier?: string;
  /** X-Plex-Token used to authenticate with the client. */
  token?: string;
  /** Request timeout in milliseconds. */
  timeout?: number;
}

export interface PlexClientQueryOptions {
  path: string;
  method?: 'get' | 'post' | 'put' | 'patch' | 'head' | 'delete';
  headers?: Record<string, string>;
}

export interface ProxyThroughServerOptions {
  /** Send commands through the server instead of directly to the client. Defaults to true. */
  enabled?: boolean;
  /** Server to proxy through. Required when the client was not created with one. */
  server?: PlexServer;
}

export interface SendCommandParams {
  [key: string]: string | number | boolean | undefined;
}

export interface SendCommandOptions {
  /** Override the client's proxy setting for this command. */
  proxy?: boolean;
}

export interface ClientCommandOptions {
  /** Limit the command to one player type. */
  type?: ClientMediaType;
}

/** Timeline attributes. Players that answer in XML send every value as a string. */
export interface ClientTimelineData {
  type: string;
  state: string;
  address?: string;
  audioStreamId?: number | `${number}`;
  autoPlay?: PlexBoolean;
  containerKey?: string;
  controllable?: string;
  duration?: number | `${number}`;
  itemType?: string;
  key?: string;
  location?: string;
  machineIdentifier?: string;
  partCount?: number | `${number}`;
  partIndex?: number | `${number}`;
  playQueueID?: number | `${number}`;
  playQueueItemID?: number | `${number}`;
  playQueueVersion?: number | `${number}`;
  port?: number | `${number}`;
  protocol?: string;
  providerIdentifier?: string;
  ratingKey?: string;
  repeat?: number | `${number}`;
  seekRange?: string;
  shuffle?: PlexBoolean;
  subtitleColor?: string;
  subtitlePosition?: string;
  subtitleSize?: number | `${number}`;
  time?: number | `${number}`;
  volume?: number | `${number}`;
}

export interface TimelinesOptions {
  /** Seconds the player may wait for a timeline change before answering. */
  wait?: number;
}

export interface IsPlayingMediaOptions {
  /** Treat paused media as playing. Defaults to true. */
  includePaused?: boolean;
}

export interface SetParametersOptions extends ClientCommandOptions {
  volume?: number;
  shuffle?: boolean;
  repeat?: ClientRepeatMode;
}

export interface SetStreamsOptions extends ClientCommandOptions {
  audioStreamID?: number;
  /** Use 0 to disable subtitles. */
  subtitleStreamID?: number;
  videoStreamID?: number;
}

export interface PlayMediaOptions {
  /** Playback offset in milliseconds. */
  offset?: number;
  /** Additional remote-control parameters for the playMedia command. */
  params?: Record<string, string | number>;
}

export interface CreateClientPlayQueueOptions extends CreatePlayQueueOptions {
  /** Playback offset in milliseconds. */
  offset?: number;
  /** Start playback paused. */
  paused?: boolean;
}
