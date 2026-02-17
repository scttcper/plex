import { URL, URLSearchParams } from 'node:url';

import { ofetch } from 'ofetch';

import type {
  ClientTimelineData,
  Player,
  PlayMediaOptions,
  SendCommandParams,
  SetParametersOptions,
  SetStreamsOptions,
} from './client.types.js';
import { BASE_HEADERS, TIMEOUT } from './config.js';
import type { PlexServer } from './server.js';
import type { MediaContainer } from './util.js';

export interface PlexOptions {
  /** (:class:`~plexapi.server.PlexServer`): PlexServer this client is connected to (optional). */
  server?: PlexServer;
  /** (ElementTree): Response from PlexServer used to build this object (optional). */
  data?: any;
  /** (str): Path used to generate data. */
  initpath?: string;
  /** (str): HTTP URL to connect dirrectly to this client. */
  baseurl?: string;
  /** (str): X-Plex-Token used for authenication (optional). */
  token?: string;
  /** (:class:`~requests.Session`): requests.Session object if you want more control (optional). */
  session?: string;
  /** (int): timeout in seconds on initial connect to client (default config.TIMEOUT). */
  timeout?: number;
}

/**
 * Represents a single timeline entry from a Plex client.
 */
export class ClientTimeline {
  declare state: string;
  declare type: string;
  declare time: number;
  declare duration: number;
  declare seekRange: string;
  declare key: string;
  declare ratingKey: string;
  declare volume: number;
  declare shuffle: boolean;
  declare repeat: number;
  declare playQueueID: number;
  declare playQueueItemID: number;
  declare controllable: string;
  declare machineIdentifier: string;
  declare providerIdentifier: string;
  declare containerKey: string;
  declare address: string;
  declare port: number;
  declare protocol: string;

  constructor(data: ClientTimelineData) {
    this.state = data.state;
    this.type = data.type;
    this.time = data.time ?? 0;
    this.duration = data.duration ?? 0;
    this.seekRange = data.seekRange ?? '';
    this.key = data.key ?? '';
    this.ratingKey = data.ratingKey ?? '';
    this.volume = data.volume ?? 0;
    this.shuffle = data.shuffle ?? false;
    this.repeat = data.repeat ?? 0;
    this.playQueueID = data.playQueueID ?? 0;
    this.playQueueItemID = data.playQueueItemID ?? 0;
    this.controllable = data.controllable ?? '';
    this.machineIdentifier = data.machineIdentifier ?? '';
    this.providerIdentifier = data.providerIdentifier ?? '';
    this.containerKey = data.containerKey ?? '';
    this.address = data.address ?? '';
    this.port = data.port ?? 0;
    this.protocol = data.protocol ?? '';
  }
}

/**
 * Main class for interacting with a Plex client. This class can connect
 * directly to the client and control it or proxy commands through your
 * Plex Server. To better understand the Plex client API's read this page:
 * https://github.com/plexinc/plex-media-player/wiki/Remote-control-API
 * Attributes:
 *     TAG (str): 'Player'
 *     key (str): '/resources'
 *     device (str): Best guess on the type of device this is (PS, iPhone, Linux, etc).
 *     deviceClass (str): Device class (pc, phone, etc).
 *     machineIdentifier (str): Unique ID for this device.
 *     model (str): Unknown
 *     platform (str): Unknown
 *     platformVersion (str): Description
 *     product (str): Client Product (Plex for iOS, etc).
 *     protocol (str): Always seems ot be 'plex'.
 *     protocolCapabilities (list<str>): List of client capabilities (navigation, playback,
 *         timeline, mirror, playqueues).
 *     protocolVersion (str): Protocol version (1, future proofing?)
 *     server (:class:`~plexapi.server.PlexServer`): Server this client is connected to.
 *     session (:class:`~requests.Session`): Session object used for connection.
 *     state (str): Unknown
 *     title (str): Name of this client (Johns iPhone, etc).
 *     token (str): X-Plex-Token used for authenication
 *     vendor (str): Unknown
 *     version (str): Device version (4.6.1, etc).
 *     _session (obj): Requests session object used to access this client.
 *     _proxyThroughServer (bool): Set to True after calling
 *         :func:`~plexapi.client.PlexClient.proxyThroughServer()` (default False).
 */
