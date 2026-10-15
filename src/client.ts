import { URL, URLSearchParams } from 'node:url';

import { ofetch } from 'ofetch';
import { parseStringPromise } from 'xml2js';

import type { Playable } from './base/playable.ts';
import type {
  ClientCommandOptions,
  ClientMediaType,
  ClientRepeatMode,
  ClientTimelineData,
  CreateClientPlayQueueOptions,
  IsPlayingMediaOptions,
  Player,
  PlayMediaOptions,
  PlexClientOptions,
  PlexClientQueryOptions,
  ProxyThroughServerOptions,
  SendCommandOptions,
  SendCommandParams,
  SetParametersOptions,
  SetStreamsOptions,
  TimelinesOptions,
} from './client.types.ts';
import { BASE_HEADERS, TIMEOUT } from './config.ts';
import { BadRequest, NotFound } from './exceptions.ts';
import type { Playlist } from './playlist.ts';
import { PlayQueue } from './playqueue.ts';
import type { PlayQueueSource } from './playqueue.types.ts';
import type { PlexServer } from './server.ts';
import { parseOptionalNumber, parsePlexBoolean, serverAddressParams } from './util.ts';

/**
 * A single timeline entry reported by a Plex player.
 */
export class ClientTimeline {
  readonly state: string;
  readonly type: string;
  readonly address?: string;
  readonly audioStreamId?: number;
  readonly autoPlay?: boolean;
  readonly containerKey?: string;
  readonly controllable?: string;
  readonly duration?: number;
  readonly itemType?: string;
  readonly key?: string;
  readonly location?: string;
  readonly machineIdentifier?: string;
  readonly partCount?: number;
  readonly partIndex?: number;
  readonly playQueueID?: number;
  readonly playQueueItemID?: number;
  readonly playQueueVersion?: number;
  readonly port?: number;
  readonly protocol?: string;
  readonly providerIdentifier?: string;
  readonly ratingKey?: string;
  readonly repeat?: number;
  readonly seekRange?: string;
  readonly shuffle?: boolean;
  readonly subtitleColor?: string;
  readonly subtitlePosition?: string;
  readonly subtitleSize?: number;
  readonly time?: number;
  readonly volume?: number;

  constructor(data: ClientTimelineData) {
    this.state = data.state;
    this.type = data.type;
    this.address = data.address;
    this.audioStreamId = parseOptionalNumber(data.audioStreamId);
    this.autoPlay = data.autoPlay === undefined ? undefined : parsePlexBoolean(data.autoPlay);
    this.containerKey = data.containerKey;
    this.controllable = data.controllable;
    this.duration = parseOptionalNumber(data.duration);
    this.itemType = data.itemType;
    this.key = data.key;
    this.location = data.location;
    this.machineIdentifier = data.machineIdentifier;
    this.partCount = parseOptionalNumber(data.partCount);
    this.partIndex = parseOptionalNumber(data.partIndex);
    this.playQueueID = parseOptionalNumber(data.playQueueID);
    this.playQueueItemID = parseOptionalNumber(data.playQueueItemID);
    this.playQueueVersion = parseOptionalNumber(data.playQueueVersion);
    this.port = parseOptionalNumber(data.port);
    this.protocol = data.protocol;
    this.providerIdentifier = data.providerIdentifier;
    this.ratingKey = data.ratingKey;
    this.repeat = parseOptionalNumber(data.repeat);
    this.seekRange = data.seekRange;
    this.shuffle = data.shuffle === undefined ? undefined : parsePlexBoolean(data.shuffle);
    this.subtitleColor = data.subtitleColor;
    this.subtitlePosition = data.subtitlePosition;
    this.subtitleSize = parseOptionalNumber(data.subtitleSize);
    this.time = parseOptionalNumber(data.time);
    this.volume = parseOptionalNumber(data.volume);
  }
}

type PlayableMedia = Playable | Playlist | PlayQueue;

interface PlayerContainer {
  MediaContainer?: { Player?: Partial<Player> | Array<Partial<Player>> };
}

interface TimelineContainer {
  MediaContainer?: { Timeline?: ClientTimelineData[] };
}

/**
 * Control a Plex player directly or by proxying commands through a Plex server.
 *
 * See https://github.com/plexinc/plex-media-player/wiki/Remote-control-API for the
 * remote-control commands players understand.
 */
