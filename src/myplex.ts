import got from 'got';
import { URL } from 'url';
import { parseStringPromise } from 'xml2js';

import { TIMEOUT, BASE_HEADERS } from './config';

/* eslint-disable max-params */
/**
 * MyPlex account and profile information. This object represents the data found Account on
        the myplex.tv servers at the url https://plex.tv/users/account. You may create this object
        directly by passing in your username & password (or token). There is also a convenience
        method provided at :class:`~plexapi.server.PlexServer.myPlexAccount()` which will create
        and return this object.

        Attributes:
            SIGNIN (str): 'https://plex.tv/users/sign_in.xml'
            key (str): 'https://plex.tv/users/account'
            authenticationToken (str): Unknown.
            certificateVersion (str): Unknown.
            cloudSyncDevice (str): Unknown.
            email (str): Your current Plex email address.
            entitlements (List<str>): List of devices your allowed to use with this account.
            guest (bool): Unknown.
            home (bool): Unknown.
            homeSize (int): Unknown.
            id (str): Your Plex account ID.
            locale (str): Your Plex locale
            mailing_list_status (str): Your current mailing list status.
            maxHomeSize (int): Unknown.
            queueEmail (str): Email address to add items to your `Watch Later` queue.
            queueUid (str): Unknown.
            restricted (bool): Unknown.
            roles: (List<str>) Lit of account roles. Plexpass membership listed here.
            scrobbleTypes (str): Description
            secure (bool): Description
            subscriptionActive (bool): True if your subsctiption is active.
            subscriptionFeatures: (List<str>) List of features allowed on your subscription.
            subscriptionPlan (str): Name of subscription plan.
            subscriptionStatus (str): String representation of `subscriptionActive`.
            thumb (str): URL of your account thumbnail.
            title (str): Unknown. - Looks like an alias for `username`.
            username (str): Your account username.
            uuid (str): Unknown.
            _token (str): Token used to access this client.
            _session (obj): Requests session object used to access this client.
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

  key = 'https://plex.tv/api/v2/users/signin';

  /**
   *
   * @param username Your MyPlex username
   * @param password Your MyPlex password
   * @param token
   * @param session Use your own session object if you want to cache the http responses from PMS
   * @param timeout timeout in seconds on initial connect to myplex
   */
  constructor(
    private readonly username?: string,
    private readonly password?: string,
    private readonly token?: any,
    private readonly session?: any,
    private readonly timeout?: number,
  ) {}

  async connect(): Promise<any> {
    const [data, initpath] = await this._signin(this.username, this.password, this.timeout);
    console.log(data, initpath);
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

    console.log({ url, username, password, headers: requestHeaders });
    const response = await got({
      method,
      url: new URL(url),
      headers: requestHeaders,
      timeout: timeout ?? TIMEOUT,
      username,
      password,
      retry: 0,
    });

    console.log(response.body);
    const xml = await parseStringPromise(response.body);
    return xml;
  }
}
