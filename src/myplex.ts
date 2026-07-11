import { setTimeout as sleep } from 'node:timers/promises';

import { ofetch } from 'ofetch';
import { parseStringPromise } from 'xml2js';

import { PlexObject } from './base/plexObject.ts';
import { BASE_HEADERS, TIMEOUT } from './config.ts';
import { BadRequest, NotFound } from './exceptions.ts';
import type { LibrarySection } from './library.ts';
import type {
  Connection,
  Device,
  MyPlexInviteData,
  MyPlexInvitesResponse,
  MyPlexServerShareData,
  MyPlexServerSectionsResponse,
  MyPlexUserData,
  MyPlexUsersResponse,
  ResourcesResponse,
  UserStateData,
  UserStateResponse,
  UserResponse,
  WatchlistItemData,
  WatchlistResponse,
  WebhookResponse,
  WebLogin,
} from './myplex.types.ts';
import type { PlexServer } from './server.ts';
import { createPlexServer } from './serverFactory.ts';
import { encodeBase64, type MediaContainer, parsePlexBoolean } from './util.ts';

/**
 * MyPlex account and profile information. This object represents the data found Account on
 * the myplex.tv servers at the url https://plex.tv/users/account. You may create this object
 * directly by passing in your username & password (or token). There is also a convenience
 * method provided at :class:`~plexapi.server.PlexServer.myPlexAccount()` which will create
 * and return this object.
 */
export class MyPlexAccount {
  static key = 'https://plex.tv/api/v2/user';

  /**
   * This follows the outline described in https://forums.plex.tv/t/authenticating-with-plex/609370
   * to fetch a token and potentially compromise username and password. To use first call `getWebLogin()`
   * and present the returned uri to a user to go to, then await `webLoginCheck()`. If you pass in a
   * `forwardUrl`, then send the user to the returned uri, and when a request comes in on the passed in
   * url, then await `webLoginCheck()`.
   */
  static async getWebLogin(forwardUrl: string | null = null): Promise<WebLogin> {
    const appName = BASE_HEADERS['X-Plex-Product'];
    const clientIdentifier = BASE_HEADERS['X-Plex-Client-Identifier'];
    const pin = await ofetch<Omit<WebLogin, 'uri'>>('https://plex.tv/api/v2/pins', {
      method: 'post',
      headers: {
        Accept: 'application/json',
      },
      query: {
        strong: 'true',
        'X-Plex-Product': appName,
        'X-Plex-Client-Identifier': clientIdentifier,
      },
    });
    return {
      ...pin,
      uri: `https://app.plex.tv/auth#?clientID=${encodeURIComponent(
        clientIdentifier,
      )}&code=${encodeURIComponent(
        pin.code,
      )}&context%5Bdevice%5D%5Bproduct%5D=${encodeURIComponent(appName)}${
        forwardUrl ? `&forwardUrl=${encodeURIComponent(forwardUrl)}` : ''
      }`,
    };
  }

  /**
   * Pass in the `webLogin` object obtained from `getWebLogin()` and this will poll Plex to see if
   * the user agreed. It returns a connected `MyPlexAccount` or throws an error.
   */
  static async webLoginCheck(
    webLogin: WebLogin,
    { timeoutSeconds = 60 }: { timeoutSeconds?: number } = {},
  ): Promise<MyPlexAccount> {
    const recheckMs = 3000;
    const clientIdentifier = BASE_HEADERS['X-Plex-Client-Identifier'];
    const uri = `https://plex.tv/api/v2/pins/${webLogin.id}`;
    const startTime = Date.now();
    while (Date.now() < startTime + timeoutSeconds * 1000) {
      try {
        const tokenResponse = await ofetch(uri, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          query: {
            code: webLogin.code,
            'X-Plex-Client-Identifier': clientIdentifier,
          },
          timeout: recheckMs,
          retry: 5,
          retryDelay: recheckMs,
        });
        if (tokenResponse.authToken) {
          const myPlexAccount = new MyPlexAccount({ token: tokenResponse.authToken });

          return await myPlexAccount.connect();
        }

        await sleep(recheckMs);
      } catch (err) {
        if ((err as Error).message.includes('aborted')) {
          continue;
        }

        throw err;
      }
    }

