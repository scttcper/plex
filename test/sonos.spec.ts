import { describe, expect, it, vi } from 'vitest';

import { MyPlexAccount } from '../src/myplex.ts';
import { PlayQueue } from '../src/playqueue.ts';
import { PlexServer } from '../src/server.ts';
import { PlexSonosClient } from '../src/sonos.ts';

describe('Sonos playback', () => {
  it('uses a delegation token and the existing queue for music playback', async () => {
    const server = new PlexServer('https://plex.example', 'server-token');
    server.machineIdentifier = 'server-id';
    const account = new MyPlexAccount({ token: 'account-token' });
    const speaker = new PlexSonosClient(account, {
      machineIdentifier: 'speaker-id',
      title: 'Kitchen',
    });
    const queue = new PlayQueue(server, {
      playQueueID: 7,
      Metadata: [{ type: 'track', key: '/library/metadata/12', ratingKey: '12' }],
    });
    const token = vi.spyOn(server, 'createToken').mockResolvedValue('delegation-token');
    const createQueue = vi.spyOn(server, 'createPlayQueue');
    const command = vi.spyOn(speaker, 'sendCommand').mockResolvedValue(null);
    await speaker.playMedia(queue, { offset: 100 });
    expect(token).toHaveBeenCalledExactlyOnceWith();
    expect(createQueue).not.toHaveBeenCalled();
    expect(command).toHaveBeenCalledExactlyOnceWith('playback/playMedia', {
      type: 'music',
      providerIdentifier: 'com.plexapp.plugins.library',
      containerKey: '/playQueues/7?own=1',
      key: '/library/metadata/12',
      offset: 100,
      machineIdentifier: 'server-id',
      protocol: 'https',
      address: 'plex.example',
      port: '443',
      token: 'delegation-token',
      'X-Plex-Token': 'server-token',
    });
  });

  it('rejects empty queues before requesting credentials or sending commands', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const speaker = new PlexSonosClient(new MyPlexAccount({ token: 'test' }), {});
    const queue = new PlayQueue(server, { playQueueID: 7, Metadata: [] });
    const token = vi.spyOn(server, 'createToken');
    const command = vi.spyOn(speaker, 'sendCommand');
    await expect(speaker.playMedia(queue)).rejects.toThrow('nonempty play queue');
    expect(token).not.toHaveBeenCalled();
    expect(command).not.toHaveBeenCalled();
  });

  it('rejects video queues before sending commands', async () => {
    const server = new PlexServer('http://localhost:32400', 'test');
    const speaker = new PlexSonosClient(new MyPlexAccount({ token: 'test' }), {});
    const queue = new PlayQueue(server, {
      playQueueID: 7,
      Metadata: [{ type: 'movie', key: '/library/metadata/10', ratingKey: '10' }],
    });
    const command = vi.spyOn(speaker, 'sendCommand');
    await expect(speaker.playMedia(queue)).rejects.toThrow('music playback only');
    expect(command).not.toHaveBeenCalled();
  });
});
