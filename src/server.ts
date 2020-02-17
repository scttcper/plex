import got from 'got';
import { URL, URLSearchParams } from 'url';
import debug from 'debug';
import { CookieJar } from 'tough-cookie';

import { TIMEOUT, BASE_HEADERS } from './config';
import { ServerRootResponse } from './serverInterfaces';

const log = debug('plex');

export interface PlexServerData {
  /** True if server allows camera upload */
  allowCameraUpload: boolean;
  /** True if server allows channel access (iTunes?) */
  allowChannelAccess: boolean;
  /** True is server allows media to be deleted. */
  allowMediaDeletion: boolean;
  /** True is server allows sharing */
  allowSharing: boolean;
  /** True is server allows sync */
  allowSync: boolean;
  /** Unknown */
  allowTuners: boolean;
  /** Unknown */
  livetv: number;
  /** Unknown */
  backgroundProcessing: boolean;
  /** True if server has an HTTPS certificate */
  certificate: boolean;
  /** Unknown */
  companionProxy: boolean;
  /** Unknown */
  diagnostics: string;
  /** Unknown */
  eventStream: boolean;
  /** Human friendly name for this server */
  friendlyName: string;
  /**
   * True if `Hub Search <https://www.plex.tv/blog
   * /seek-plex-shall-find-leveling-web-app/>`_ is enabled. I believe this
   * is enabled for everyone
   */
  hubSearch: boolean;
  /** Unique ID for this server (looks like an md5) */
  machineIdentifier: string;
  /**
   * True if `multiusers <https://support.plex.tv/hc/en-us/articles/200250367-Multi-User-Support>`_ are enabled.
   */
  multiuser: boolean;
  /** Unknown (True if logged into myPlex?) */
  myPlex: boolean;
  /** Unknown (ex: mapped) */
  myPlexMappingState: string;
  /** Unknown (ex: ok). */
  myPlexSigninState: string;
  /** True if you have a myPlex subscription */
  myPlexSubscription: boolean;
  /** Email address if signed into myPlex (user@example.com) */
  myPlexUsername: string;
  /**
   * List of features allowed by the server owner. This may be based
   * on your PlexPass subscription. Features include: camera_upload, cloudsync,
   * content_filter, dvr, hardware_transcoding, home, lyrics, music_videos, pass,
   * photo_autotags, premium_music_metadata, session_bandwidth_restrictions, sync,
   * trailers, webhooks (and maybe more).
   */
  ownerFeatures: string[];
  /**
   * True if photo `auto-tagging <https://support.plex.tv/hc/en-us/articles/234976627-Auto-Tagging-of-Photos>`_ is enabled.
   */
  photoAutoTag: boolean;
  /** Platform the server is hosted on (ex: Linux) */
  platform: string;
  /** Platform version (ex: '6.1 (Build 7601)', '4.4.0-59-generic'). */
  platformVersion: string;
  /** Unknown */
  pluginHost: boolean;
  /** Unknown */
  readOnlyLibraries: boolean;
  /** Unknown */
  requestParametersInCookie: boolean;
  /**
   * Current `Streaming Brain <https://www.plex.tv/blog/mcstreamy-brain-take-world-two-easy-steps/>`_ version.
   */
  streamingBrainVersion: number;
  streamingBrainABRVersion: number;
  /**
   * True if `syncing to a device <https://support.plex.tv/hc/en-us/articles/201053678-Sync-Media-to-a-Device>`_ is enabled.
   */
  sync: boolean;
  /**
   * Number of active video transcoding sessions.
   */
  transcoderActiveVideoSessions: number;
  /** True if audio transcoding audio is available. */
  transcoderAudio: boolean;
  /** True if audio transcoding lyrics is available. */
  transcoderLyrics: boolean;
  /** True if audio transcoding photos is available. */
  transcoderPhoto: boolean;
  /** True if audio transcoding subtitles is available. */
  transcoderSubtitles: boolean;
  /** True if audio transcoding video is available. */
  transcoderVideo: boolean;
  /** List of video bitrates. */
  transcoderVideoBitrates: string;
  /** List of video qualities. */
  transcoderVideoQualities: string;
  /** List of video resolutions. */
  transcoderVideoResolutions: string;
  /** Datetime the server was updated. */
  updatedAt: number;
  /** Unknown */
  updater: boolean;
  /** Current Plex version (ex: 1.3.2.3112-1751929) */
  version: string;
  /** True if voice search is enabled. (is this Google Voice search?) */
  voiceSearch: boolean;
  /** Unknown */
  pushNotifications: boolean;
}

/**
 * This is the main entry point to interacting with a Plex server. It allows you to
 * list connected clients, browse your library sections and perform actions such as
 * emptying trash. If you do not know the auth token required to access your Plex
 * server, or simply want to access your server with your username and password, you
 * can also create an PlexServer instance from :class:`~plexapi.myplex.MyPlexAccount`.
 */
export class PlexServer {
  key = '/';
  data!: PlexServerData;

  constructor(
    public readonly baseurl,
    public readonly token,
    public readonly session = new CookieJar(),
    public readonly timeout,
  ) {}

