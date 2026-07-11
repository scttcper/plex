import { describe, expect, it, vi } from 'vitest';

import {
  MyPlexAccount,
  MyPlexInvite,
  MyPlexResource,
  MyPlexUser,
  PlexUserState,
  WatchlistItem,
} from '../src/myplex.ts';
import type {
  MyPlexInvitesResponse,
  MyPlexServerSectionsResponse,
  MyPlexUsersResponse,
  ResourcesResponse,
  UserStateResponse,
  WatchlistResponse,
  WebhookResponse,
} from '../src/myplex.types.ts';

const resourceData: ResourcesResponse = {
  accessToken: 'resource-token',
  clientIdentifier: 'server-id',
  connections: [
    {
      protocol: 'https',
      address: '192.168.1.2',
      port: 32_400,
      uri: 'https://ipv4-local.example:32400',
      local: true,
      relay: false,
      IPv6: false,
    },
    {
      protocol: 'https',
      address: '2001:db8::2',
      port: 32_400,
      uri: 'https://ipv6-local.example:32400',
      local: true,
      relay: false,
      IPv6: true,
    },
    {
      protocol: 'https',
      address: '2001:db8::3',
      port: 44_300,
      uri: 'https://ipv6-relay.example:443',
      local: false,
      relay: true,
      IPv6: true,
    },
  ],
  createdAt: '2026-07-11T00:00:00Z',
  device: 'Linux',
  home: true,
  httpsRequired: false,
  lastSeenAt: '2026-07-11T00:00:00Z',
  name: 'Test Server',
  owned: true,
  ownerId: null,
  platform: 'Linux',
  platformVersion: '1',
  presence: true,
  product: 'Plex Media Server',
  productVersion: '1',
  provides: 'server',
  publicAddress: '203.0.113.2',
  publicAddressMatches: false,
  relay: true,
  sourceTitle: null,
  synced: false,
};

describe('MyPlexResource IPv6 connections', () => {
  it('orders and filters resource connections by IP version', () => {
    const resource = new MyPlexResource(
      new MyPlexAccount({ token: 'account-token' }),
      resourceData,
    );

    expect(resource.preferredConnections({ ssl: true })).toEqual([
      'https://ipv4-local.example:32400',
      'https://ipv6-local.example:32400',
      'https://ipv6-relay.example:443',
    ]);
    expect(resource.preferredConnections({ ipv6: true, ssl: false })).toEqual([
      'http://[2001:db8::2]:32400',
      'http://[2001:db8::3]:44300',
    ]);
    expect(resource.connections[1].ipv6).toBe(true);
    expect(resource.connections[2].relay).toBe(true);
  });
});

const usersResponse: MyPlexUsersResponse = {
  MediaContainer: {
    $: { size: '1' },
    User: [
      {
        $: {
          allowCameraUpload: '0',
          allowChannels: '1',
          allowSync: '1',
          email: 'friend@example.com',
          home: '0',
          id: '42',
          protected: '0',
          title: 'Friendly Name',
          username: 'friend',
        },
        Server: [
          {
            $: {
              id: '7',
              machineIdentifier: 'machine-id',
              name: 'Shared Server',
              allLibraries: '0',
              owned: '1',
              pending: '0',
            },
          },
        ],
      },
    ],
  },
};

const sentInvitesResponse: MyPlexInvitesResponse = {
  MediaContainer: {
    $: { size: '1' },
    Invite: [
      {
        $: {
          createdAt: '2026-07-11T00:00:00Z',
          email: 'sent@example.com',
          friend: '1',
          home: '0',
          id: '51',
          server: '1',
          username: 'sent-user',
        },
      },
    ],
  },
};

const receivedInvitesResponse: MyPlexInvitesResponse = {
  MediaContainer: {
    $: { size: '1' },
    Invite: [
      {
        $: {
          email: 'received@example.com',
          friend: '1',
          friendlyName: 'Received User',
          home: '0',
          id: '52',
          server: '0',
        },
      },
    ],
  },
};