export class PlexClient {
  readonly key = '/resources';
  /** HTTP address of the client, without a trailing slash. */
  readonly baseurl: string;
  /** Request timeout in milliseconds. */
  timeout: number;
  /** Server this client was found on, used for proxying commands. */
  server?: PlexServer;

  declare address?: string;
  /** Best guess on the type of device (PS4, iPhone, Linux). */
  declare device?: string;
  /** Device class (pc, phone, stb). */
  declare deviceClass?: string;
  declare local?: boolean;
  declare machineIdentifier?: string;
  declare model?: string;
  declare platform?: string;
  declare platformVersion?: string;
  /** Product name (Plex for iOS, Plex Web). */
  declare product?: string;
  declare profile?: string;
  declare protocol?: string;
  /** Controllers the client supports (navigation, playback, timeline, mirror, playqueues). */
  declare protocolCapabilities: string[];
  declare protocolVersion?: string;
  declare relayed?: boolean;
  declare remotePublicAddress?: string;
  declare secure?: boolean;
  declare state?: string;
  /** Display name of the client (Johns iPhone). */
  declare title?: string;
  declare userID?: number;
  declare vendor?: string;
  declare version?: string;

  readonly #identifier?: string;
  readonly #token?: string;
  #commandId = 0;
  #proxyThroughServer = false;

  constructor({ server, data, baseurl, identifier, token, timeout }: PlexClientOptions = {}) {
    this.baseurl = (baseurl ?? 'http://localhost:32400').replace(/\/+$/, '');
    this.server = server;
    this.timeout = timeout ?? TIMEOUT;
    this.#identifier = identifier;
    this.#token = token;
    this.protocolCapabilities = [];
    if (data) {
      this._loadData(data);
    }
  }

  /** True when commands are sent through {@link PlexClient.server} instead of the client. */
  get isProxied(): boolean {
    return this.#proxyThroughServer;
  }