export class PlexClient {
  /**
   * HTTP address of the client
   */
  _baseurl: string | null = null;
  /**
   * Token used to access this client
   */
  _token: string | null = null;
  TAG = 'Player';
  key = '/resources';

  timeout: number;

  declare deviceClass?: string;
  declare machineIdentifier?: string;
  declare product?: string;
  declare protocol?: string;
  declare protocolCapabilities?: string[];
  declare protocolVersion?: string;
  declare platform?: string;
  declare platformVersion?: string;
  declare title?: string;

  _server: PlexServer | null = null;
  _proxyThroughServer = false;
  private _commandId = 0;

  constructor(options: PlexOptions = {}) {
    if (options.baseurl) {
      if (options.baseurl.endsWith('/')) {
        this._baseurl = options.baseurl.slice(0, -1);
      } else {
        this._baseurl = options.baseurl;
      }
    }

    this._baseurl = options.baseurl ?? 'http://localhost:32400';
    this._token = options.token ?? null;
    this._server = options.server ?? null;
    this.timeout = options.timeout ?? TIMEOUT;
  }

  /**
   * Alias of reload as any subsequent requests to this client will be
   * made directly to the device even if the object attributes were initially
   * populated from a PlexServer.
   * @param timeout
   */
  async connect(): Promise<void> {
    const data = await this.query<MediaContainer<{ Player: Player }>>(this.key);
    this._loadData(data.MediaContainer.Player);
  }

  /**
   * @alias PlexClient.connect
   */
  async reload() {
    return this.connect();
  }

  /**
   * Main method used to handle HTTPS requests to the Plex client. This method helps
   * by encoding the response to utf-8 and parsing the returned XML into and
   * ElementTree object. Returns None if no data exists in the response.
   * TODO: use headers
   * @param path
   * @param method
   * @param headers
   * @param timeout
   */
  async query<T>(
    path: string,
    method: 'get' | 'post' | 'put' | 'patch' | 'head' | 'delete' = 'get',
    headers?: Record<string, string>,
  ): Promise<T> {
    const headersObj = this._headers(headers);
    const response = await ofetch<T>(this.url(path).toString(), {
      method,
      timeout: this.timeout ?? TIMEOUT,
      headers: headersObj,
      responseType: 'json',
      retry: 0,
    });

    return response;
  }

  /**
   * Build a URL string with proper token argument. Token will be appended to the URL
   * if either includeToken is True or TODO: CONFIG.log.show_secrets is 'true'.
   * @param key
   * @param options
   */
  url(key: string, { includeToken = false }: { includeToken?: boolean } = {}): URL {
    if (!this._baseurl) {
      throw new Error('PlexClient object missing baseurl.');
    }

    const url = new URL(key, this._baseurl);
    if (this._token && includeToken) {
      const searchParams = new URLSearchParams();
      searchParams.append('X-Plex-Token', this._token);
      url.search = searchParams.toString();
      return url;
    }

    return url;
  }

  // --------------- Proxy Support ---------------

  /**
   * Toggle or set proxy-through-server mode. When enabled, commands are sent
   * through the Plex server rather than directly to the client.
   * @param value Enable or disable proxy mode. If omitted, toggles current state.
   * @param server The PlexServer to proxy through. Required if not already set.
   */
  proxyThroughServer(value?: boolean, server?: PlexServer): void {
    if (server) {
      this._server = server;
    }

    if (value !== undefined) {
      this._proxyThroughServer = value;
    } else {
      this._proxyThroughServer = !this._proxyThroughServer;
    }

    if (this._proxyThroughServer && !this._server) {
      throw new Error('PlexServer is required for proxy mode. Pass server or set _server.');
    }
  }

  // --------------- Send Command ---------------

