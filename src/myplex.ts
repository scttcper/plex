/* eslint-disable max-params */
import got from 'got';
import { URL } from 'url';
import { parseStringPromise } from 'xml2js';
import debug from 'debug';
import { CookieJar } from 'tough-cookie';

import { TIMEOUT, BASE_HEADERS } from './config';
import { UserResponse } from './myplexXml';

const log = debug('plex');

export interface MyPlexData {
  /** Your Plex account ID */
  id: string;
  /** Unknown */
  uuid: string;
  /**
   * auth token for user by plex
   */
  authenticationToken: string;
  /** Unknown */
  certificateVersion: number;
  /** Your account username */
  username: string;
  /** Unknown. - Looks like an alias for `username` */
  title: string;
  /** Your current Plex email address */
  email: string;
  /** URL of your account thumbnail */
  thumb: string;
  /** Unknown */
  guest: boolean;
  /** Unknown */
  home: boolean;
  /** Unknown */
  homeSize: number;
  /** Unknown */
  maxHomeSize: number;
  /** Your Plex locale */
  locale: string;
  /** Your current mailing list status. */
  mailingListStatus: 'active' | 'Inactive';
  mailingListActive: boolean;
  /** Email address to add items to your `Watch Later` queue. */
  queueEmail: string;
  /** Unknown */
  restricted: boolean;
  /** Description */
  scrobbleTypes: string;
  /** Name of subscription plan */
  subscriptionPlan: string;
  /** String representation of `subscriptionActive` */
  subscriptionStatus: 'active' | 'Inactive';
  /** True if your subsctiption is active */
  subscriptionActive: boolean;
  /** List of features allowed on your subscription */
  subscriptionFeatures: string[];
  /** List of devices your allowed to use with this account */
  entitlements: string[];
}

/**
 * MyPlex account and profile information. This object represents the data found Account on
 * the myplex.tv servers at the url https://plex.tv/users/account. You may create this object
 * directly by passing in your username & password (or token). There is also a convenience
 * method provided at :class:`~plexapi.server.PlexServer.myPlexAccount()` which will create
 * and return this object.
 */
export class MyPlexAccount {
  FRIENDINVITE = 'https://plex.tv/api/servers/{machineId}/shared_servers'; // post with data
  HOMEUSERCREATE = 'https://plex.tv/api/home/users?title={title}'; // post with data
  EXISTINGUSER = 'https://plex.tv/api/home/users?invitedEmail={username}'; // post with data
  FRIENDSERVERS = 'https://plex.tv/api/servers/{machineId}/shared_servers/{serverId}'; // put with data
  PLEXSERVERS = 'https://plex.tv/api/servers/{machineId}'; // get
  FRIENDUPDATE = 'https://plex.tv/api/friends/{userId}'; // put with args, delete
  REMOVEHOMEUSER = 'https://plex.tv/api/home/users/{userId}'; // delete
  REMOVEINVITE = 'https://plex.tv/api/invites/requested/{userId}?friend=0&server=1&home=0'; // delete
  REQUESTED = 'https://plex.tv/api/invites/requested'; // get
  REQUESTS = 'https://plex.tv/api/invites/requests'; // get
  SIGNIN = 'https://plex.tv/users/sign_in.xml'; // get with auth
  WEBHOOKS = 'https://plex.tv/api/v2/user/webhooks'; // get, post with data

  key = 'https://plex.tv/api/v2/user';

  data?: MyPlexData;

  private _token: string;

  /**
   *
   * @param username Your MyPlex username
   * @param password Your MyPlex password
   * @param token Token used to access this client.
   * @param session Use your own session object if you want to cache the http responses from PMS
   * @param timeout timeout in seconds on initial connect to myplex
   */
  constructor(
    private readonly username?: string,
    private readonly password?: string,
    readonly token?: any,
    private readonly session = new CookieJar(),
    private readonly timeout = TIMEOUT,
  ) {
    this._token = token;
  }

  /**
   * Returns a new :class:`~server.PlexServer` or :class:`~client.PlexClient` object.
   * Often times there is more than one address specified for a server or client.
   * This function will prioritize local connections before remote and HTTPS before HTTP.
   * After trying to connect to all available addresses for this resource and
   * assuming at least one connection was successful, the PlexServer object is built and returned.
   */
  async connect(): Promise<MyPlexAccount> {
    if (!this._token) {
      log('Logging in with username', { username: this.username });
      const [data, initpath] = await this._signin(this.username, this.password, this.timeout);
      console.log(data, initpath);
      this._loadData(data);
      return this;
    }

    log('Logging in with token');
    const data = await this.query(this.key);
    console.log(data, this.key);
    this._loadData(data);
    return this;
  }

  async _signin(username?: string, password?: string, timeout?: number): Promise<any> {
    const data = await this.query(this.SIGNIN, 'post', undefined, timeout, username, password);
    return [data, this.SIGNIN];
  }

  _headers(): Record<string, string> {
    const headers = { ...BASE_HEADERS };
    if (this.token) {
      headers['X-Plex-Token'] = this.token;
    }

    return headers;
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
    url: string,
    method: 'get' | 'post' | 'put' | 'patch' | 'head' | 'delete' = 'get',
    headers?: any,
    timeout?: number,
    username?: string,
    password?: string,
  ): Promise<any> {
    const requestHeaders = this._headers();
    if (username && password) {
      const credentials = Buffer.from(`${username}:${password}`).toString('base64');
      requestHeaders.Authorization = `Basic ${credentials}`;
    }

    const response = await got({
      method,
      url: new URL(url),
      headers: requestHeaders,
      timeout: timeout ?? TIMEOUT,
      cookieJar: this.session,
      username,
      password,
      retry: 0,
    });

    console.log(response.body);
    const xml = await parseStringPromise(response.body, { trim: true });
    return xml;
  }

  private _loadData(data: UserResponse): void {
    console.log(JSON.stringify(data));
    const { user } = data;
    this._token = user.$.authToken;
    const subscription = user.subscription[0];
    const plexData: MyPlexData = {
      authenticationToken: this._token,
      certificateVersion: Number(user.$.certificateVersion),
      email: user.$.email,
      guest: user.$.guest === '1',
      home: user.$.home === '1',
      homeSize: Number(user.$.homeSize),
      maxHomeSize: Number(user.$.maxHomeSize),
      id: user.$.id,
      uuid: user.$.uuid,
      username: user.$.username,
      title: user.$.title,
      locale: user.$.locale,
      mailingListStatus: user.$.mailingListStatus,
      mailingListActive: user.$.mailingListActive === '1',
      queueEmail: user.$.queueEmail,
      thumb: user.$.thumb,
      scrobbleTypes: user.$.scrobbleTypes,
      restricted: user.$.restricted === '1',
      subscriptionActive: subscription.$.active === '0',
      subscriptionStatus: subscription.$.status,
      subscriptionPlan: subscription.$.plan,
      subscriptionFeatures: subscription.features?.map(feature => feature?.feature?.[0]?.$?.id),
      entitlements: user.entitlements?.map(entitlement => entitlement?.entitlement?.[0]?.$?.id).filter(x => x),
    };
    this.data = plexData;
  }
}