const serverSectionsResponse: MyPlexServerSectionsResponse = {
  MediaContainer: {
    $: { size: '1' },
    Server: [
      {
        $: { machineIdentifier: 'machine-id' },
        Section: [
          { $: { id: '10', key: '1', title: 'Movies', type: 'movie' } },
          { $: { id: '20', key: '2', title: 'TV Shows', type: 'show' } },
        ],
      },
    ],
  },
};

const watchlistResponse: WatchlistResponse = {
  MediaContainer: {
    identifier: 'com.plexapp.plugins.library',
    size: 1,
    totalSize: 1,
    Metadata: [
      {
        addedAt: 1_720_000_000,
        guid: 'plex://movie/discover-id',
        key: '/library/metadata/discover-id',
        originallyAvailableAt: '1984-06-08',
        rating: 7.8,
        ratingKey: 'discover-id',
        thumb: '/library/metadata/discover-id/thumb',
        title: 'Discover Movie',
        type: 'movie',
        watchlistedAt: 1_720_000_100,
        year: 1984,
      },
    ],
  },
};

const notWatchlistedState: UserStateResponse = {
  MediaContainer: {
    identifier: 'com.plexapp.plugins.library',
    size: 1,
    UserState: {
      ratingKey: 'discover-id',
      type: 'movie',
      viewCount: 0,
      viewOffset: 0,
    },
  },
};

const watchlistedState: UserStateResponse = {
  MediaContainer: {
    identifier: 'com.plexapp.plugins.library',
    size: 1,
    UserState: {
      ...notWatchlistedState.MediaContainer.UserState!,
      watchlistedAt: 1_720_000_100,
    },
  },
};

