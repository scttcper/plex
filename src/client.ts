import { CookieJar } from 'tough-cookie';
import { TIMEOUT } from './config';
import got from 'got';
import { URL, URLSearchParams } from 'url';
import { parseStringPromise } from 'xml2js';

export interface PlexOptions {
  /** (:class:`~plexapi.server.PlexServer`): PlexServer this client is connected to (optional). */
  server?: any;
  /** (ElementTree): Response from PlexServer used to build this object (optional). */
  data?: string;
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
  /**
   * tough-cookie Session  of plex client
   */
  _session!: any;
  TAG = 'Player';
  key = '/resources';

  constructor(options: PlexOptions = {}) {
    if (options.baseurl) {
      if (options.baseurl.endsWith('/')) {
        this._baseurl = options.baseurl.slice(0, -1);
      } else {
        this._baseurl = options.baseurl;
      }
    }

    this._session = options.session ?? new CookieJar();
    this._baseurl = options.baseurl ?? 'http://localhost:32400';
  }

  /**
   * Alias of reload as any subsequent requests to this client will be made directly to the device even if the object attributes were initially populated from a PlexServer.
   */
  async connect(timeout?: number): Promise<void> {
    const data = await this.query(this.key, undefined, undefined, timeout);
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
  async query(
    path: string,
    method: 'get' | 'post' | 'put' | 'patch' | 'head' | 'delete' = 'get',
    headers?: any,
    timeout?: number,
  ): Promise<any> {
    const response = await got({
      method,
      url: this.url(path),
      timeout: timeout ?? TIMEOUT,
      retry: 0,
    });

    const xml = await parseStringPromise(response.body);
    return xml;
  }

  /**
   * Build a URL string with proper token argument. Token will be appended to the URL
   * if either includeToken is True or TODO: CONFIG.log.show_secrets is 'true'.
   * @param key
   * @param includeToken
   */
  url(key, includeToken = false): URL {
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
}