  /**
   * Load attributes directly from the client. Later commands go straight to the device
   * even if this object was first populated from a server's client list.
   */
  async connect(): Promise<this> {
    const data = await this.query<PlayerContainer | undefined>({ path: this.key });
    const players = [data?.MediaContainer?.Player ?? []].flat();
    const player = this.#identifier
      ? players.find(candidate => candidate.machineIdentifier === this.#identifier)
      : players[0];
    if (!player) {
      throw new NotFound(
        this.#identifier
          ? `Client ${this.#identifier} not found at ${this.baseurl}`
          : `Client not found at ${this.baseurl}`,
      );
    }

    this._loadData(player);
    return this;
  }

  /** Alias for {@link PlexClient.connect}. */
  async reload(): Promise<this> {
    return this.connect();
  }

  /**
   * Send a request to the client. Players answer in JSON, XML, or plain text depending on
   * the product, so XML is converted to the same shape as Plex JSON responses.
   */
  async query<T = unknown>({ path, method = 'get', headers }: PlexClientQueryOptions): Promise<T> {
    const body = await ofetch<string, 'text'>(this.url(path).toString(), {
      method,
      timeout: this.timeout,
      headers: this.#headers(headers),
      responseType: 'text',
      retry: 0,
    });
    return (await parseClientResponse(body)) as T;
  }

  /** Build a URL for this client, optionally including its token. */
  url(key: string, { includeToken = false }: { includeToken?: boolean } = {}): URL {
    const url = new URL(key, this.baseurl);
    if (this.#token && includeToken) {
      url.searchParams.set('X-Plex-Token', this.#token);
    }

    return url;
  }

  /**
   * Send future commands through the Plex server instead of directly to the client.
   * Useful when the client is not reachable from this machine.
   */
  proxyThroughServer({ enabled = true, server }: ProxyThroughServerOptions = {}): this {
    if (server) {
      this.server = server;
    }

    if (enabled && !this.server) {
      throw new BadRequest('A PlexServer is required to proxy client commands.');
    }

    this.#proxyThroughServer = enabled;
    return this;
  }

  /**
   * Send a remote-control command such as `playback/play` to the client.
   * @param command Command in the form `<controller>/<command>`.
   */
  async sendCommand(
    command: string,
    params: SendCommandParams = {},
    { proxy = this.#proxyThroughServer }: SendCommandOptions = {},
  ): Promise<unknown> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        search.set(key, value.toString());
      }
    }
    search.set('commandID', this.#nextCommandId().toString());

    const path = `/player/${command.replaceAll(/^\/+|\/+$/g, '')}?${search.toString()}`;
    const headers: Record<string, string> = this.machineIdentifier
      ? { 'X-Plex-Target-Client-Identifier': this.machineIdentifier }
      : {};

    if (proxy) {
      if (!this.server) {
        throw new BadRequest('A PlexServer is required to proxy client commands.');
      }

      // The server forwards the player's body as is, so XML and plain text arrive as strings.
      const response = await this.server.query<unknown>({ path, headers });
      return typeof response === 'string' ? parseClientResponse(response) : response;
    }

    return this.query({ path, headers });
  }

  // --------------- Navigation Commands ---------------

  /** Open the context menu on the client. */
  async contextMenu(): Promise<void> {
    await this.sendCommand('navigation/contextMenu');
  }

  /** Navigate back on the client. */
  async goBack(): Promise<void> {
    await this.sendCommand('navigation/back');
  }

  /** Navigate to home on the client. */
  async goToHome(): Promise<void> {
    await this.sendCommand('navigation/home');
  }

  /** Navigate to music on the client. */
  async goToMusic(): Promise<void> {
    await this.sendCommand('navigation/music');
  }

  /** Move selection down. */
  async moveDown(): Promise<void> {
    await this.sendCommand('navigation/moveDown');
  }

  /** Move selection left. */
  async moveLeft(): Promise<void> {
    await this.sendCommand('navigation/moveLeft');
  }

  /** Move selection right. */
  async moveRight(): Promise<void> {
    await this.sendCommand('navigation/moveRight');
  }

  /** Move selection up. */
  async moveUp(): Promise<void> {
    await this.sendCommand('navigation/moveUp');
  }

  /** Jump to next letter in lists. */
  async nextLetter(): Promise<void> {
    await this.sendCommand('navigation/nextLetter');
  }

  /** Page down in lists. */
  async pageDown(): Promise<void> {
    await this.sendCommand('navigation/pageDown');
  }

  /** Page up in lists. */
  async pageUp(): Promise<void> {
    await this.sendCommand('navigation/pageUp');
  }

  /** Jump to previous letter in lists. */
  async previousLetter(): Promise<void> {
    await this.sendCommand('navigation/previousLetter');
  }

  /** Select the current item. */
  async select(): Promise<void> {
    await this.sendCommand('navigation/select');
  }

  /** Toggle the on-screen display. */
  async toggleOSD(): Promise<void> {
    await this.sendCommand('navigation/toggleOSD');
  }

  /** Show the details page for a media item on the client. */
  async goToMedia(
    media: { key: string; server: PlexServer },
    params: SendCommandParams = {},
  ): Promise<void> {
    const token = await media.server.createToken();
    await this.sendCommand('mirror/details', {
      ...serverAddressParams(media.server),
      machineIdentifier: media.server.machineIdentifier,
      key: media.key,
      ...params,
      ...(token ? { token } : {}),
    });
  }

  // --------------- Playback Commands ---------------

  /** Start or resume playback. */
  async play({ type }: ClientCommandOptions = {}): Promise<void> {
    await this.sendCommand('playback/play', { type });
  }

  /** Pause playback. */
  async pause({ type }: ClientCommandOptions = {}): Promise<void> {
    await this.sendCommand('playback/pause', { type });
  }

  /** Stop playback. */
  async stop({ type }: ClientCommandOptions = {}): Promise<void> {
    await this.sendCommand('playback/stop', { type });
  }

  /**
   * Seek to a position in the current item.
   * @param offset Position in milliseconds.
   */
  async seekTo(offset: number, { type }: ClientCommandOptions = {}): Promise<void> {
    await this.sendCommand('playback/seekTo', { offset, type });
  }

  /** Skip to the next item. */
  async skipNext({ type }: ClientCommandOptions = {}): Promise<void> {
    await this.sendCommand('playback/skipNext', { type });
  }

  /** Skip to the previous item. */
  async skipPrevious({ type }: ClientCommandOptions = {}): Promise<void> {
    await this.sendCommand('playback/skipPrevious', { type });
  }

  /**
   * Skip to an item in the current play queue.
   * @param key Key of the item to play.
   */
  async skipTo(key: string, { type }: ClientCommandOptions = {}): Promise<void> {
    await this.sendCommand('playback/skipTo', { key, type });
  }

  /** Step back a few seconds. */
  async stepBack({ type }: ClientCommandOptions = {}): Promise<void> {
    await this.sendCommand('playback/stepBack', { type });
  }

  /** Step forward a few seconds. */
  async stepForward({ type }: ClientCommandOptions = {}): Promise<void> {
    await this.sendCommand('playback/stepForward', { type });
  }

  /** Set the repeat mode. */
  async setRepeat(repeat: ClientRepeatMode, options: ClientCommandOptions = {}): Promise<void> {
    await this.setParameters({ repeat, ...options });
  }

  /** Turn shuffle on or off. */
  async setShuffle(shuffle: boolean, options: ClientCommandOptions = {}): Promise<void> {
    await this.setParameters({ shuffle, ...options });
  }

  /**
   * Set the volume.
   * @param volume Volume level from 0 to 100.
   */
  async setVolume(volume: number, options: ClientCommandOptions = {}): Promise<void> {
    await this.setParameters({ volume, ...options });
  }

  /** Set several playback parameters at once. */
  async setParameters({ volume, shuffle, repeat, type }: SetParametersOptions): Promise<void> {
    await this.sendCommand('playback/setParameters', {
      volume,
      shuffle: shuffle === undefined ? undefined : Number(shuffle),
      repeat,
      type,
    });
  }

  /** Set the active audio, subtitle, or video stream. */
  async setStreams({
    audioStreamID,
    subtitleStreamID,
    videoStreamID,
    type,
  }: SetStreamsOptions): Promise<void> {
    await this.sendCommand('playback/setStreams', {
      audioStreamID,
      subtitleStreamID,
      videoStreamID,
      type,
    });
  }

  /** Set the active audio stream. */
  async setAudioStream(audioStreamID: number, options: ClientCommandOptions = {}): Promise<void> {
    await this.setStreams({ audioStreamID, ...options });
  }

  /**
   * Set the active subtitle stream.
   * @param subtitleStreamID Subtitle stream id, or 0 to disable subtitles.
   */
  async setSubtitleStream(
    subtitleStreamID: number,
    options: ClientCommandOptions = {},
  ): Promise<void> {
    await this.setStreams({ subtitleStreamID, ...options });
  }

  /** Set the active video stream. */
  async setVideoStream(videoStreamID: number, options: ClientCommandOptions = {}): Promise<void> {
    await this.setStreams({ videoStreamID, ...options });
  }

  /** Ask the client to reload a play queue after it changed on the server. */
  async refreshPlayQueue(
    playQueue: PlayQueue | number,
    { type = 'video' }: ClientCommandOptions = {},
  ): Promise<void> {
    const playQueueID = typeof playQueue === 'number' ? playQueue : playQueue.playQueueID;
    await this.sendCommand('playback/refreshPlayQueue', { playQueueID, type });
  }

  /** Create a play queue on the client and start playing it. Preferred over playMedia. */
  async createPlayQueue(
    items: PlayQueueSource,
    { offset = 0, paused = false, ...playQueueOptions }: CreateClientPlayQueueOptions = {},
  ): Promise<void> {
    const server = [items].flat()[0]?.server;
    if (!server) {
      throw new BadRequest('Cannot create a client play queue without items.');
    }

    const args = await PlayQueue.createArgs(server, items, playQueueOptions);
    await this.sendCommand('playback/createPlayQueue', {
      ...args,
      ...serverAddressParams(server),
      machineIdentifier: server.machineIdentifier,
      offset,
      paused: Number(paused),
      source: server.machineIdentifier,
    });
  }

  /**
   * Play a media item, playlist, or play queue on the client.
   * This is the legacy command; prefer {@link PlexClient.createPlayQueue} for modern players.
   */
  async playMedia(
    media: PlayableMedia,
    { offset = 0, params = {} }: PlayMediaOptions = {},
  ): Promise<void> {
    const { server } = media;
    const playQueue = media instanceof PlayQueue ? media : await PlayQueue.create(server, media);
    const key =
      media instanceof PlayQueue
        ? (playQueue.selectedItem?.key ?? playQueue.items[0]?.key)
        : (media as { key?: string }).key;
    const token = await server.createToken();
    await this.sendCommand('playback/playMedia', {
      providerIdentifier: 'com.plexapp.plugins.library',
      machineIdentifier: server.machineIdentifier,
      ...serverAddressParams(server),
      offset,
      key,
      type: clientMediaType(media),
      containerKey: `/playQueues/${playQueue.playQueueID}?window=100&own=1`,
      ...params,
      ...(token ? { token } : {}),
    });
  }

  // --------------- Timeline Commands ---------------

  /** Poll the client for what it is currently playing. */
  async timelines({ wait = 0 }: TimelinesOptions = {}): Promise<ClientTimeline[]> {
    const data = (await this.sendCommand('timeline/poll', { wait })) as
      | TimelineContainer
      | undefined;
    return (data?.MediaContainer?.Timeline ?? []).map(entry => new ClientTimeline(entry));
  }

  /** Returns the active (non-stopped) timeline, or undefined if nothing is playing. */
  async timeline(): Promise<ClientTimeline | undefined> {
    return (await this.timelines()).find(timeline => timeline.state !== 'stopped');
  }

  /** Returns true if the client is playing media. */
  async isPlayingMedia({ includePaused = true }: IsPlayingMediaOptions = {}): Promise<boolean> {
    const state = (await this.timeline())?.state;
    return state === 'playing' || (includePaused && state === 'paused');
  }

  protected _loadData(data: Partial<Player>): void {
    this.address = data.address;
    this.device = data.device;
    this.deviceClass = data.deviceClass;
    this.local = data.local === undefined ? undefined : parsePlexBoolean(data.local);
    this.machineIdentifier = data.machineIdentifier;
    this.model = data.model;
    this.platform = data.platform;
    this.platformVersion = data.platformVersion;
    this.product = data.product;
    this.profile = data.profile;
    this.protocol = data.protocol;
    this.protocolCapabilities = data.protocolCapabilities?.split(',').filter(Boolean) ?? [];
    this.protocolVersion = data.protocolVersion;
    this.relayed = data.relayed === undefined ? undefined : parsePlexBoolean(data.relayed);
    this.remotePublicAddress = data.remotePublicAddress;
    this.secure = data.secure === undefined ? undefined : parsePlexBoolean(data.secure);
    this.state = data.state;
    this.title = data.title ?? data.name;
    this.userID = parseOptionalNumber(data.userID);
    this.vendor = data.vendor;
    this.version = data.version;
  }

  #nextCommandId(): number {
    this.#commandId += 1;
    return this.#commandId;
  }

