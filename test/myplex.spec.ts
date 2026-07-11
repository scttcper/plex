import { describe, expect, it } from 'vitest';

import { MyPlexAccount, MyPlexResource } from '../src/myplex.ts';
import type { ResourcesResponse } from '../src/myplex.types.ts';

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
