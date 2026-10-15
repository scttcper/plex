import { XmlError } from '@rgrove/parse-xml';
import { describe, expect, it, vi } from 'vitest';

import { ClientTimeline, PlexClient } from '../src/client.ts';
import { PlayQueue } from '../src/playqueue.ts';
import { PlexServer } from '../src/server.ts';
import type { Movie } from '../src/video.ts';

import { itemAt } from './assertions.ts';

function createServer(): PlexServer {
  const server = new PlexServer('http://192.168.1.2:32400', 'server-token');
  server.machineIdentifier = 'server-machine';
  server.library = vi.fn(async () => ({ identifier: 'com.plexapp.plugins.library' })) as never;
  return server;
}

describe('PlexClient', () => {
  it('should initialize with default values', () => {
    const client = new PlexClient();
    expect(client.baseurl).toBe('http://localhost:32400');
    expect(client.server).toBeUndefined();
    expect(client.isProxied).toBe(false);
    expect(client.protocolCapabilities).toEqual([]);
  });

  it('should initialize with provided options and trim the base url', () => {
    const server = new PlexServer('http://localhost:32400', 'server-token');
    const client = new PlexClient({
      baseurl: 'http://192.168.1.100:32500/',
      token: 'client-token',
      server,
      data: {
        name: 'Living Room',
        protocolCapabilities: 'timeline,playback,navigation',
        local: '1',
        userID: '3',
      },
    });
    expect(client.baseurl).toBe('http://192.168.1.100:32500');
    expect(client.server).toBe(server);
    expect(client.title).toBe('Living Room');
    expect(client.protocolCapabilities).toEqual(['timeline', 'playback', 'navigation']);
    expect(client.local).toBe(true);
    expect(client.userID).toBe(3);
  });

  it('should enable and disable proxy mode', () => {
    const server = new PlexServer('http://localhost:32400', 'test-token');
    const client = new PlexClient({ server });

    expect(client.proxyThroughServer().isProxied).toBe(true);
    expect(client.proxyThroughServer({ enabled: false }).isProxied).toBe(false);
  });

  it('should throw when enabling proxy without a server', () => {
    const client = new PlexClient();
    expect(() => client.proxyThroughServer()).toThrow('PlexServer is required');
  });

  it('should accept a server via proxyThroughServer', () => {
    const server = new PlexServer('http://localhost:32400', 'test-token');
    const client = new PlexClient().proxyThroughServer({ server });
    expect(client.isProxied).toBe(true);
    expect(client.server).toBe(server);
  });

  it('should build URLs correctly', () => {
    const client = new PlexClient({ baseurl: 'http://192.168.1.100:32500' });
    const url = client.url('/player/playback/play');
    expect(url.toString()).toBe('http://192.168.1.100:32500/player/playback/play');
  });

  it('should add the token without dropping existing query params', () => {
    const client = new PlexClient({ baseurl: 'http://192.168.1.100:32500', token: 'abc123' });
    const url = client.url('/player/timeline/poll?wait=0', { includeToken: true });
    expect(url.searchParams.get('wait')).toBe('0');
    expect(url.searchParams.get('X-Plex-Token')).toBe('abc123');
  });

  it('should send commands with a command id and target client header', async () => {
    const client = new PlexClient({ data: { machineIdentifier: 'client-id' } });
    const query = vi.spyOn(client, 'query').mockResolvedValue(null);

    await client.seekTo(1000, { type: 'video' });
    await client.play();

    expect(query).toHaveBeenNthCalledWith(1, {
      path: '/player/playback/seekTo?offset=1000&type=video&commandID=1',
      headers: { 'X-Plex-Target-Client-Identifier': 'client-id' },
    });
    expect(query).toHaveBeenNthCalledWith(2, {
      path: '/player/playback/play?commandID=2',
      headers: { 'X-Plex-Target-Client-Identifier': 'client-id' },
    });
  });

  it('should proxy commands through the server', async () => {
    const server = createServer();
    const serverQuery = vi.spyOn(server, 'query').mockResolvedValue(null);
    const client = new PlexClient({ server, data: { machineIdentifier: 'client-id' } });

    await client.proxyThroughServer().setParameters({ shuffle: true, repeat: 2 });

    expect(serverQuery).toHaveBeenCalledExactlyOnceWith({
      path: '/player/playback/setParameters?shuffle=1&repeat=2&commandID=1',
      headers: { 'X-Plex-Target-Client-Identifier': 'client-id' },
    });
  });

  it('should parse XML timeline responses proxied through the server', async () => {
    const server = createServer();
    vi.spyOn(server, 'query').mockResolvedValue(
      '<MediaContainer><Timeline state="playing" type="video" time="2500"/></MediaContainer>',
    );
    const client = new PlexClient({ server }).proxyThroughServer();

    const timeline = await client.timeline();

    expect(timeline?.state).toBe('playing');
    expect(timeline?.time).toBe(2500);
  });

  it('should parse XML timeline responses', async () => {
    const client = new PlexClient({ baseurl: 'http://192.168.1.100:32500' });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          '<MediaContainer commandID="1"><Timeline state="stopped" type="music"/>' +
            '<Timeline state="paused" type="video" time="1500" duration="9000" shuffle="1" ratingKey="10"/>' +
            '</MediaContainer>',
          { headers: { 'content-type': 'text/xml' } },
        ),
      );

    try {
      const timelines = await client.timelines();
      expect(timelines).toHaveLength(2);
      expect(itemAt(timelines, 1).state).toBe('paused');
      expect(itemAt(timelines, 1).time).toBe(1500);
      expect(itemAt(timelines, 1).duration).toBe(9000);
      expect(itemAt(timelines, 1).shuffle).toBe(true);
      expect(itemAt(timelines, 1).ratingKey).toBe('10');
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("should accept Plex for Samsung's unclosed success response", async () => {
    const client = new PlexClient({ baseurl: 'http://192.168.1.100:32500' });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('<?xml version="1.0"?><Response code="200" status="OK">'));

    try {
      await expect(client.play()).resolves.toBeUndefined();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('should still reject malformed XML that is not a success response', async () => {
    const client = new PlexClient({ baseurl: 'http://192.168.1.100:32500' });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('<MediaContainer><Timeline state="playing">'));

    try {
      await expect(client.timelines()).rejects.toBeInstanceOf(XmlError);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('should treat paused media as playing by default', async () => {
    const client = new PlexClient();
    vi.spyOn(client, 'timelines').mockResolvedValue([
      new ClientTimeline({ type: 'video', state: 'paused' }),
    ]);

    await expect(client.isPlayingMedia()).resolves.toBe(true);
    await expect(client.isPlayingMedia({ includePaused: false })).resolves.toBe(false);
  });

  it('should check every player timeline when deciding if media is playing', async () => {
    const client = new PlexClient();
    const timelines = vi.spyOn(client, 'timelines');

    timelines.mockResolvedValueOnce([
      new ClientTimeline({ type: 'photo', state: 'paused' }),
      new ClientTimeline({ type: 'music', state: 'playing' }),
    ]);
    await expect(client.isPlayingMedia({ includePaused: false })).resolves.toBe(true);

    timelines.mockResolvedValueOnce([
      new ClientTimeline({ type: 'video', state: 'buffering' }),
      new ClientTimeline({ type: 'music', state: 'playing' }),
    ]);
    await expect(client.isPlayingMedia()).resolves.toBe(true);

    timelines.mockResolvedValueOnce([
      new ClientTimeline({ type: 'video', state: 'buffering' }),
      new ClientTimeline({ type: 'music', state: 'stopped' }),
    ]);
    await expect(client.isPlayingMedia()).resolves.toBe(false);
  });

  it('should send a modern createPlayQueue command using the items server', async () => {
    const server = createServer();
    const client = new PlexClient();
    const sendCommand = vi.spyOn(client, 'sendCommand').mockResolvedValue(null);
    const movie = {
      key: '/library/metadata/10',
      listType: 'video',
      ratingKey: '10',
      server,
    } as Movie;

    await client.createPlayQueue(movie, { paused: true, shuffle: true });

    expect(sendCommand).toHaveBeenCalledWith(
      'playback/createPlayQueue',
      expect.objectContaining({
        address: '192.168.1.2',
        machineIdentifier: 'server-machine',
        paused: 1,
        port: 32_400,
        protocol: 'http',
        shuffle: 1,
        type: 'video',
        uri: 'server://server-machine/com.plexapp.plugins.library/library/metadata/10',
      }),
    );
  });

  it('should play an existing play queue with server address details', async () => {
    const server = createServer();
    vi.spyOn(server, 'createToken').mockResolvedValue('transient-token');
    const client = new PlexClient();
    const sendCommand = vi.spyOn(client, 'sendCommand').mockResolvedValue(null);
    const queue = new PlayQueue(server, {
      playQueueID: 7,
      playQueueSelectedItemOffset: 0,
      Metadata: [{ type: 'track', key: '/library/metadata/12', ratingKey: '12' }],
    });

    await client.playMedia(queue, { offset: 100 });

    expect(sendCommand).toHaveBeenCalledExactlyOnceWith('playback/playMedia', {
      providerIdentifier: 'com.plexapp.plugins.library',
      machineIdentifier: 'server-machine',
      protocol: 'http',
      address: '192.168.1.2',
      port: 32_400,
      offset: 100,
      key: '/library/metadata/12',
      type: 'music',
      containerKey: '/playQueues/7?window=100&own=1',
      token: 'transient-token',
    });
  });

  it('should refuse to guess when a play queue has no selected item', async () => {
    const server = createServer();
    vi.spyOn(server, 'query').mockResolvedValue({
      MediaContainer: { playQueueID: 7, playQueueSelectedItemID: 101, Metadata: [] },
    });
    const client = new PlexClient();
    const sendCommand = vi.spyOn(client, 'sendCommand').mockResolvedValue(null);
    const window = new PlayQueue(server, {
      playQueueID: 7,
      playQueueSelectedItemID: 101,
      Metadata: [
        { type: 'track', key: '/library/metadata/13', ratingKey: '13', playQueueItemID: 103 },
      ],
    });

    await expect(client.playMedia(window)).rejects.toThrow('has no selected item');
    expect(sendCommand).not.toHaveBeenCalled();
  });
});

describe('ClientTimeline', () => {
  it('should leave missing values undefined', () => {
    const tl = new ClientTimeline({ type: 'video', state: 'playing' });
    expect(tl.type).toBe('video');
    expect(tl.state).toBe('playing');
    expect(tl.time).toBeUndefined();
    expect(tl.duration).toBeUndefined();
    expect(tl.shuffle).toBeUndefined();
    expect(tl.key).toBeUndefined();
  });

  it('should parse numeric and boolean strings', () => {
    const tl = new ClientTimeline({
      type: 'music',
      state: 'paused',
      time: '30000',
      duration: 180_000,
      volume: '75',
      shuffle: '1',
      repeat: '1',
      key: '/library/metadata/123',
      ratingKey: '123',
      playQueueID: '456',
      subtitleSize: '100',
    });
    expect(tl.time).toBe(30_000);
    expect(tl.duration).toBe(180_000);
    expect(tl.volume).toBe(75);
    expect(tl.shuffle).toBe(true);
    expect(tl.repeat).toBe(1);
    expect(tl.key).toBe('/library/metadata/123');
    expect(tl.ratingKey).toBe('123');
    expect(tl.playQueueID).toBe(456);
    expect(tl.subtitleSize).toBe(100);
  });
});