  #headers(headers: Record<string, string> = {}): Record<string, string> {
    return {
      ...BASE_HEADERS,
      ...headers,
      accept: 'application/json',
      ...(this.#token ? { 'X-Plex-Token': this.#token } : {}),
    };
  }
}

function clientMediaType(media: PlayableMedia): ClientMediaType {
  const item = media instanceof PlayQueue ? media.items[0] : media;
  const type =
    item && 'playlistType' in item && typeof item.playlistType === 'string'
      ? item.playlistType
      : (item as { listType?: string } | undefined)?.listType;
  if (type === 'audio' || type === 'music') {
    return 'music';
  }

  if (type === 'photo') {
    return 'photo';
  }

  return 'video';
}

type XmlNode = { $?: Record<string, string> } & Record<string, unknown>;

/** Convert xml2js output into the attribute and child-array shape Plex uses for JSON. */
function normalizeXml(node: XmlNode): Record<string, unknown> {
  const result: Record<string, unknown> = { ...node.$ };
  for (const [key, value] of Object.entries(node)) {
    if (key !== '$' && Array.isArray(value)) {
      result[key] = value.map(child =>
        typeof child === 'object' && child !== null ? normalizeXml(child as XmlNode) : child,
      );
    }
  }

  return result;
}

async function parseClientResponse(body: string | undefined): Promise<unknown> {
  const text = body?.trim() ?? '';
  if (text === '') {
    return undefined;
  }

  if (text.startsWith('<')) {
    let xml: Record<string, XmlNode>;
    try {
      xml = (await parseStringPromise(text)) as Record<string, XmlNode>;
    } catch (error) {
      // Plex for Samsung answers successful commands with an unclosed `<Response code="200">`.
      if (/^(?:<\?xml[^>]*>\s*)?<Response\b[^>]*\bcode="200"/.test(text)) {
        return text;
      }
      throw error;
    }

    return Object.fromEntries(
      Object.entries(xml).map(([key, value]) => [key, normalizeXml(value)]),
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    // Some players (Plexamp, Plex for Android) answer successful commands with plain `OK`.
    return text;
  }
}