  async connect(): Promise<PlexServer> {
    const data = await this.query<ServerRootResponse>(this.key, undefined, undefined, this.timeout);
    this._loadData(data);
    return this;
  }

  /**
   * Main method used to handle HTTPS requests to the Plex server. This method helps
   * by encoding the response to utf-8 and parsing the returned XML into and
   * ElementTree object. Returns None if no data exists in the response.
   * TODO: use headers
   * @param path
   * @param method
   * @param headers
   * @param timeout
   */
  async query<T = any>(
    path: string,
    method: 'get' | 'post' | 'put' | 'patch' | 'head' | 'delete' = 'get',
    headers?: any,
    timeout?: number,
    username?: string,
    password?: string,
  ): Promise<T> {
    const requestHeaders = this._headers();
    if (username && password) {
      const credentials = Buffer.from(`${username}:${password}`).toString('base64');
      requestHeaders.Authorization = `Basic ${credentials}`;
    }

    const url = this.url(path);
    console.log({ url });
    const response = await got({
      method,
      url,
      headers: requestHeaders,
      timeout: timeout ?? TIMEOUT,
      cookieJar: this.session,
      username,
      password,
      retry: 0,
    }).json<any>();

    return response;
  }

  /**
   * Build a URL string with proper token argument. Token will be appended to the URL
   * if either includeToken is True or TODO: CONFIG.log.show_secrets is 'true'.
   */
  private url(key, includeToken = false): URL {
    if (!this.baseurl) {
      throw new Error('PlexClient object missing baseurl.');
    }

    const url = new URL(key, this.baseurl);
    if (this.token && includeToken) {
      const searchParams = new URLSearchParams();
      searchParams.append('X-Plex-Token', this.token);
      url.search = searchParams.toString();
      return url;
    }

    return url;
  }

  private _headers(): Record<string, string> {
    const headers = { ...BASE_HEADERS };
    if (this.token) {
      headers['X-Plex-Token'] = this.token;
    }

    return headers;
  }

  private _loadData(data: ServerRootResponse): void {
    const rootData: PlexServerData = {
      allowCameraUpload: data.MediaContainer.allowCameraUpload,
      allowChannelAccess: data.MediaContainer.allowChannelAccess,
      allowMediaDeletion: data.MediaContainer.allowMediaDeletion,
      allowSharing: data.MediaContainer.allowSharing,
      allowSync: data.MediaContainer.allowSync,
      allowTuners: data.MediaContainer.allowTuners,
      livetv: data.MediaContainer.livetv,
      backgroundProcessing: data.MediaContainer.backgroundProcessing,
      certificate: data.MediaContainer.certificate,
      companionProxy: data.MediaContainer.companionProxy,
      diagnostics: data.MediaContainer.diagnostics,
      eventStream: data.MediaContainer.eventStream,
      friendlyName: data.MediaContainer.friendlyName,
      hubSearch: data.MediaContainer.hubSearch,
      machineIdentifier: data.MediaContainer.machineIdentifier,
      multiuser: data.MediaContainer.multiuser,
      myPlex: data.MediaContainer.myPlex,
      myPlexMappingState: data.MediaContainer.myPlexMappingState,
      myPlexSigninState: data.MediaContainer.myPlexSigninState,
      myPlexSubscription: data.MediaContainer.myPlexSubscription,
      myPlexUsername: data.MediaContainer.myPlexUsername,
      ownerFeatures: data.MediaContainer.ownerFeatures.split(','),
      photoAutoTag: data.MediaContainer.photoAutoTag,
      platform: data.MediaContainer.platform,
      platformVersion: data.MediaContainer.platformVersion,
      pluginHost: data.MediaContainer.pluginHost,
      pushNotifications: data.MediaContainer.pushNotifications,
      readOnlyLibraries: data.MediaContainer.readOnlyLibraries,
      requestParametersInCookie: data.MediaContainer.requestParametersInCookie,
      streamingBrainABRVersion: data.MediaContainer.streamingBrainABRVersion,
      streamingBrainVersion: data.MediaContainer.streamingBrainVersion,
      sync: data.MediaContainer.sync,
      transcoderActiveVideoSessions: data.MediaContainer.transcoderActiveVideoSessions,
      transcoderAudio: data.MediaContainer.transcoderAudio,
      transcoderLyrics: data.MediaContainer.transcoderLyrics,
      transcoderPhoto: data.MediaContainer.transcoderPhoto,
      transcoderSubtitles: data.MediaContainer.transcoderSubtitles,
      transcoderVideo: data.MediaContainer.transcoderVideo,
      transcoderVideoBitrates: data.MediaContainer.transcoderVideoBitrates,
      transcoderVideoQualities: data.MediaContainer.transcoderVideoQualities,
      transcoderVideoResolutions: data.MediaContainer.transcoderVideoResolutions,
      updatedAt: data.MediaContainer.updatedAt,
      updater: data.MediaContainer.updater,
      version: data.MediaContainer.version,
      voiceSearch: data.MediaContainer.voiceSearch,
    };
    this.data = rootData;
  }
}
