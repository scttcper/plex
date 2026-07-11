import { describe, expect, it, vi } from 'vitest';

import { MyPlexAccount, MyPlexInvite, MyPlexResource, MyPlexUser } from '../src/myplex.ts';
import type {
  MyPlexInvitesResponse,
  MyPlexUsersResponse,
  ResourcesResponse,
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
      url: 'https://plex.tv/api/friends/42',
      method: 'delete',
    });
    expect(account.query).toHaveBeenNthCalledWith(4, {
      url: 'https://plex.tv/api/home/users/42',
      method: 'delete',
    });
    await expect(sentInvite.accept()).rejects.toThrow('Only received invites can be accepted.');
    await expect(receivedInvite.cancel()).rejects.toThrow('Only sent invites can be cancelled.');
  });
});