describe('MyPlexAccount users and invites', () => {
  it('loads users and their shared servers', async () => {
    const account = new MyPlexAccount({ token: 'account-token' });
    account.query = vi.fn(() => Promise.resolve(usersResponse)) as never;

    const users = await account.users();
    const user = await account.user('FRIEND@EXAMPLE.COM');

    expect(users[0]).toBeInstanceOf(MyPlexUser);
    expect(users[0].allowSync).toBe(true);
    expect(users[0].allowCameraUpload).toBe(false);
    expect(users[0].server('machine-id').name).toBe('Shared Server');
    expect(user.id).toBe(42);
  });

  it('loads sent and received pending invites with their direction', async () => {
    const account = new MyPlexAccount({ token: 'account-token' });
    const responses = new Map<string, MyPlexInvitesResponse>([
      [MyPlexInvite.requestedKey, sentInvitesResponse],
      [MyPlexInvite.requestsKey, receivedInvitesResponse],
    ]);
    account.query = vi.fn(({ url }: { url: string }) =>
      Promise.resolve(responses.get(url)),
    ) as never;

    const invites = await account.pendingInvites();
    const received = await account.pendingInvite('Received User', { includeSent: false });

    expect(invites.map(invite => invite.direction)).toEqual(['sent', 'received']);
    expect(invites[0]).toBeInstanceOf(MyPlexInvite);
    expect(invites[0].server).toBe(true);
    expect(received.id).toBe(52);
    expect(account.query).toHaveBeenLastCalledWith({ url: MyPlexInvite.requestsKey });
  });

  it('accepts, cancels, and removes account relationships with exact request shapes', async () => {
    const account = new MyPlexAccount({ token: 'account-token' });
    account.query = vi.fn(() => Promise.resolve()) as never;
    const user = new MyPlexUser(account, usersResponse.MediaContainer.User[0]);
    const sentInvite = new MyPlexInvite(
      account,
      sentInvitesResponse.MediaContainer.Invite[0],
      'sent',
    );
    const receivedInvite = new MyPlexInvite(
      account,
      receivedInvitesResponse.MediaContainer.Invite[0],
      'received',
    );

    await receivedInvite.accept();
    await sentInvite.cancel();
    await user.removeFriend();
    await user.removeHomeUser();

    expect(account.query).toHaveBeenNthCalledWith(1, {
      url: 'https://plex.tv/api/invites/requests/52?friend=1&home=0&server=0',
      method: 'put',
    });
    expect(account.query).toHaveBeenNthCalledWith(2, {
      url: 'https://plex.tv/api/invites/requested/51?friend=1&home=0&server=1',
      method: 'delete',
    });
    expect(account.query).toHaveBeenNthCalledWith(3, {
      url: 'https://plex.tv/api/v2/sharings/42',
      method: 'delete',
    });
    expect(account.query).toHaveBeenNthCalledWith(4, {
      url: 'https://plex.tv/api/home/users/42',
      method: 'delete',
    });
    await expect(sentInvite.accept()).rejects.toThrow('Only received invites can be accepted.');
    await expect(receivedInvite.cancel()).rejects.toThrow('Only sent invites can be cancelled.');
  });

  it('invites a friend with resolved sections, permissions, and filters', async () => {
    const account = new MyPlexAccount({ token: 'account-token' });
    const responses = new Map<string, unknown>([
      ['https://plex.tv/api/servers/machine-id', serverSectionsResponse],
    ]);
    account.query = vi.fn(({ url }: { url: string }) =>
      Promise.resolve(responses.get(url)),
    ) as never;

    await account.inviteFriend('new@example.com', {
      server: 'machine-id',
      sections: ['Movies', 2],
      permissions: { allowCameraUpload: true, allowSync: true },
      filters: {
        movies: { contentRating: ['G', 'PG'], label: ['kids'] },
        music: { 'label!': ['explicit'] },
      },
    });

    expect(account.query).toHaveBeenNthCalledWith(1, {
      url: 'https://plex.tv/api/servers/machine-id',
    });
    expect(account.query).toHaveBeenNthCalledWith(2, {
      url: 'https://plex.tv/api/servers/machine-id/shared_servers',
      method: 'post',
      body: {
        server_id: 'machine-id',
        shared_server: {
          library_section_ids: [10, 20],
          invited_email: 'new@example.com',
        },
        sharing_settings: {
          allowSync: '1',
          allowCameraUpload: '1',
          allowChannels: '0',
          filterMovies: 'contentRating=G%2CPG|label=kids',
          filterTelevision: '',
          filterMusic: 'label!=explicit',
        },
      },
    });
  });

  it('updates existing library shares and account-level permissions', async () => {
    const account = new MyPlexAccount({ token: 'account-token' });
    const user = new MyPlexUser(account, usersResponse.MediaContainer.User[0]);
    const responses = new Map<string, unknown>([
      ['https://plex.tv/api/servers/machine-id', serverSectionsResponse],
    ]);
    account.query = vi.fn(({ url }: { url: string }) =>
      Promise.resolve(responses.get(url)),
    ) as never;

    await account.updateFriend(user, {
      server: 'machine-id',
      sections: ['TV Shows'],
      permissions: { allowCameraUpload: false, allowSync: true },
      filters: { television: { 'contentRating!': ['TV-MA'] } },
    });

    expect(account.query).toHaveBeenNthCalledWith(2, {
      url: 'https://plex.tv/api/servers/machine-id/shared_servers/7',
      method: 'put',
      body: {
        server_id: 'machine-id',
        shared_server: { library_section_ids: [20] },
      },
    });
    expect(account.query).toHaveBeenNthCalledWith(3, {
      url: 'https://plex.tv/api/v2/sharings/42?allowSync=1&allowCameraUpload=0&filterTelevision=contentRating%21%3DTV-MA',
      method: 'put',
    });
  });

  it('adds a server share to an existing user without one', async () => {
    const account = new MyPlexAccount({ token: 'account-token' });
    const user = new MyPlexUser(account, {
      ...usersResponse.MediaContainer.User[0],
      Server: [],
    });
    const responses = new Map<string, unknown>([
      ['https://plex.tv/api/servers/machine-id', serverSectionsResponse],
    ]);
    account.query = vi.fn(({ url }: { url: string }) =>
      Promise.resolve(responses.get(url)),
    ) as never;

    await account.updateFriend(user, { server: 'machine-id', sections: ['Movies'] });

    expect(account.query).toHaveBeenNthCalledWith(2, {
      url: 'https://plex.tv/api/servers/machine-id/shared_servers',
      method: 'post',
      body: {
        server_id: 'machine-id',
        shared_server: { library_section_ids: [10], invited_id: 42 },
      },
    });
  });

  it('removes an existing server share without changing other settings', async () => {
    const account = new MyPlexAccount({ token: 'account-token' });
    const user = new MyPlexUser(account, usersResponse.MediaContainer.User[0]);
    account.query = vi.fn(() => Promise.resolve()) as never;

    await account.updateFriend(user, { server: 'machine-id', removeSections: true });

    expect(account.query).toHaveBeenCalledOnce();
    expect(account.query).toHaveBeenCalledWith({
      url: 'https://plex.tv/api/servers/machine-id/shared_servers/7',
      method: 'delete',
      body: {
        server_id: 'machine-id',
        shared_server: { library_section_ids: [] },
      },
    });
  });

  it('creates a managed home user and assigns library access', async () => {
    const account = new MyPlexAccount({ token: 'account-token' });
    const responses = new Map<string, unknown>([
      ['https://plex.tv/api/servers/machine-id', serverSectionsResponse],
      ['https://plex.tv/api/home/users?title=Kid+One', { User: { $: { id: '77' } } }],
    ]);
    account.query = vi.fn(({ url }: { url: string }) =>
      Promise.resolve(responses.get(url)),
    ) as never;

    await account.createHomeUser('Kid One', {
      server: 'machine-id',
      sections: ['Movies'],
      permissions: { allowSync: true },
      filters: { movies: { contentRating: ['G'] } },
    });

    expect(account.query).toHaveBeenNthCalledWith(2, {
      url: 'https://plex.tv/api/home/users?title=Kid+One',
      method: 'post',
    });
    expect(account.query).toHaveBeenNthCalledWith(3, {
      url: 'https://plex.tv/api/servers/machine-id/shared_servers',
      method: 'post',
      body: {
        server_id: 'machine-id',
        shared_server: { library_section_ids: [10], invited_id: 77 },
        sharing_settings: {
          allowSync: '1',
          allowCameraUpload: '0',
          allowChannels: '0',
          filterMovies: 'contentRating=G',
          filterTelevision: '',
          filterMusic: '',
        },
      },
    });
  });

  it('switches to a managed home user with an optional PIN', async () => {
    const account = new MyPlexAccount({
      baseUrl: 'http://localhost:32400',
      token: 'account-token',
      timeout: 5000,
    });
    const user = new MyPlexUser(account, usersResponse.MediaContainer.User[0]);
    account.query = vi.fn(() =>
      Promise.resolve({ user: { authenticationToken: 'home-token' } }),
    ) as never;
    const connect = vi
      .spyOn(MyPlexAccount.prototype, 'connect')
      .mockImplementationOnce(async function (this: MyPlexAccount) {
        return this;
      });

    const switchedAccount = await account.switchHomeUser(user, { pin: '0123' });

    expect(account.query).toHaveBeenCalledWith({
      url: 'https://plex.tv/api/home/users/42/switch?pin=0123',
      method: 'post',
    });
    expect(switchedAccount.token).toBe('home-token');
    expect(switchedAccount.baseUrl).toBe('http://localhost:32400');
    expect(switchedAccount.timeout).toBe(5000);
    expect(connect).toHaveBeenCalledOnce();
    connect.mockRestore();
  });

  it('adds an existing Plex user to the Home and optionally shares libraries', async () => {
    const account = new MyPlexAccount({ token: 'account-token' });
    const user = new MyPlexUser(account, usersResponse.MediaContainer.User[0]);
    const responses = new Map<string, unknown>([
      ['https://plex.tv/api/servers/machine-id', serverSectionsResponse],
    ]);
    account.query = vi.fn(({ url }: { url: string }) =>
      Promise.resolve(responses.get(url)),
    ) as never;

    await account.addUserToHome(user, {
      server: 'machine-id',
      sections: ['Movies'],
    });

    expect(account.query).toHaveBeenNthCalledWith(1, {
      url: 'https://plex.tv/api/home/users?invitedEmail=friend',
      method: 'post',
    });
    expect(account.query).toHaveBeenNthCalledWith(3, {
      url: 'https://plex.tv/api/servers/machine-id/shared_servers',
      method: 'post',
      body: {
        server_id: 'machine-id',
        shared_server: { library_section_ids: [10], invited_email: 'friend' },
        sharing_settings: {
          allowSync: '0',
          allowCameraUpload: '0',
          allowChannels: '0',
          filterMovies: '',
          filterTelevision: '',
          filterMusic: '',
        },
      },
    });
  });

  it('sets and removes account and managed-user PINs', async () => {
    const account = new MyPlexAccount({ token: 'account-token' });
    account.id = 99;
    const user = new MyPlexUser(account, usersResponse.MediaContainer.User[0]);
    account.query = vi.fn(() => Promise.resolve()) as never;

    await account.setPin({ pin: '1234', currentPin: '0000' });
    await account.removePin({ currentPin: '1234' });
    await account.setManagedUserPin(user, { pin: '5678' });
    await account.removeManagedUserPin(user);

    expect(account.query).toHaveBeenNthCalledWith(1, {
      url: 'https://plex.tv/api/home/users/99?pin=1234&currentPin=0000',
      method: 'put',
    });
    expect(account.query).toHaveBeenNthCalledWith(2, {
      url: 'https://plex.tv/api/home/users/99?pin=&currentPin=1234',
      method: 'put',
    });
    expect(account.query).toHaveBeenNthCalledWith(3, {
      url: 'https://plex.tv/api/v2/home/users/restricted/42?pin=5678',
      method: 'post',
    });
    expect(account.query).toHaveBeenNthCalledWith(4, {
      url: 'https://plex.tv/api/v2/home/users/restricted/42?removePin=1',
      method: 'post',
    });
  });

  it('lists typed watchlist items with options-object filters', async () => {
    const account = new MyPlexAccount({ token: 'account-token' });
    account.query = vi.fn(() => Promise.resolve(watchlistResponse)) as never;

    const items = await account.watchlist({
      filter: 'released',
      sort: 'rating:desc',
      type: 'movie',
      limit: 5,
      filters: { genre: 'Comedy' },
    });

    expect(account.query).toHaveBeenCalledWith({
      url: 'https://discover.provider.plex.tv/library/sections/watchlist/released?includeCollections=1&includeExternalMedia=1&sort=rating%3Adesc&type=1&X-Plex-Container-Size=5&genre=Comedy',
    });
    expect(items[0]).toBeInstanceOf(WatchlistItem);
    expect(items[0].title).toBe('Discover Movie');
    expect(items[0].watchlistedAt).toEqual(new Date(1_720_000_100_000));
  });

  it('reads user state and adds or removes a watchlist item', async () => {
    const account = new MyPlexAccount({ token: 'account-token' });
    const target = { guid: 'plex://movie/discover-id', title: 'Discover Movie' };
    account.query = vi
      .fn()
      .mockResolvedValueOnce(notWatchlistedState)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(watchlistedState)
      .mockResolvedValueOnce(null) as never;

    await account.addToWatchlist(target);
    await account.removeFromWatchlist(target);

    expect(account.query).toHaveBeenNthCalledWith(1, {
      url: 'https://metadata.provider.plex.tv/library/metadata/discover-id/userState',
    });
    expect(account.query).toHaveBeenNthCalledWith(2, {
      url: 'https://discover.provider.plex.tv/actions/addToWatchlist?ratingKey=discover-id',
      method: 'put',
    });
    expect(account.query).toHaveBeenNthCalledWith(3, {
      url: 'https://metadata.provider.plex.tv/library/metadata/discover-id/userState',
    });
    expect(account.query).toHaveBeenNthCalledWith(4, {
      url: 'https://discover.provider.plex.tv/actions/removeFromWatchlist?ratingKey=discover-id',
      method: 'put',
    });
  });

  it('exposes Discover user-state values and rejects invalid watchlist transitions', async () => {
    const account = new MyPlexAccount({ token: 'account-token' });
    const target = { guid: 'plex://movie/discover-id', title: 'Discover Movie' };
    account.query = vi
      .fn()
      .mockResolvedValueOnce(watchlistedState)
      .mockResolvedValueOnce(watchlistedState)
      .mockResolvedValueOnce(notWatchlistedState) as never;

    const state = await account.userState(target);

    expect(state).toBeInstanceOf(PlexUserState);
    expect(state.watchlistedAt).toEqual(new Date(1_720_000_100_000));
    await expect(account.addToWatchlist(target)).rejects.toThrow(
      '"Discover Movie" is already on the watchlist.',
    );
    await expect(account.removeFromWatchlist(target)).rejects.toThrow(
      '"Discover Movie" is not on the watchlist.',
    );
  });

  it('lists and normalizes account webhooks', async () => {
    const account = new MyPlexAccount({ token: 'account-token' });
    account.query = vi.fn(() =>
      Promise.resolve(['https://one.example/hook', { url: 'https://two.example/hook' }]),
    ) as never;

    const webhooks = await account.webhooks();

    expect(account.query).toHaveBeenCalledWith({
      url: 'https://plex.tv/api/v2/user/webhooks',
    });
    expect(webhooks).toEqual(['https://one.example/hook', 'https://two.example/hook']);
  });

  it('replaces and clears webhooks with form-encoded request bodies', async () => {
    const account = new MyPlexAccount({ token: 'account-token' });
    const query = vi.fn(
      (options: Parameters<MyPlexAccount['query']>[0]): Promise<WebhookResponse> =>
        Promise.resolve(options.body ? [{ url: 'https://one.example/hook' }] : []),
    );
    account.query = query as never;

    await account.setWebhooks(['https://one.example/hook', 'https://two.example/hook']);
    await account.setWebhooks([]);

    expect(query.mock.calls[0][0].body?.toString()).toBe(
      'urls%5B%5D=https%3A%2F%2Fone.example%2Fhook&urls%5B%5D=https%3A%2F%2Ftwo.example%2Fhook',
    );
    expect(query.mock.calls[1][0].body?.toString()).toBe('urls=');
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        url: 'https://plex.tv/api/v2/user/webhooks',
        method: 'post',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );
  });

  it('adds and removes individual webhooks without dropping existing URLs', async () => {
    const account = new MyPlexAccount({ token: 'account-token' });
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ url: 'https://one.example/hook' }])
      .mockResolvedValueOnce([
        { url: 'https://one.example/hook' },
        { url: 'https://two.example/hook' },
      ])
      .mockResolvedValueOnce([
        { url: 'https://one.example/hook' },
        { url: 'https://two.example/hook' },
      ])
      .mockResolvedValueOnce([{ url: 'https://one.example/hook' }]);
    account.query = query as never;

    const added = await account.addWebhook('https://two.example/hook');
    const removed = await account.removeWebhook('https://two.example/hook');

    expect(added).toEqual(['https://one.example/hook', 'https://two.example/hook']);
    expect(removed).toEqual(['https://one.example/hook']);
    expect(query.mock.calls[1][0].body.toString()).toContain(
      'urls%5B%5D=https%3A%2F%2Ftwo.example%2Fhook',
    );
    expect(query.mock.calls[3][0].body.toString()).toBe(
      'urls%5B%5D=https%3A%2F%2Fone.example%2Fhook',
    );
  });

  it('rejects duplicate additions and missing webhook removals', async () => {
    const account = new MyPlexAccount({ token: 'account-token' });
    account.query = vi.fn(() => Promise.resolve([{ url: 'https://one.example/hook' }])) as never;

    await expect(account.addWebhook('https://one.example/hook')).rejects.toThrow(
      'Webhook already exists',
    );
    await expect(account.removeWebhook('https://missing.example/hook')).rejects.toThrow(
      'Webhook does not exist',
    );
  });
});