  /**
   * Send a command to the client, either directly or via the server proxy.
   * @param command The player command path (e.g. 'playback/play').
   * @param params Additional parameters for the command.
   */
  async sendCommand(command: string, params: SendCommandParams = {}): Promise<any> {
    const commandId = this._nextCommandId();
    const allParams: Record<string, string> = {
      commandID: commandId.toString(),
    };
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) {
        allParams[k] = v.toString();
      }
    }

    const search = new URLSearchParams(allParams).toString();
    const path = `/player/${command}${search ? `?${search}` : ''}`;

    if (this._proxyThroughServer && this._server) {
      const proxyHeaders: Record<string, string> = {};
      if (this.machineIdentifier) {
        proxyHeaders['X-Plex-Target-Client-Identifier'] = this.machineIdentifier;
      }

      return this._server.query({ path, headers: proxyHeaders });
    }

    return this.query(path, 'get');
  }

  // --------------- Navigation Commands ---------------

  /** Open the context menu on the client. */
  async contextMenu(): Promise<any> {
    return this.sendCommand('navigation/contextMenu');
  }

  /** Navigate back on the client. */
  async goBack(): Promise<any> {
    return this.sendCommand('navigation/back');
  }

  /** Navigate to home on the client. */
  async goToHome(): Promise<any> {
    return this.sendCommand('navigation/home');
  }

  /** Navigate to music on the client. */
  async goToMusic(): Promise<any> {
    return this.sendCommand('navigation/music');
  }

  /** Move selection down. */
  async moveDown(): Promise<any> {
    return this.sendCommand('navigation/moveDown');
  }

  /** Move selection left. */
  async moveLeft(): Promise<any> {
    return this.sendCommand('navigation/moveLeft');
  }

  /** Move selection right. */
  async moveRight(): Promise<any> {
    return this.sendCommand('navigation/moveRight');
  }

  /** Move selection up. */
  async moveUp(): Promise<any> {
    return this.sendCommand('navigation/moveUp');
  }

  /** Jump to next letter in lists. */
  async nextLetter(): Promise<any> {
    return this.sendCommand('navigation/nextLetter');
  }

  /** Page down in lists. */
  async pageDown(): Promise<any> {
    return this.sendCommand('navigation/pageDown');
  }

  /** Page up in lists. */
  async pageUp(): Promise<any> {
    return this.sendCommand('navigation/pageUp');
  }

  /** Jump to previous letter in lists. */
  async previousLetter(): Promise<any> {
    return this.sendCommand('navigation/previousLetter');
  }

  /** Select the current item. */
  async select(): Promise<any> {
    return this.sendCommand('navigation/select');
  }

  /** Toggle the on-screen display. */
  async toggleOSD(): Promise<any> {
    return this.sendCommand('navigation/toggleOSD');
  }

  // --------------- Playback Commands ---------------

  /**
   * Start or resume playback.
   * @param mtype Media type filter (video, music, photo).
   */
  async play(mtype?: string): Promise<any> {
    const params: SendCommandParams = {};
    if (mtype) {
      params.type = mtype;
    }

    return this.sendCommand('playback/play', params);
  }

  /**
   * Pause playback.
   * @param mtype Media type filter (video, music, photo).
   */
  async pause(mtype?: string): Promise<any> {
    const params: SendCommandParams = {};
    if (mtype) {
      params.type = mtype;
    }

    return this.sendCommand('playback/pause', params);
  }

  /**
   * Stop playback.
   * @param mtype Media type filter (video, music, photo).
   */
  async stop(mtype?: string): Promise<any> {
    const params: SendCommandParams = {};
    if (mtype) {
      params.type = mtype;
    }

    return this.sendCommand('playback/stop', params);
  }

  /**
   * Seek to the specified offset in milliseconds.
   * @param offset Position in milliseconds.
   * @param mtype Media type filter (video, music, photo).
   */
  async seekTo(offset: number, mtype?: string): Promise<any> {
    const params: SendCommandParams = { offset };
    if (mtype) {
      params.type = mtype;
    }

    return this.sendCommand('playback/seekTo', params);
  }

  /**
   * Skip to the next item.
   * @param mtype Media type filter (video, music, photo).
   */
  async skipNext(mtype?: string): Promise<any> {
    const params: SendCommandParams = {};
    if (mtype) {
      params.type = mtype;
    }

    return this.sendCommand('playback/skipNext', params);
  }

  /**
   * Skip to the previous item.
   * @param mtype Media type filter (video, music, photo).
   */
  async skipPrevious(mtype?: string): Promise<any> {
    const params: SendCommandParams = {};
    if (mtype) {
      params.type = mtype;
    }

    return this.sendCommand('playback/skipPrevious', params);
  }

  /**
   * Skip to a specific item by key.
   * @param key The key of the item to skip to.
   * @param mtype Media type filter (video, music, photo).
   */
  async skipTo(key: string, mtype?: string): Promise<any> {
    const params: SendCommandParams = { key };
    if (mtype) {
      params.type = mtype;
    }

    return this.sendCommand('playback/skipTo', params);
  }

  /**
   * Step back (small rewind).
   * @param mtype Media type filter (video, music, photo).
   */
  async stepBack(mtype?: string): Promise<any> {
    const params: SendCommandParams = {};
    if (mtype) {
      params.type = mtype;
    }

    return this.sendCommand('playback/stepBack', params);
  }

  /**
   * Step forward (small fast-forward).
   * @param mtype Media type filter (video, music, photo).
   */
  async stepForward(mtype?: string): Promise<any> {
    const params: SendCommandParams = {};
    if (mtype) {
      params.type = mtype;
    }

    return this.sendCommand('playback/stepForward', params);
  }

  /**
   * Set repeat mode.
   * @param repeat Repeat mode (0=off, 1=repeat one, 2=repeat all).
   * @param mtype Media type filter (video, music, photo).
   */
  async setRepeat(repeat: number, mtype?: string): Promise<any> {
    const params: SendCommandParams = { repeat };
    if (mtype) {
      params.type = mtype;
    }

    return this.sendCommand('playback/setParameters', params);
  }

  /**
   * Set shuffle mode.
   * @param shuffle Shuffle mode (0=off, 1=on).
   * @param mtype Media type filter (video, music, photo).
   */
  async setShuffle(shuffle: number, mtype?: string): Promise<any> {
    const params: SendCommandParams = { shuffle };
    if (mtype) {
      params.type = mtype;
    }

    return this.sendCommand('playback/setParameters', params);
  }

  /**
   * Set volume level.
   * @param volume Volume level (0-100).
   * @param mtype Media type filter (video, music, photo).
   */
  async setVolume(volume: number, mtype?: string): Promise<any> {
    const params: SendCommandParams = { volume };
    if (mtype) {
      params.type = mtype;
    }

    return this.sendCommand('playback/setParameters', params);
  }

  /**
   * Set multiple playback parameters at once.
   * @param options Parameters to set.
   */
  async setParameters(options: SetParametersOptions): Promise<any> {
    const params: SendCommandParams = {};
    if (options.volume !== undefined) {
      params.volume = options.volume;
    }

    if (options.shuffle !== undefined) {
      params.shuffle = typeof options.shuffle === 'boolean' ? (options.shuffle ? 1 : 0) : options.shuffle;
    }

    if (options.repeat !== undefined) {
      params.repeat = options.repeat;
    }

    if (options.mtype) {
      params.type = options.mtype;
    }

    return this.sendCommand('playback/setParameters', params);
  }

  /**
   * Set the active audio, subtitle, or video stream.
   * @param options Stream selection options.
   */
  async setStreams(options: SetStreamsOptions): Promise<any> {
    const params: SendCommandParams = {};
    if (options.audioStreamID !== undefined) {
      params.audioStreamID = options.audioStreamID;
    }

    if (options.subtitleStreamID !== undefined) {
      params.subtitleStreamID = options.subtitleStreamID;
    }

    if (options.videoStreamID !== undefined) {
      params.videoStreamID = options.videoStreamID;
    }

    if (options.mtype) {
      params.type = options.mtype;
    }

    return this.sendCommand('playback/setStreams', params);
  }

  /**
   * Set the active audio stream.
   * @param audioStreamID ID of the audio stream.
   * @param mtype Media type filter (video, music, photo).
   */
  async setAudioStream(audioStreamID: number, mtype?: string): Promise<any> {
    return this.setStreams({ audioStreamID, mtype });
  }

  /**
   * Set the active subtitle stream.
   * @param subtitleStreamID ID of the subtitle stream. Use 0 to disable subtitles.
   * @param mtype Media type filter (video, music, photo).
   */
  async setSubtitleStream(subtitleStreamID: number, mtype?: string): Promise<any> {
    return this.setStreams({ subtitleStreamID, mtype });
  }

  /**
   * Set the active video stream.
   * @param videoStreamID ID of the video stream.
   * @param mtype Media type filter (video, music, photo).
   */
  async setVideoStream(videoStreamID: number, mtype?: string): Promise<any> {
    return this.setStreams({ videoStreamID, mtype });
  }

  /**
   * Start playback of media using a play queue.
   * @param media A Playable media item with a playlistItemID or ratingKey.
   * @param options Playback options.
   */
  async playMedia(media: any, options: PlayMediaOptions = {}): Promise<any> {
    if (!this._server) {
      throw new Error('A PlexServer is required for playMedia.');
    }

    const { offset = 0, params: extraParams = {} } = options;
    const { PlayQueue } = await import('./playqueue.js');
    const playQueue = await PlayQueue.create(this._server, media);

    const commandParams: SendCommandParams = {
      providerIdentifier: 'com.plexapp.plugins.library',
      machineIdentifier: this._server.machineIdentifier,
      containerKey: `/playQueues/${playQueue.playQueueID}?window=100&own=1`,
      key: media.key,
      offset,
      ...extraParams,
    };

    return this.sendCommand('playback/playMedia', commandParams);
  }

  // --------------- Timeline Commands ---------------

  /**
   * Poll the client for timeline data (what is currently playing).
   * @param wait Time in seconds to wait for a response.
   */
  async timelines(wait?: number): Promise<ClientTimeline[]> {
    const params: SendCommandParams = {};
    if (wait !== undefined) {
      params.wait = wait;
    }

    const commandId = this._nextCommandId();
    params.commandID = commandId;

    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) {
        search.set(k, v.toString());
      }
    }

    const path = `/player/timeline/poll?${search.toString()}`;
    let data: any;

    if (this._proxyThroughServer && this._server) {
      const proxyHeaders: Record<string, string> = {};
      if (this.machineIdentifier) {
        proxyHeaders['X-Plex-Target-Client-Identifier'] = this.machineIdentifier;
      }

      data = await this._server.query({ path, headers: proxyHeaders });
    } else {
      data = await this.query(path);
    }

    const timelineEntries = data?.MediaContainer?.Timeline ?? data?.Timeline ?? [];
    return timelineEntries.map((entry: ClientTimelineData) => new ClientTimeline(entry));
  }

  /**
   * Returns the active (non-stopped) timeline, or undefined if nothing is playing.
   */
  async timeline(): Promise<ClientTimeline | undefined> {
    const tls = await this.timelines();
    return tls.find(tl => tl.state !== 'stopped');
  }

  /**
   * Returns true if the client is currently playing media.
   * @param includePaused If true, paused media counts as playing.
   */
  async isPlayingMedia(includePaused = false): Promise<boolean> {
    const tls = await this.timelines();
    for (const tl of tls) {
      if (tl.state === 'playing') {
        return true;
      }

      if (includePaused && tl.state === 'paused') {
        return true;
      }
    }

    return false;
  }

  protected _loadData(data: Player) {
    this.deviceClass = data.deviceClass;
    this.machineIdentifier = data.machineIdentifier;
    this.product = data.product;
    this.protocol = data.protocol;
    this.protocolCapabilities = data.protocolCapabilities.split(',');
    this.protocolVersion = data.protocolVersion;
    this.platform = data.platform;
    this.platformVersion = data.platformVersion;
    this.title = data.title;
  }

  private _nextCommandId(): number {
    this._commandId += 1;
    return this._commandId;
  }

  /**
   * Returns a dict of all default headers for Client requests.
   */
  private _headers(headers: Record<string, string> = {}) {
    const headersObj: Record<string, string> = {
      ...BASE_HEADERS,
      ...headers,
      accept: 'application/json',
    };
    if (this._token) {
      headersObj['X-Plex-Token'] = this._token;
    }

    return headersObj;
  }
}
