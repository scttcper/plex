import { describe, expect, it } from 'vitest';

import { ClientTimeline, PlexClient } from '../src/client.js';
import { PlexServer } from '../src/server.js';

describe('PlexClient', () => {
  it('should initialize with default values', () => {
    const client = new PlexClient();
    expect(client._baseurl).toBe('http://localhost:32400');
    expect(client._token).toBeNull();
    expect(client._server).toBeNull();
    expect(client._proxyThroughServer).toBe(false);
  });

  it('should initialize with provided options', () => {
    const server = new PlexServer('http://localhost:32400', 'server-token');
    const client = new PlexClient({
      baseurl: 'http://192.168.1.100:32500',
      token: 'client-token',
      server,
    });
    expect(client._baseurl).toBe('http://192.168.1.100:32500');
    expect(client._token).toBe('client-token');
    expect(client._server).toBe(server);
  });

  it('should toggle proxy mode', () => {
    const server = new PlexServer('http://localhost:32400', 'test-token');
    const client = new PlexClient({ server });
    expect(client._proxyThroughServer).toBe(false);

    client.proxyThroughServer();
    expect(client._proxyThroughServer).toBe(true);

    client.proxyThroughServer();
    expect(client._proxyThroughServer).toBe(false);
  });

  it('should set proxy mode explicitly', () => {
    const server = new PlexServer('http://localhost:32400', 'test-token');
    const client = new PlexClient({ server });

    client.proxyThroughServer(true);
    expect(client._proxyThroughServer).toBe(true);

    client.proxyThroughServer(false);
    expect(client._proxyThroughServer).toBe(false);
  });

  it('should throw when enabling proxy without a server', () => {
    const client = new PlexClient();
    expect(() => client.proxyThroughServer(true)).toThrow('PlexServer is required');
  });

  it('should accept a server via proxyThroughServer', () => {
    const server = new PlexServer('http://localhost:32400', 'test-token');
    const client = new PlexClient();
    client.proxyThroughServer(true, server);
    expect(client._proxyThroughServer).toBe(true);
    expect(client._server).toBe(server);
  });

  it('should build URLs correctly', () => {
    const client = new PlexClient({ baseurl: 'http://192.168.1.100:32500' });
    const url = client.url('/player/playback/play');
    expect(url.toString()).toBe('http://192.168.1.100:32500/player/playback/play');
  });

  it('should build URLs with token', () => {
    const client = new PlexClient({
      baseurl: 'http://192.168.1.100:32500',
      token: 'abc123',
    });
    const url = client.url('/player/playback/play', { includeToken: true });
    expect(url.toString()).toContain('X-Plex-Token=abc123');
  });

  it('should throw playMedia without a server', async () => {
    const client = new PlexClient();
    await expect(client.playMedia({ key: '/library/metadata/1' })).rejects.toThrow(
      'PlexServer is required',
    );
  });
});

describe('ClientTimeline', () => {
  it('should construct from data with defaults', () => {
    const tl = new ClientTimeline({ type: 'video', state: 'playing' });
    expect(tl.type).toBe('video');
    expect(tl.state).toBe('playing');
    expect(tl.time).toBe(0);
    expect(tl.duration).toBe(0);
    expect(tl.volume).toBe(0);
    expect(tl.shuffle).toBe(false);
    expect(tl.repeat).toBe(0);
    expect(tl.key).toBe('');
  });

  it('should construct from full data', () => {
    const tl = new ClientTimeline({
      type: 'music',
      state: 'paused',
      time: 30_000,
      duration: 180_000,
      volume: 75,
      shuffle: true,
      repeat: 1,
      key: '/library/metadata/123',
      ratingKey: '123',
      playQueueID: 456,
    });
    expect(tl.type).toBe('music');
    expect(tl.state).toBe('paused');
    expect(tl.time).toBe(30_000);
    expect(tl.duration).toBe(180_000);
    expect(tl.volume).toBe(75);
    expect(tl.shuffle).toBe(true);
    expect(tl.repeat).toBe(1);
    expect(tl.key).toBe('/library/metadata/123');
    expect(tl.ratingKey).toBe('123');
    expect(tl.playQueueID).toBe(456);
  });
});
