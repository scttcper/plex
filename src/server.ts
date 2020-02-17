import got from 'got';
import { URL, URLSearchParams } from 'url';
import debug from 'debug';
import { CookieJar } from 'tough-cookie';

import { TIMEOUT, BASE_HEADERS } from './config';

const log = debug('plex');

/**
 * This is the main entry point to interacting with a Plex server. It allows you to
 * list connected clients, browse your library sections and perform actions such as
 * emptying trash. If you do not know the auth token required to access your Plex
 * server, or simply want to access your server with your username and password, you
 * can also create an PlexServer instance from :class:`~plexapi.myplex.MyPlexAccount`.
 */
export class PlexServer {
  key = '/';
  data: any;

  constructor(
    public readonly baseurl,
    public readonly token,
    public readonly session = new CookieJar(),
    public readonly timeout,
  ) {}

  async connect(): Promise<PlexServer> {
    const data = await this.query(this.key, undefined, undefined, this.timeout);
    // TODO: load data
    this.data = data;
    return this;
  }

  /**
   * Build a URL string with proper token argument. Token will be appended to the URL
   * if either includeToken is True or TODO: CONFIG.log.show_secrets is 'true'.
   * @param key
   * @param includeToken
   */
  url(key, includeToken = false): URL {
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

  private _headers(): Record<string, string> {
    const headers = { ...BASE_HEADERS };
    if (this.token) {
      headers['X-Plex-Token'] = this.token;
    }

    return headers;
  }
}
