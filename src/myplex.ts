import { setTimeout as sleep } from 'node:timers/promises';

import { ofetch } from 'ofetch';
import pAny from 'p-any';
import { parseStringPromise } from 'xml2js';

import { PlexObject } from './base/plexObject.js';

import { BASE_HEADERS, TIMEOUT } from './config.js';
import type {
  Connection,
  Device,
  ResourcesResponse,
  UserResponse,
  WebLogin,
} from './myplex.types.js';
import { PlexServer } from './server.js';
import type { MediaContainer } from './util.js';

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
  static async webLoginCheck(webLogin: WebLogin, timeoutSeconds = 60): Promise<MyPlexAccount> {
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
          const myPlexAccount = new MyPlexAccount(null, '', '', tokenResponse.authToken);

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
  HOMEUSERCREATE = 'https://plex.tv/api/home/users?title={title}'; // post with data
  EXISTINGUSER = 'https://plex.tv/api/home/users?invitedEmail={username}'; // post with data
  FRIENDSERVERS = 'https://plex.tv/api/servers/{machineId}/shared_servers/{serverId}'; // put with data
  PLEXSERVERS = 'https://plex.tv/api/servers/{machineId}'; // get
  FRIENDUPDATE = 'https://plex.tv/api/friends/{userId}'; // put with args, delete
  REMOVEHOMEUSER = 'https://plex.tv/api/home/users/{userId}'; // delete
  REMOVEINVITE = 'https://plex.tv/api/invites/requested/{userId}?friend=0&server=1&home=0'; // delete
  REQUESTED = 'https://plex.tv/api/invites/requested'; // get
  REQUESTS = 'https://plex.tv/api/invites/requests'; // get
  SIGNIN = 'https://plex.tv/users/sign_in.json'; // get with auth
  WEBHOOKS = 'https://plex.tv/api/v2/user/webhooks'; // get, post with data

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

  /**
   *
   * @param username Your MyPlex username
   * @param password Your MyPlex password
   * @param token Token used to access this client.
   * @param session Use your own session object if you want to cache the http responses from PMS
   * @param timeout timeout in seconds on initial connect to myplex
   * @param server not often available
   */
  constructor(
    public baseUrl: string | null = null,
    public username?: string,
    public password?: string,
    public token?: string,
    public timeout = TIMEOUT,
    public server?: PlexServer,
  ) {
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

    const data = await this.query<UserResponse>(MyPlexAccount.key);
    this._loadData(data);
    return this;
  }

  /**
   * Returns the :class:`~plexapi.myplex.MyPlexResource` that matches the name specified.
   */
  async resource(name: string): Promise<MyPlexResource> {
    const resources = await this.resources();
    const matchingResource = resources.find(resource => resource.name === name);
    if (matchingResource) {
      return matchingResource;
    }

    throw new Error(`Unable to find resource ${name}`);
  }

  async resources(): Promise<MyPlexResource[]> {
    const data = await this.query<ResourcesResponse[]>(MyPlexResource.key);
    return data.map(device => new MyPlexResource(this, device, this.baseUrl));
  }

  /**
   * @param name Name to match against.
   * @param clientId clientIdentifier to match against.
   */
  async device(name = '', clientId?: string): Promise<MyPlexDevice> {
    const devices = await this.devices();
    const device = devices.find(
      device =>
        device.name?.toLowerCase() === name.toLowerCase() || device.clientIdentifier === clientId,
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
    const response = await this.query<MediaContainer<{ Device: Device[] }>>(MyPlexDevice.key);
    return response.MediaContainer.Device.map(data => new MyPlexDevice(this.server, data));
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
  async query<T = any>(
    url: string,
    method: 'get' | 'post' | 'put' | 'patch' | 'head' | 'delete' = 'get',
    headers?: any,
    username?: string,
    password?: string,
  ): Promise<T> {
    const requestHeaders = this._headers();
    if (username && password) {
      const credentials = Buffer.from(`${username}:${password}`).toString('base64');
      requestHeaders.Authorization = `Basic ${credentials}`;
    }

    if (!url.includes('xml')) {
      requestHeaders.accept = 'application/json';
    }

    const body = await ofetch<string>(url, {
      method,
      headers: requestHeaders,
      timeout: this.timeout ?? TIMEOUT,
      retry: 0,
      parseResponse: res => res,
      // Can't seem to pass responseType
    });

    if (url.includes('xml')) {
      const xml = await parseStringPromise(body);
      return xml;
    }

    const res = JSON.parse(body);
    return res;
  }

  /**
   * Returns a str, a new "claim-token", which you can use to register your new Plex Server instance to your account.
   * @link https://hub.docker.com/r/plexinc/pms-docker/
   * @link https://www.plex.tv/claim/
   */
  async claimToken(): Promise<string> {
    const url = 'https://plex.tv/api/claim/token.json';
    const response = await this.query<{ token: string }>(url, 'get');
    return response.token;
  }

  /**
   * @param token pass token from claimToken
   */
  async claimServer(token: string): Promise<any> {
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
      'Content-type': 'application/json',
    };
    if (this.token) {
      headers['X-Plex-Token'] = this.token;
    }

    return headers;
  }

  private async _signin(username?: string, password?: string): Promise<UserResponse> {
    const data = await this.query<{ user: UserResponse }>(
      this.SIGNIN,
      'post',
      undefined,
      username,
      password,
    );
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

/**
 * Connects to the specified cls with url and token
 */
async function connect(
  cls: (...args: ConstructorParameters<typeof PlexServer>) => PlexServer,
  url: string,
  token: string,
  timeout?: number,
): Promise<PlexServer> {
  const device = cls(url, token, timeout);
  await device.connect();
  return device;
}

/**
 * This object represents resources connected to your Plex server that can provide
 * content such as Plex Media Servers, iPhone or Android clients, etc.
 */
export class MyPlexResource {
  static key = 'https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1';
  TAG = 'Device';
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

  constructor(
    public readonly account: MyPlexAccount,
    data: ResourcesResponse,
    private readonly baseUrl: string | null = null,
  ) {
    this._loadData(data);
  }

  async connect(ssl: boolean | null = null, timeout?: number): Promise<PlexServer> {
    const connections = [...this.connections].sort((a, b) => Number(b.local) - Number(a.local));
    const ownedOrUnownedNonLocal = (connection: ResourceConnection): boolean => {
      if (this.owned || (!this.owned && !connection.local)) {
        return true;
      }

      return false;
    };

    // Sort connections from (https, local) to (http, remote)
    // Only check non-local connections unless we own the resource
    const https = connections.filter(x => ownedOrUnownedNonLocal(x)).map(x => x.uri);
    const http = connections.filter(x => ownedOrUnownedNonLocal(x)).map(x => x.httpuri);

    let attemptUrls: string[];
    if (ssl === null) {
      attemptUrls = [...https, ...http];
    } else {
      attemptUrls = ssl ? https : http;
    }

    if (this.baseUrl) {
      attemptUrls.push(this.baseUrl);
    }

    // TODO: switch between PlexServer and PlexClient

    // Try connecting to all known resource connections in parellel, but
    // only return the first server (in order) that provides a response.
    const promises = attemptUrls.map(async url =>
      connect((...args) => new PlexServer(...args), url, this.accessToken, timeout),
    );
    const result = await pAny(promises);
    return result;
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
    this.httpuri = `http://${data.address}:${data.port}`;
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

  async connect(): Promise<PlexServer> {
    // TODO: switch between PlexServer and PlexClient

    // Try connecting to all known resource connections in parellel, but
    // only return the first server (in order) that provides a response.
    const promises = (this.connections ?? []).map(async url =>
      connect((...args) => new PlexServer(...args), url, this.token),
    );
    const result = await pAny(promises);
    return result;
  }

  /**
   * Remove this device from your account
   */
  async delete() {
    const key = `https://plex.tv/devices/${this.id}.xml`;
    await this.server.query(key, 'delete');
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
    this.createdAt = new Date(Number.parseInt(data.$.createdAt, 10));
    this.lastSeenAt = new Date(Number.parseInt(data.$.lastSeenAt, 10));
    this.connections = data.Connection?.map(connection => connection.$.uri);
  }
}