    throw new Error('Failed to authenticate before timeout');
  }

  FRIENDINVITE = 'https://plex.tv/api/servers/{machineId}/shared_servers'; // post with data
  HOMEUSERS = 'https://plex.tv/api/home/users';
  HOMEUSERCREATE = 'https://plex.tv/api/home/users?title={title}'; // post with data
  EXISTINGUSER = 'https://plex.tv/api/home/users?invitedEmail={username}'; // post with data
  FRIENDSERVERS = 'https://plex.tv/api/servers/{machineId}/shared_servers/{serverId}'; // put with data
  PLEXSERVERS = 'https://plex.tv/api/servers/{machineId}'; // get
  FRIENDUPDATE = 'https://plex.tv/api/v2/sharings/{userId}'; // put with args, delete
  HOMEUSER = 'https://plex.tv/api/home/users/{userId}'; // delete, put
  MANAGEDHOMEUSER = 'https://plex.tv/api/v2/home/users/restricted/{userId}'; // post
  REMOVEINVITE = 'https://plex.tv/api/invites/requested/{userId}?friend=0&server=1&home=0'; // delete
  REQUESTED = 'https://plex.tv/api/invites/requested'; // get
  REQUESTS = 'https://plex.tv/api/invites/requests'; // get
  SIGNIN = 'https://plex.tv/users/sign_in.json'; // get with auth
  WEBHOOKS = 'https://plex.tv/api/v2/user/webhooks'; // get, post with data
  DISCOVER = 'https://discover.provider.plex.tv';
  METADATA = 'https://metadata.provider.plex.tv';

  /** Your Plex account ID */
  declare id?: number;
  /** Unknown */
  declare uuid?: string;
  /**
   * auth token for user by plex
   */
  declare authenticationToken?: string;
  /** Unknown */
  declare certificateVersion?: number;
  /** Unknown. - Looks like an alias for `username` */
  declare title?: string;
  /** Your current Plex email address */
  declare email?: string;
  /** URL of your account thumbnail */
  declare thumb?: string;
  /** Unknown */
  declare guest?: boolean;
  /** Unknown */
  declare home?: boolean;
  /** Unknown */
  declare homeSize?: number;
  /** Unknown */
  declare maxHomeSize?: number;
  /** Your Plex locale */
  declare locale?: string | null;
  /** Your current mailing list status. */
  declare mailingListStatus?: 'active' | 'inactive';
  declare mailingListActive?: boolean;
  /** Email address to add items to your `Watch Later` queue. */
  declare queueEmail?: string;
  /** Unknown */
  declare restricted?: boolean;
  /** Description */
  declare scrobbleTypes?: string;
  /** Name of subscription plan */
  declare subscriptionPlan?: string | null;
  /** String representation of `subscriptionActive` */
  declare subscriptionStatus?: 'active' | 'inactive';
  /** True if your subsctiption is active */
  declare subscriptionActive?: boolean | null;
  /** List of features allowed on your subscription */
  declare subscriptionFeatures?: string[];
  /** List of devices your allowed to use with this account */
  declare entitlements?: string[];

  public baseUrl: string | null = null;
  public username?: string;
  public password?: string;
  public token?: string;
  public timeout: number = TIMEOUT;
  public server?: PlexServer;

  /**
   * @param options Connection + auth options.
   */
  constructor({
    baseUrl = null,
    username,
    password,
    token,
    timeout = TIMEOUT,
    server,
  }: {
    baseUrl?: string | null;
    username?: string;
    password?: string;
    token?: string;
    timeout?: number;
    server?: PlexServer;
  } = {}) {
    this.baseUrl = baseUrl;
    this.username = username;
    this.password = password;
    this.token = token;
    this.timeout = timeout;
    this.server = server;

    if (this.token) {
      Object.defineProperty(this, 'token', {
        enumerable: false,
        configurable: true,
        value: this.token,
      });
    }

    if (this.password) {
      Object.defineProperty(this, 'password', {
        enumerable: false,
        configurable: true,
        value: this.password,
      });
    }
  }

  /**
   * Returns a new :class:`~server.PlexServer` or :class:`~client.PlexClient` object.
   * Often times there is more than one address specified for a server or client.
   * This function will prioritize local connections before remote and HTTPS before HTTP.
   * After trying to connect to all available addresses for this resource and
   * assuming at least one connection was successful, the PlexServer object is built and returned.
   */
  async connect(): Promise<MyPlexAccount> {
    if (!this.token) {
      const data = await this._signin(this.username, this.password);
      this._loadData(data);
      return this;
    }

    const data = await this.query<UserResponse>({ url: MyPlexAccount.key });
    this._loadData(data);
    return this;
  }

  /**
   * Returns the :class:`~plexapi.myplex.MyPlexResource` that matches the name specified.
   */
  async resource(name: string): Promise<MyPlexResource> {
    const resources = await this.resources();
    const matchingResource = resources.find(
      resource =>
        resource.name.toLowerCase() === name.toLowerCase() || resource.clientIdentifier === name,
    );
    if (matchingResource) {
      return matchingResource;
    }

    throw new Error(`Unable to find resource ${name}`);
  }

  async resources(): Promise<MyPlexResource[]> {
    const data = await this.query<ResourcesResponse[]>({ url: MyPlexResource.key });
    return data.map(device => new MyPlexResource(this, device, this.baseUrl));
  }

  /** Return users connected to this Plex account, including managed home users. */
  async users(): Promise<MyPlexUser[]> {
    const data = await this.query<MyPlexUsersResponse>({ url: MyPlexUser.key });
    return (data.MediaContainer.User ?? []).map(user => new MyPlexUser(this, user));
  }

  /** Find an account user by title, username, email, or account id. */
  async user(identifier: number | string): Promise<MyPlexUser> {
    const normalizedIdentifier = identifier.toString().toLowerCase();
    const user = (await this.users()).find(candidate =>
      [candidate.title, candidate.username, candidate.email, candidate.id?.toString()]
        .filter((value): value is string => value !== undefined && value !== '')
        .some(value => value.toLowerCase() === normalizedIdentifier),
    );
    if (!user) {
      throw new NotFound(`Unable to find user ${identifier}.`);
    }

    return user;
  }

  /** Return pending invites sent from or received by this account. */
  async pendingInvites(options: PendingInvitesOptions = {}): Promise<MyPlexInvite[]> {
    const { includeReceived = true, includeSent = true } = options;
    const requests: Array<Promise<MyPlexInvite[]>> = [];
    if (includeSent) {
      requests.push(this._pendingInvites(MyPlexInvite.requestedKey, 'sent'));
    }
    if (includeReceived) {
      requests.push(this._pendingInvites(MyPlexInvite.requestsKey, 'received'));
    }

    return (await Promise.all(requests)).flat();
  }

  /** Find a pending invite by username, email, friendly name, or account id. */
  async pendingInvite(
    identifier: number | string,
    options: PendingInvitesOptions = {},
  ): Promise<MyPlexInvite> {
    const normalizedIdentifier = identifier.toString().toLowerCase();
    const invite = (await this.pendingInvites(options)).find(candidate =>
      [candidate.username, candidate.email, candidate.friendlyName, candidate.id?.toString()]
        .filter((value): value is string => value !== undefined && value !== '')
        .some(value => value.toLowerCase() === normalizedIdentifier),
    );
    if (!invite) {
      throw new NotFound(`Unable to find invite ${identifier}.`);
    }

    return invite;
  }

  /** Accept a pending invite received by this account. */
  async acceptInvite(inviteOrIdentifier: MyPlexInvite | number | string): Promise<void> {
    const invite =
      inviteOrIdentifier instanceof MyPlexInvite
        ? inviteOrIdentifier
        : await this.pendingInvite(inviteOrIdentifier, { includeSent: false });
    if (invite.direction !== 'received') {
      throw new BadRequest('Only received invites can be accepted.');
    }

    await this.query({
      url: inviteActionUrl(invite, MyPlexInvite.requestsKey),
      method: 'put',
    });
  }

  /** Cancel a pending invite sent by this account. */
  async cancelInvite(inviteOrIdentifier: MyPlexInvite | number | string): Promise<void> {
    const invite =
      inviteOrIdentifier instanceof MyPlexInvite
        ? inviteOrIdentifier
        : await this.pendingInvite(inviteOrIdentifier, { includeReceived: false });
    if (invite.direction !== 'sent') {
      throw new BadRequest('Only sent invites can be cancelled.');
    }

    await this.query({
      url: inviteActionUrl(invite, MyPlexInvite.requestedKey),
      method: 'delete',
    });
  }

  /** Invite a Plex user and share selected libraries with them. */
  async inviteFriend(user: MyPlexUser | string, options: InviteFriendOptions): Promise<void> {
    const machineIdentifier = serverIdentifier(options.server);
    const sectionIds = await this._sectionIds(machineIdentifier, options.sections ?? []);
    const body = shareRequestBody({
      invitedEmail: inviteUsername(user),
      machineIdentifier,
      sectionIds,
      permissions: options.permissions ?? {},
      filters: options.filters ?? {},
    });
    await this.query({
      url: this.FRIENDINVITE.replace('{machineId}', machineIdentifier),
      method: 'post',
      body,
    });
  }

  /** Return the server libraries available to account-sharing APIs. */
  async sharingSections(server: PlexServer | string): Promise<MyPlexLibraryShareSection[]> {
    const machineIdentifier = serverIdentifier(server);
    const data = await this.query<MyPlexServerSectionsResponse>({
      url: this.PLEXSERVERS.replace('{machineId}', machineIdentifier),
    });
    return (data.MediaContainer.Server?.[0]?.Section ?? []).map(section => ({
      id: Number(section.$.id),
      key: Number(section.$.key),
      title: section.$.title,
      type: section.$.type,
    }));
  }

  /** Create a managed Plex Home user and assign their shared libraries. */
  async createHomeUser(title: string, options: CreateHomeUserOptions): Promise<void> {
    const machineIdentifier = serverIdentifier(options.server);
    const sectionIds = await this._sectionIds(machineIdentifier, options.sections ?? []);
    const createUrl = `${this.HOMEUSERS}?${new URLSearchParams({ title }).toString()}`;
    const createdUser = await this.query<PlexHomeResponse>({ url: createUrl, method: 'post' });
    const userId = homeResponseAttribute(createdUser, 'id');
    if (!userId) {
      throw new BadRequest('Plex did not return an id for the created home user.');
    }

    await this.query({
      url: this.FRIENDINVITE.replace('{machineId}', machineIdentifier),
      method: 'post',
      body: shareRequestBody({
        invitedId: Number(userId),
        machineIdentifier,
        sectionIds,
        permissions: options.permissions ?? {},
        filters: options.filters ?? {},
      }),
    });
  }

  /** Add an existing Plex user to this Plex Home. */
  async addUserToHome(user: MyPlexUser | string, sharing?: InviteFriendOptions): Promise<void> {
    const username = inviteUsername(user);
    const url = `${this.HOMEUSERS}?${new URLSearchParams({ invitedEmail: username }).toString()}`;
    await this.query({ url, method: 'post' });
    if (sharing !== undefined) {
      await this.inviteFriend(username, sharing);
    }
  }

  /** Switch authentication to a managed Plex Home user. */
  async switchHomeUser(
    userOrIdentifier: MyPlexUser | number | string,
    options: SwitchHomeUserOptions = {},
  ): Promise<MyPlexAccount> {
    const user =
      userOrIdentifier instanceof MyPlexUser ? userOrIdentifier : await this.user(userOrIdentifier);
    const params = new URLSearchParams();
    if (options.pin !== undefined) {
      params.set('pin', options.pin);
    }
    const query = params.toString();
    const url = `${this.HOMEUSERS}/${requiredId(user, 'user')}/switch${query ? `?${query}` : ''}`;
    const data = await this.query<PlexHomeResponse>({ url, method: 'post' });
    const token = homeResponseAttribute(data, 'authenticationToken');
    if (!token) {
      throw new BadRequest('Plex did not return an authentication token for the home user.');
    }

    const switchedAccount = new MyPlexAccount({
      baseUrl: this.baseUrl,
      token,
      timeout: this.timeout,
    });
    return switchedAccount.connect();
  }

  /** Set or change the signed-in account's Plex Home PIN. */
  async setPin(options: SetAccountPinOptions): Promise<void> {
    const params = new URLSearchParams({ pin: options.pin });
    if (options.currentPin !== undefined) {
      params.set('currentPin', options.currentPin);
    }
    await this.query({
      url: `${this.HOMEUSER.replace('{userId}', requiredId(this, 'account'))}?${params.toString()}`,
      method: 'put',
    });
  }

  /** Remove the signed-in account's Plex Home PIN. */
  async removePin(options: RemoveAccountPinOptions): Promise<void> {
    await this.setPin({ pin: '', currentPin: options.currentPin });
  }

  /** Set or change a managed Plex Home user's PIN. */
  async setManagedUserPin(
    userOrIdentifier: MyPlexUser | number | string,
    options: SetManagedUserPinOptions,
  ): Promise<void> {
    const user =
      userOrIdentifier instanceof MyPlexUser ? userOrIdentifier : await this.user(userOrIdentifier);
    const params = new URLSearchParams({ pin: options.pin });
    await this.query({
      url: `${this.MANAGEDHOMEUSER.replace('{userId}', requiredId(user, 'user'))}?${params.toString()}`,
      method: 'post',
    });
  }

  /** Remove a managed Plex Home user's PIN. */
  async removeManagedUserPin(userOrIdentifier: MyPlexUser | number | string): Promise<void> {
    const user =
      userOrIdentifier instanceof MyPlexUser ? userOrIdentifier : await this.user(userOrIdentifier);
    await this.query({
      url: `${this.MANAGEDHOMEUSER.replace('{userId}', requiredId(user, 'user'))}?removePin=1`,
      method: 'post',
    });
  }

  /** Return movies and shows in this account's Plex Discover watchlist. */
  async watchlist(options: WatchlistOptions = {}): Promise<WatchlistItem[]> {
    const {
      filter = 'all',
      filters = {},
      includeCollections = true,
      includeExternalMedia = true,
      limit,
      sort,
      type,
    } = options;
    const params = new URLSearchParams({
      includeCollections: includeCollections ? '1' : '0',
      includeExternalMedia: includeExternalMedia ? '1' : '0',
    });
    if (sort !== undefined) {
      params.set('sort', sort);
    }
    if (type !== undefined) {
      params.set('type', type === 'movie' ? '1' : '2');
    }
    if (limit !== undefined) {
      params.set('X-Plex-Container-Size', limit.toString());
    }
    for (const [key, value] of Object.entries(filters)) {
      params.set(key, String(value));
    }

    const url = `${this.DISCOVER}/library/sections/watchlist/${filter}?${params.toString()}`;
    const data = await this.query<WatchlistResponse>({ url });
    return (data.MediaContainer.Metadata ?? []).map(item => new WatchlistItem(this, item));
  }

  /** Return Plex Discover user state for a movie or show. */
  async userState(item: WatchlistTarget): Promise<PlexUserState> {
    const ratingKey = discoverRatingKey(item);
    const data = await this.query<UserStateResponse>({
      url: `${this.METADATA}/library/metadata/${encodeURIComponent(ratingKey)}/userState`,
    });
    const state = data.MediaContainer.UserState;
    if (!state) {
      throw new NotFound(`Plex did not return user state for "${item.title ?? ratingKey}".`);
    }
    return new PlexUserState(state);
  }

  /** Return whether a movie or show is currently on this account's watchlist. */
  async onWatchlist(item: WatchlistTarget): Promise<boolean> {
    return (await this.userState(item)).watchlistedAt !== undefined;
  }

  /** Add one or more movies or shows to this account's watchlist. */
  async addToWatchlist(items: WatchlistTarget | readonly WatchlistTarget[]): Promise<this> {
    for (const item of normalizeWatchlistTargets(items)) {
      if (await this.onWatchlist(item)) {
        throw new BadRequest(`"${item.title ?? item.guid}" is already on the watchlist.`);
      }
      const ratingKey = discoverRatingKey(item);
      await this.query({
        url: `${this.DISCOVER}/actions/addToWatchlist?${new URLSearchParams({ ratingKey }).toString()}`,
        method: 'put',
      });
    }
    return this;
  }

  /** Remove one or more movies or shows from this account's watchlist. */
  async removeFromWatchlist(items: WatchlistTarget | readonly WatchlistTarget[]): Promise<this> {
    for (const item of normalizeWatchlistTargets(items)) {
      if (!(await this.onWatchlist(item))) {
        throw new BadRequest(`"${item.title ?? item.guid}" is not on the watchlist.`);
      }
      const ratingKey = discoverRatingKey(item);
      await this.query({
        url: `${this.DISCOVER}/actions/removeFromWatchlist?${new URLSearchParams({ ratingKey }).toString()}`,
        method: 'put',
      });
    }
    return this;
  }

  /** Return webhook URLs configured for this Plex account. */
  async webhooks(): Promise<string[]> {
    const data = await this.query<WebhookResponse>({ url: this.WEBHOOKS });
    return webhookUrls(data);
  }

  /** Replace all webhook URLs configured for this Plex account. */
  async setWebhooks(urls: readonly string[]): Promise<string[]> {
    const body = new URLSearchParams();
    if (urls.length === 0) {
      body.set('urls', '');
    } else {
      for (const url of urls) {
        body.append('urls[]', url);
      }
    }
    const data = await this.query<WebhookResponse>({
      url: this.WEBHOOKS,
      method: 'post',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    return webhookUrls(data);
  }

  /** Add one webhook while preserving the account's existing URLs. */
  async addWebhook(url: string): Promise<string[]> {
    const urls = await this.webhooks();
    if (urls.includes(url)) {
      throw new BadRequest(`Webhook already exists: ${url}`);
    }
    return this.setWebhooks([...urls, url]);
  }

  /** Remove one webhook while preserving the account's remaining URLs. */
  async removeWebhook(url: string): Promise<string[]> {
    const urls = await this.webhooks();
    if (!urls.includes(url)) {
      throw new BadRequest(`Webhook does not exist: ${url}`);
    }
    return this.setWebhooks(urls.filter(candidate => candidate !== url));
  }

  /** @deprecated Use {@link removeWebhook}. */
  async deleteWebhook(url: string): Promise<string[]> {
    return this.removeWebhook(url);
  }

  /** Update a user's shared libraries and account-level sharing settings. */
  async updateFriend(
    userOrIdentifier: MyPlexUser | number | string,
    options: UpdateFriendOptions,
  ): Promise<void> {
    const user =
      userOrIdentifier instanceof MyPlexUser ? userOrIdentifier : await this.user(userOrIdentifier);
    const userId = requiredId(user, 'user');
    const machineIdentifier = serverIdentifier(options.server);
    const existingShare = user.servers.find(share => share.machineIdentifier === machineIdentifier);

    if (options.removeSections && existingShare) {
      await this.query({
        url: this.FRIENDSERVERS.replace('{machineId}', machineIdentifier).replace(
          '{serverId}',
          requiredId(existingShare, 'server share'),
        ),
        method: 'delete',
        body: shareRequestBody({ machineIdentifier, sectionIds: [] }),
      });
    } else if (options.sections !== undefined) {
      const sectionIds = await this._sectionIds(machineIdentifier, options.sections);
      const hasExistingShare = existingShare !== undefined;
      await this.query({
        url: hasExistingShare
          ? this.FRIENDSERVERS.replace('{machineId}', machineIdentifier).replace(
              '{serverId}',
              requiredId(existingShare, 'server share'),
            )
          : this.FRIENDINVITE.replace('{machineId}', machineIdentifier),
        method: hasExistingShare ? 'put' : 'post',
        body: shareRequestBody({
          invitedId: hasExistingShare ? undefined : Number(userId),
          machineIdentifier,
          sectionIds,
        }),
      });
    }

    const settings = sharingSettingsQuery(options.permissions, options.filters);
    if (settings.size > 0) {
      await this.query({
        url: `${this.FRIENDUPDATE.replace('{userId}', userId)}?${settings.toString()}`,
        method: 'put',
      });
    }
  }

  /** Remove a user from this account's friends. */
  async removeFriend(userOrIdentifier: MyPlexUser | number | string): Promise<void> {
    const user =
      userOrIdentifier instanceof MyPlexUser ? userOrIdentifier : await this.user(userOrIdentifier);
    await this.query({
      url: this.FRIENDUPDATE.replace('{userId}', requiredId(user, 'user')),
      method: 'delete',
    });
  }

  /** Remove a managed user from this Plex Home. */
  async removeHomeUser(userOrIdentifier: MyPlexUser | number | string): Promise<void> {
    const user =
      userOrIdentifier instanceof MyPlexUser ? userOrIdentifier : await this.user(userOrIdentifier);
    await this.query({
      url: this.HOMEUSER.replace('{userId}', requiredId(user, 'user')),
      method: 'delete',
    });
  }

  /**
   * @param name Name to match against.
   * @param clientId clientIdentifier to match against.
   */
  async device(name = '', clientId?: string): Promise<MyPlexDevice> {
    const devices = await this.devices();
    const device = devices.find(
      candidate =>
        candidate.name?.toLowerCase() === name.toLowerCase() ||
        candidate.clientIdentifier === clientId,
    );
    if (!device) {
      throw new Error('Unable to find device');
    }

    return device;
  }

  /**
   * Returns a list of all :class:`~plexapi.myplex.MyPlexDevice` objects connected to the server.
   */
  async devices(): Promise<MyPlexDevice[]> {
    const response = await this.query<MediaContainer<{ Device: Device[] }>>({
      url: MyPlexDevice.key,
    });
    return response.MediaContainer.Device.map(data => new MyPlexDevice(this.server, data));
  }

  /**
   * Main method used to handle HTTPS requests to the Plex client. This method helps
   * by encoding the response to utf-8 and parsing the returned XML into and
   * ElementTree object. Returns None if no data exists in the response.
   * TODO: use headers
   * @param path
   * @param options
   */
  async query<T = any>({
    url,
    method = 'get',
    headers,
    body: requestBody,
    username,
    password,
  }: {
    url: string;
    method?: 'get' | 'post' | 'put' | 'patch' | 'head' | 'delete';
    headers?: Record<string, string>;
    body?: BodyInit | Record<string, unknown>;
    username?: string;
    password?: string;
  }): Promise<T> {
    const requestHeaders = this._headers();
    if (username && password) {
      const credentials = encodeBase64(`${username}:${password}`);
      requestHeaders.Authorization = `Basic ${credentials}`;
    }

    if (headers) {
      Object.assign(requestHeaders, headers);
    }

    if (!url.includes('xml')) {
      requestHeaders.accept = 'application/json';
    }

    const responseBody = await ofetch<string>(url, {
      method,
      headers: requestHeaders,
      body: requestBody,
      timeout: this.timeout ?? TIMEOUT,
      retry: 0,
      parseResponse: res => res,
      // Can't seem to pass responseType
    });

    const trimmedBody = responseBody.trimStart();
    if (url.includes('xml') || trimmedBody.startsWith('<')) {
      const xml = await parseStringPromise(responseBody);
      return xml;
    }

    if (trimmedBody === '') {
      return undefined as T;
    }

    const res = JSON.parse(responseBody);
    return res;
  }

  private async _pendingInvites(
    url: string,
    direction: MyPlexInviteDirection,
  ): Promise<MyPlexInvite[]> {
    const data = await this.query<MyPlexInvitesResponse>({ url });
    return (data.MediaContainer.Invite ?? []).map(
      invite => new MyPlexInvite(this, invite, direction),
    );
  }

  private async _sectionIds(
    machineIdentifier: string,
    sections: readonly LibraryShareSection[],
  ): Promise<number[]> {
    if (sections.length === 0) {
      return [];
    }

    const availableSections = await this.sharingSections(machineIdentifier);
    const byId = new Map(availableSections.map(section => [section.id.toString(), section.id]));
    const byKey = new Map(availableSections.map(section => [section.key.toString(), section.id]));
    const byTitle = new Map(
      availableSections.map(section => [section.title.toLowerCase(), section.id]),
    );

    return sections.map(section => {
      const value = typeof section === 'object' ? section.key.toString() : section.toString();
      const id = byKey.get(value) ?? byId.get(value) ?? byTitle.get(value.toLowerCase());
      if (id === undefined) {
        throw new NotFound(`Unable to find library section ${value}.`);
      }

      return id;
    });
  }

  /**
   * Returns a str, a new "claim-token", which you can use to register your new Plex Server instance to your account.
   * @link https://hub.docker.com/r/plexinc/pms-docker/
   * @link https://www.plex.tv/claim/
   */
  async claimToken(): Promise<string> {
    const url = 'https://plex.tv/api/claim/token.json';
    const response = await this.query<{ token: string }>({ url });
    return response.token;
  }

  /**
   * @param token pass token from claimToken
   */
  async claimServer(token: string): Promise<unknown> {
    const params = new URLSearchParams({
      token,
      ...BASE_HEADERS,
    });
    const url = `${this.baseUrl}/myplex/claim?${params.toString()}`;
    return ofetch(url, {
      method: 'post',
      timeout: TIMEOUT,
      headers: this._headers(),
      retry: 0,
    });
  }

  _headers(): Record<string, string> {
    const headers: Record<string, string> = {
      ...BASE_HEADERS,
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['X-Plex-Token'] = this.token;
    }

    return headers;
  }

  private async _signin(username?: string, password?: string): Promise<UserResponse> {
    const data = await this.query<{ user: UserResponse }>({
      url: this.SIGNIN,
      method: 'post',
      username,
      password,
    });
    return data.user;
  }

  private _loadData(user: UserResponse): void {
    // Attempt to prevent token from being logged accidentally
    Object.defineProperty(this, 'token', {
      enumerable: false,
      configurable: true,
      value: user.authToken,
    });
    this.authenticationToken = this.token;
    this.certificateVersion = Number(user.certificateVersion);
    this.email = user.email;
    this.guest = user.guest;
    this.home = user.home;
    this.homeSize = Number(user.homeSize);
    this.maxHomeSize = Number(user.maxHomeSize);
    this.id = user.id;
    this.uuid = user.uuid;
    this.username = user.username;
    this.title = user.title;
    this.locale = user.locale;
    this.mailingListStatus = user.mailingListStatus ?? 'inactive';
    this.mailingListActive = user.mailingListActive;
    this.queueEmail = user.queueEmail;
    this.thumb = user.thumb;
    this.scrobbleTypes = user.scrobbleTypes;
    this.restricted = user.restricted;
    this.subscriptionActive = user.subscription?.active ?? null;
    this.subscriptionStatus = (user.subscription?.status?.toLowerCase() as 'active') ?? 'inactive';
    this.subscriptionPlan = user.subscription?.plan ?? null;
    this.subscriptionFeatures = user.subscription?.features ?? [];
    this.entitlements = user.entitlements;
  }
}

export interface PendingInvitesOptions {
  /** Include invites this account received. */
  includeReceived?: boolean;
  /** Include invites this account sent. */
  includeSent?: boolean;
}

export type LibraryShareSection = Pick<LibrarySection<unknown>, 'key' | 'title'> | number | string;

export interface MyPlexLibraryShareSection {
  /** Account-level section id used in sharing requests. */
  id: number;
  /** Local Plex library section key. */
  key: number;
  title: string;
  /** Plex library type such as `movie`, `show`, or `artist`. */
  type: string;
}

export type VideoShareFilter = Partial<
  Record<'contentRating' | 'contentRating!' | 'label' | 'label!', readonly string[]>
>;
export type MusicShareFilter = Partial<Record<'label' | 'label!', readonly string[]>>;

export interface LibraryShareFilters {
  movies?: VideoShareFilter;
  music?: MusicShareFilter;
  television?: VideoShareFilter;
}

export interface LibrarySharePermissions {
  allowCameraUpload?: boolean;
  allowChannels?: boolean;
  allowSync?: boolean;
}

export interface InviteFriendOptions {
  /** Plex server or machine identifier containing the libraries. */
  server: PlexServer | string;
  /** Libraries to share. Omit or pass an empty list to invite without libraries. */
  sections?: readonly LibraryShareSection[];
  /** Account capabilities granted to the invited user. */
  permissions?: LibrarySharePermissions;
  /** Optional content and label restrictions by library family. */
  filters?: LibraryShareFilters;
}

export type CreateHomeUserOptions = InviteFriendOptions;

export interface SwitchHomeUserOptions {
  /** PIN required by a protected home user. */
  pin?: string;
}

export interface SetAccountPinOptions {
  /** New PIN. Pass an empty string to remove it. */
  pin: string;
  /** Current PIN when changing an existing PIN. */
  currentPin?: string;
}

export interface RemoveAccountPinOptions {
  currentPin: string;
}

export interface SetManagedUserPinOptions {
  pin: string;
}

export type WatchlistFilter = 'all' | 'available' | 'released';
export type WatchlistSortField = 'originallyAvailableAt' | 'rating' | 'titleSort' | 'watchlistedAt';
export type WatchlistSort = `${WatchlistSortField}:${'asc' | 'desc'}`;

export interface WatchlistOptions {
  filter?: WatchlistFilter;
  sort?: WatchlistSort;
  type?: 'movie' | 'show';
  limit?: number;
  includeCollections?: boolean;
  includeExternalMedia?: boolean;
  /** Provider-specific filters not covered by the common options. */
  filters?: Readonly<Record<string, boolean | number | string>>;
}

export interface WatchlistTarget {
  /** Plex Discover GUID such as `plex://movie/…` or `plex://show/…`. */
  guid: string;
  title?: string;
}

export interface UpdateFriendOptions extends InviteFriendOptions {
  /** Remove this server's library share. Supersedes `sections`. */
  removeSections?: boolean;
}

export type MyPlexInviteDirection = 'received' | 'sent';

export class PlexUserState {
  readonly ratingKey: string;
  readonly type: string;
  readonly lastViewedAt?: Date;
  readonly viewCount: number;
  readonly viewedLeafCount?: number;
  readonly viewOffset: number;
  readonly viewState: boolean;
  readonly watchlistedAt?: Date;

  constructor(data: UserStateData) {
    this.ratingKey = data.ratingKey;
    this.type = data.type;
    this.lastViewedAt = timestampDate(data.lastViewedAt);
    this.viewCount = data.viewCount;
    this.viewedLeafCount = data.viewedLeafCount;
    this.viewOffset = data.viewOffset;
    this.viewState = data.viewState === 'complete';
    this.watchlistedAt = timestampDate(data.watchlistedAt);
  }
}

export class WatchlistItem implements WatchlistTarget {
  readonly account: MyPlexAccount;
  readonly ratingKey: string;
  readonly key: string;
  readonly guid: string;
  readonly type: 'movie' | 'show';
  readonly title: string;
  readonly addedAt?: Date;
  readonly art?: string;
  readonly duration?: number;
  readonly originallyAvailableAt?: string;
  readonly rating?: number;
  readonly slug?: string;
  readonly source?: string;
  readonly thumb?: string;
  readonly titleSort?: string;
  readonly watchlistedAt?: Date;
  readonly year?: number;

  constructor(account: MyPlexAccount, data: WatchlistItemData) {
    this.account = account;
    this.ratingKey = data.ratingKey;
    this.key = data.key;
    this.guid = data.guid;
    this.type = data.type;
    this.title = data.title;
    this.addedAt = timestampDate(data.addedAt);
    this.art = data.art;
    this.duration = data.duration;
    this.originallyAvailableAt = data.originallyAvailableAt;
    this.rating = data.rating;
    this.slug = data.slug;
    this.source = data.source;
    this.thumb = data.thumb;
    this.titleSort = data.titleSort;
    this.watchlistedAt = timestampDate(data.watchlistedAt);
    this.year = data.year;
  }

  async onWatchlist(): Promise<boolean> {
    return this.account.onWatchlist(this);
  }

  async addToWatchlist(): Promise<void> {
    await this.account.addToWatchlist(this);
  }

  async removeFromWatchlist(): Promise<void> {
    await this.account.removeFromWatchlist(this);
  }
}

export class MyPlexServerShare {
  readonly account: MyPlexAccount;
  readonly id?: number;
  readonly accountID?: number;
  readonly serverId?: number;
  readonly machineIdentifier?: string;
  readonly name?: string;
  readonly lastSeenAt?: Date;
  readonly numLibraries?: number;
  readonly allLibraries: boolean;
  readonly owned: boolean;
  readonly pending: boolean;

  constructor(account: MyPlexAccount, data: MyPlexServerShareData) {
    this.account = account;
    this.id = optionalNumber(data.$.id);
    this.accountID = optionalNumber(data.$.accountID);
    this.serverId = optionalNumber(data.$.serverId);
    this.machineIdentifier = data.$.machineIdentifier;
    this.name = data.$.name;
    this.lastSeenAt = data.$.lastSeenAt ? new Date(data.$.lastSeenAt) : undefined;
    this.numLibraries = optionalNumber(data.$.numLibraries);
    this.allLibraries = parsePlexBoolean(data.$.allLibraries);
    this.owned = parsePlexBoolean(data.$.owned);
    this.pending = parsePlexBoolean(data.$.pending);
  }
}

export class MyPlexUser {
  static readonly key = 'https://plex.tv/api/users/';

  readonly account: MyPlexAccount;
  readonly friend = true;
  readonly allowCameraUpload: boolean;
  readonly allowChannels: boolean;
  readonly allowSync: boolean;
  readonly email?: string;
  readonly filterAll?: string;
  readonly filterMovies?: string;
  readonly filterMusic?: string;
  readonly filterPhotos?: string;
  readonly filterTelevision?: string;
  readonly home: boolean;
  readonly id?: number;
  readonly protected: boolean;
  readonly recommendationsPlaylistId?: string;
  readonly restricted?: string;
  readonly servers: MyPlexServerShare[];
  readonly thumb?: string;
  readonly title?: string;
  readonly username?: string;

  constructor(account: MyPlexAccount, data: MyPlexUserData) {
    this.account = account;
    this.allowCameraUpload = parsePlexBoolean(data.$.allowCameraUpload);
    this.allowChannels = parsePlexBoolean(data.$.allowChannels);
    this.allowSync = parsePlexBoolean(data.$.allowSync);
    this.email = data.$.email;
    this.filterAll = data.$.filterAll;
    this.filterMovies = data.$.filterMovies;
    this.filterMusic = data.$.filterMusic;
    this.filterPhotos = data.$.filterPhotos;
    this.filterTelevision = data.$.filterTelevision;
    this.home = parsePlexBoolean(data.$.home);
    this.id = optionalNumber(data.$.id);
    this.protected = parsePlexBoolean(data.$.protected);
    this.recommendationsPlaylistId = data.$.recommendationsPlaylistId;
    this.restricted = data.$.restricted;
    this.servers = (data.Server ?? []).map(server => new MyPlexServerShare(account, server));
    this.thumb = data.$.thumb;
    this.title = data.$.title;
    this.username = data.$.username;
  }

  /** Find a server shared with this user by name or machine identifier. */
  server(identifier: string): MyPlexServerShare {
    const normalizedIdentifier = identifier.toLowerCase();
    const server = this.servers.find(
      candidate =>
        candidate.name?.toLowerCase() === normalizedIdentifier ||
        candidate.machineIdentifier?.toLowerCase() === normalizedIdentifier,
    );
    if (!server) {
      throw new NotFound(`Unable to find server ${identifier}.`);
    }

    return server;
  }

  /** Remove this user from the account's friends. */
  async removeFriend(): Promise<void> {
    await this.account.removeFriend(this);
  }

  /** Remove this managed user from the account's Plex Home. */
  async removeHomeUser(): Promise<void> {
    await this.account.removeHomeUser(this);
  }
}

export class MyPlexInvite {
  static readonly requestsKey = 'https://plex.tv/api/invites/requests';
  static readonly requestedKey = 'https://plex.tv/api/invites/requested';

  readonly account: MyPlexAccount;
  readonly direction: MyPlexInviteDirection;
  readonly createdAt?: Date;
  readonly email?: string;
  readonly friend: boolean;
  readonly friendlyName?: string;
  readonly home: boolean;
  readonly id?: number;
  readonly server: boolean;
  readonly servers: MyPlexServerShare[];
  readonly thumb?: string;
  readonly username?: string;

  constructor(account: MyPlexAccount, data: MyPlexInviteData, direction: MyPlexInviteDirection) {
    this.account = account;
    this.direction = direction;
    this.createdAt = data.$.createdAt ? new Date(data.$.createdAt) : undefined;
    this.email = data.$.email;
    this.friend = parsePlexBoolean(data.$.friend);
    this.friendlyName = data.$.friendlyName;
    this.home = parsePlexBoolean(data.$.home);
    this.id = optionalNumber(data.$.id);
    this.server = parsePlexBoolean(data.$.server);
    this.servers = (data.Server ?? []).map(server => new MyPlexServerShare(account, server));
    this.thumb = data.$.thumb;
    this.username = data.$.username;
  }

  /** Accept this received invite. */
  async accept(): Promise<void> {
    await this.account.acceptInvite(this);
  }

  /** Cancel this sent invite. */
  async cancel(): Promise<void> {
    await this.account.cancelInvite(this);
  }
}

function optionalNumber(value: string | undefined): number | undefined {
  return value === undefined || value === '' ? undefined : Number(value);
}

function requiredId(value: { id?: number }, model: string): string {
  if (value.id === undefined) {
    throw new BadRequest(`Cannot update a ${model} without an id.`);
  }

  return value.id.toString();
}

function inviteActionUrl(invite: MyPlexInvite, baseUrl: string): string {
  const params = new URLSearchParams({
    friend: invite.friend ? '1' : '0',
    home: invite.home ? '1' : '0',
    server: invite.server ? '1' : '0',
  });
  return `${baseUrl}/${requiredId(invite, 'invite')}?${params.toString()}`;
}

type ShareRequestOptions = {
  filters?: LibraryShareFilters;
  invitedEmail?: string;
  invitedId?: number;
  machineIdentifier: string;
  permissions?: LibrarySharePermissions;
  sectionIds: number[];
};

function shareRequestBody(options: ShareRequestOptions): Record<string, unknown> {
  const sharedServer: Record<string, unknown> = {
    library_section_ids: options.sectionIds,
  };
  if (options.invitedEmail !== undefined) {
    sharedServer.invited_email = options.invitedEmail;
  }
  if (options.invitedId !== undefined) {
    sharedServer.invited_id = options.invitedId;
  }

  const body: Record<string, unknown> = {
    server_id: options.machineIdentifier,
    shared_server: sharedServer,
  };
  if (options.permissions !== undefined || options.filters !== undefined) {
    body.sharing_settings = {
      allowSync: options.permissions?.allowSync ? '1' : '0',
      allowCameraUpload: options.permissions?.allowCameraUpload ? '1' : '0',
      allowChannels: options.permissions?.allowChannels ? '1' : '0',
      filterMovies: shareFilterString(options.filters?.movies),
      filterTelevision: shareFilterString(options.filters?.television),
      filterMusic: shareFilterString(options.filters?.music),
    };
  }

  return body;
}

function shareFilterString(filter: VideoShareFilter | MusicShareFilter | undefined): string {
  return Object.entries(filter ?? {})
    .map(([key, values]) => `${key}=${values.join('%2C')}`)
    .join('|');
}

function sharingSettingsQuery(
  permissions: LibrarySharePermissions | undefined,
  filters: LibraryShareFilters | undefined,
): URLSearchParams {
  const params = new URLSearchParams();
  if (permissions?.allowSync !== undefined) {
    params.set('allowSync', permissions.allowSync ? '1' : '0');
  }
  if (permissions?.allowCameraUpload !== undefined) {
    params.set('allowCameraUpload', permissions.allowCameraUpload ? '1' : '0');
  }
  if (permissions?.allowChannels !== undefined) {
    params.set('allowChannels', permissions.allowChannels ? '1' : '0');
  }
  if (filters?.movies !== undefined) {
    params.set('filterMovies', shareFilterString(filters.movies));
  }
  if (filters?.television !== undefined) {
    params.set('filterTelevision', shareFilterString(filters.television));
  }
  if (filters?.music !== undefined) {
    params.set('filterMusic', shareFilterString(filters.music));
  }
  return params;
}

function serverIdentifier(server: PlexServer | string): string {
  if (typeof server === 'string') {
    return server;
  }
  if (!server.machineIdentifier) {
    throw new BadRequest('Cannot share libraries from a server without a machine identifier.');
  }
  return server.machineIdentifier;
}

function inviteUsername(user: MyPlexUser | string): string {
  if (typeof user === 'string') {
    return user;
  }
  const username = user.username ?? user.email;
  if (!username) {
    throw new BadRequest('Cannot invite a user without a username or email.');
  }
  return username;
}

function discoverRatingKey(item: WatchlistTarget): string {
  const ratingKey = item.guid.split('/').at(-1);
  if (!ratingKey || !item.guid.startsWith('plex://')) {
    throw new BadRequest(`"${item.title ?? item.guid}" does not have a Plex Discover GUID.`);
  }
  return ratingKey;
}

function normalizeWatchlistTargets(
  items: WatchlistTarget | readonly WatchlistTarget[],
): readonly WatchlistTarget[] {
  return 'guid' in items ? [items] : items;
}

function timestampDate(value: number | undefined): Date | undefined {
  return value === undefined ? undefined : new Date(value * 1000);
}

function webhookUrls(response: WebhookResponse): string[] {
  return response.map(webhook => (typeof webhook === 'string' ? webhook : webhook.url));
}

type PlexHomeAttributes = {
  authenticationToken?: string;
  id?: string;
};

type PlexHomeUserResponse = PlexHomeAttributes | { $: PlexHomeAttributes };

type PlexHomeResponse = {
  MediaContainer?: { User?: PlexHomeUserResponse[] };
  User?: PlexHomeUserResponse;
  user?: PlexHomeUserResponse;
};

function homeResponseAttribute(
  response: PlexHomeResponse,
  name: keyof PlexHomeAttributes,
): string | undefined {
  const user = response.User ?? response.user ?? response.MediaContainer?.User?.[0];
  if (!user) {
    return undefined;
  }
  return '$' in user ? user.$[name] : user[name];
}

/**
 * Connects to the specified cls with url and token
 */
async function connect(url: string, token: string, timeout?: number): Promise<PlexServer> {
  const device = createPlexServer(url, token, timeout);
  await device.connect();
  return device;
}

/**
 * Attempts connections to all candidate URLs concurrently and returns the first
 * successful result according to the original URL preference order.
 */
async function connectInPreferredOrder(
  urls: string[],
  token: string,
  timeout: number | undefined,
  resourceName: string,
): Promise<PlexServer> {
  const results = await Promise.allSettled(urls.map(async url => connect(url, token, timeout)));

  for (const result of results) {
    if (result.status === 'fulfilled') {
      return result.value;
    }
  }

  throw new Error(`Unable to connect to resource: ${resourceName}`);
}

export type ResourceConnectionLocation = 'local' | 'remote' | 'relay';
export type ResourceConnectionScheme = 'http' | 'https';
export type ResourceIpVersion = 'ipv4' | 'ipv6';

export interface PreferredConnectionOptions {
  /** Restrict connections to HTTPS (`true`), HTTP (`false`), or either (`null`). */
  ssl?: boolean | null;
  /** Restrict connections to IPv6 (`true`), IPv4 (`false`), or either (`null`). */
  ipv6?: boolean | null;
  /** Location priority. */
  locations?: readonly ResourceConnectionLocation[];
  /** Protocol priority. */
  schemes?: readonly ResourceConnectionScheme[];
  /** IP-version priority. */
  ipVersions?: readonly ResourceIpVersion[];
}

export interface ResourceConnectOptions extends PreferredConnectionOptions {
  /** Per-connection timeout in milliseconds. */
  timeout?: number;
}

/**
 * This object represents resources connected to your Plex server that can provide
 * content such as Plex Media Servers, iPhone or Android clients, etc.
 */
export class MyPlexResource {
  static key = 'https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=1';
  TAG = 'Device';
  readonly account: MyPlexAccount;
  private readonly baseUrl: string | null;
  /** Descriptive name of this resource */
  declare name: string;
  /** True if this resource is one of your own (you logged into it) */
  declare owned: boolean;
  /** This resources accesstoken */
  declare accessToken: string;
  /** Unique ID for this resource */
  declare clientIdentifier: string;
  /** List of !:class!:`~myplex.ResourceConnection` objects for this resource */
  declare connections: ResourceConnection[];
  /** Timestamp this resource first connected to your server */
  declare createdAt: Date;
  /** Timestamp this resource last connected */
  declare lastSeenAt: Date;
  /** Best guess on the type of device this is (PS, iPhone, Linux, etc) */
  declare device: string | null;
  /** Unknown */
  declare home: boolean;
  /** OS the resource is running (Linux, Windows, Chrome, etc.) */
  declare platform: string;
  /** Version of the platform */
  declare platformVersion: string;
  /** True if the resource is online */
  declare presence: boolean;
  /** Plex product (Plex Media Server, Plex for iOS, Plex Web, etc.) */
  declare product: string;
  /** Version of the product. */
  declare productVersion: string;
  /** List of services this resource provides (client, server, player, pubsub-player, etc.) */
  declare provides: string;
  /** Unknown (possibly True if the resource has synced content?) */
  declare synced: boolean;

  constructor(account: MyPlexAccount, data: ResourcesResponse, baseUrl: string | null = null) {
    this.account = account;
    this.baseUrl = baseUrl;
    this._loadData(data);
  }

  preferredConnections(options: PreferredConnectionOptions = {}): string[] {
    const {
      ssl = null,
      ipv6 = null,
      locations = ['local', 'remote', 'relay'],
      schemes = ['https', 'http'],
      ipVersions = ['ipv4', 'ipv6'],
    } = options;
    const ownedOrUnownedNonLocal = (connection: ResourceConnection): boolean => {
      if (this.owned || (!this.owned && !connection.local)) {
        return true;
      }

      return false;
    };

    const allowedSchemes = schemes.filter(scheme =>
      ssl === null ? true : ssl ? scheme === 'https' : scheme === 'http',
    );
    const allowedIpVersions = ipVersions.filter(ipVersion =>
      ipv6 === null ? true : ipv6 ? ipVersion === 'ipv6' : ipVersion === 'ipv4',
    );
    const grouped = new Map<string, string[]>();

    for (const connection of this.connections) {
      if (!ownedOrUnownedNonLocal(connection)) {
        continue;
      }

      const location: ResourceConnectionLocation = connection.relay
        ? 'relay'
        : connection.local
          ? 'local'
          : 'remote';
      const ipVersion: ResourceIpVersion = connection.ipv6 ? 'ipv6' : 'ipv4';
      for (const scheme of allowedSchemes) {
        const groupKey = `${location}:${scheme}:${ipVersion}`;
        const urls = grouped.get(groupKey) ?? [];
        urls.push(scheme === 'https' ? connection.uri : connection.httpuri);
        grouped.set(groupKey, urls);
      }
    }

    const attemptUrls: string[] = [];
    for (const location of locations) {
      for (const scheme of allowedSchemes) {
        for (const ipVersion of allowedIpVersions) {
          attemptUrls.push(...(grouped.get(`${location}:${scheme}:${ipVersion}`) ?? []));
        }
      }
    }

    if (this.baseUrl) {
      attemptUrls.push(this.baseUrl);
    }

    return attemptUrls;
  }

  async connect(options?: ResourceConnectOptions): Promise<PlexServer>;
  async connect(ssl?: boolean | null, timeout?: number): Promise<PlexServer>;
  async connect(
    optionsOrSsl: ResourceConnectOptions | boolean | null = null,
    legacyTimeout?: number,
  ): Promise<PlexServer> {
    let options: ResourceConnectOptions;
    if (typeof optionsOrSsl === 'object' && optionsOrSsl !== null) {
      options = optionsOrSsl;
    } else {
      options = { ssl: optionsOrSsl as boolean | null, timeout: legacyTimeout };
    }
    const { timeout, ...connectionOptions } = options;
    const attemptUrls = this.preferredConnections(connectionOptions);

    return connectInPreferredOrder(attemptUrls, this.accessToken, timeout, this.name);
  }

  /** Remove this device from your account */
  async delete(): Promise<void> {
    const key = `https://plex.tv/api/servers/${this.clientIdentifier}?X-Plex-Client-Identifier=${BASE_HEADERS['X-Plex-Client-Identifier']}&X-Plex-Token=${this.accessToken}`;
    await ofetch(key, { method: 'delete', retry: 0 });
  }

  private _loadData(data: ResourcesResponse): void {
    this.name = data.name;
    this.accessToken = data.accessToken ?? '';
    this.owned = data.owned;
    this.clientIdentifier = data.clientIdentifier;
    this.createdAt = new Date(data.createdAt);
    this.lastSeenAt = new Date(data.lastSeenAt);
    this.device = data.device;
    this.home = data.home;
    this.platform = data.platform;
    this.platformVersion = data.platformVersion;
    this.provides = data.provides;
    this.synced = data.synced;
    this.presence = data.presence;
    this.product = data.product;
    this.productVersion = data.productVersion;
    this.connections =
      data.connections?.map(connection => new ResourceConnection(connection)) ?? [];
  }
}

export class ResourceConnection {
  TAG = 'Connection';
  /** Local IP address */
  declare address: string;
  /** Full local address */
  declare httpuri: string;
  /** True if local */
  declare local: boolean;
  /** True if this connection uses an IPv6 address. */
  declare ipv6: boolean;
  /** True if this connection uses Plex Relay. */
  declare relay: boolean;
  /** 32400 */
  declare port: number;
  /** HTTP or HTTPS */
  declare protocol: string;
  /** External address */
  declare uri: string;

  constructor(data: Connection) {
    this._loadData(data);
  }

  private _loadData(data: Connection): void {
    this.address = data.address;
    this.protocol = data.protocol;
    this.port = Number(data.port);
    this.uri = data.uri;
    this.local = data.local;
    this.ipv6 = data.IPv6;
    this.relay = data.relay;
    const httpAddress =
      this.ipv6 && !data.address.startsWith('[') ? `[${data.address}]` : data.address;
    this.httpuri = `http://${httpAddress}:${data.port}`;
  }
}

/**
 * This object represents resources connected to your Plex server that provide
 * playback ability from your Plex Server, iPhone or Android clients, Plex Web,
 * this API, etc. The raw xml for the data presented here can be found at:
 * https://plex.tv/devices.xml
 */
export class MyPlexDevice extends PlexObject {
  static override TAG = 'Device';
  static key = 'https://plex.tv/devices.xml';

  declare name: string;
  declare publicAddress: string;
  declare product: string;
  declare productVersion: string;
  declare platform: string;
  declare platformVersion: string;
  declare device: string;
  declare model: string;
  declare vendor: string;
  declare provides: string;
  declare clientIdentifier: string;
  declare version: string;
  declare id: string;
  declare token: string;
  declare screenResolution: string;
  declare screenDensity: string;
  declare createdAt: Date;
  declare lastSeenAt: Date;
  /** List of connection URIs for the device. */
  declare connections?: string[];

  async connect(timeout?: number): Promise<PlexServer> {
    // TODO: switch between PlexServer and PlexClient

    return connectInPreferredOrder(this.connections ?? [], this.token, timeout, this.name);
  }

  /**
   * Remove this device from your account
   */
  async delete() {
    const key = `https://plex.tv/devices/${this.id}.xml`;
    await this.server.query({ path: key, method: 'delete' });
  }

  protected override _loadData(data: Device): void {
    this.name = data.$.name;
    this.publicAddress = data.$.publicAddress;
    this.product = data.$.product;
    this.productVersion = data.$.productVersion;
    this.platform = data.$.platform;
    this.platformVersion = data.$.platformVersion;
    this.device = data.$.device;
    this.model = data.$.model;
    this.vendor = data.$.vendor;
    this.provides = data.$.provides;
    this.clientIdentifier = data.$.clientIdentifier;
    this.version = data.$.version;
    this.id = data.$.id;
    // this.token = logfilter.add_secret(data.token);
    // Attempt to prevent token from being logged accidentally
    Object.defineProperty(this, 'token', {
      enumerable: false,
      configurable: true,
      value: data.$.token,
    });
    this.screenResolution = data.$.screenResolution;
    this.screenDensity = data.$.screenDensity;
    this.createdAt = new Date(Number.parseInt(data.$.createdAt, 10) * 1000);
    this.lastSeenAt = new Date(Number.parseInt(data.$.lastSeenAt, 10) * 1000);
    this.connections = data.Connection?.map(connection => connection.$.uri);
  }
}
