import type { Album, Artist, Track } from './audio.ts';
import { PlexClient } from './client.ts';
import type { PlayMediaOptions, Player } from './client.types.ts';
import { BadRequest } from './exceptions.ts';
import type { MyPlexAccount } from './myplex.ts';
import type { Playlist } from './playlist.ts';
import { PlayQueue } from './playqueue.ts';

export interface SonosPlayerData extends Partial<Player> {
  lanIP?: string;
}

/** A linked Sonos speaker controlled through Plex's Sonos service. */
export class PlexSonosClient extends PlexClient {
  readonly lanIP?: string;

  constructor(account: MyPlexAccount, data: SonosPlayerData) {
    super({ baseurl: 'https://sonos.plex.tv', token: account.token, timeout: account.timeout });
    this._loadData(data);
    this.lanIP = data.lanIP;
  }

  override async playMedia(
    media: Artist | Album | Track | Playlist | PlayQueue,
    { offset = 0, params = {} }: PlayMediaOptions = {},
  ): Promise<void> {
    const item = media instanceof PlayQueue ? media.items[0] : media;
    if (!item) {
      throw new BadRequest('Sonos playback requires a nonempty play queue.');
    }
    const type =
      'playlistType' in item ? item.playlistType : 'listType' in item ? item.listType : undefined;
    if (type !== 'audio') {
      throw new BadRequest('Sonos supports music playback only.');
    }
    const server = media.server;
    const queue = media instanceof PlayQueue ? media : await server.createPlayQueue(media);
    const url = new URL(server.baseurl);
    const token = await server.createToken();
    await this.sendCommand('playback/playMedia', {
      type: 'music',
      providerIdentifier: 'com.plexapp.plugins.library',
      containerKey: `/playQueues/${queue.playQueueID}?own=1`,
      key: item.key,
      offset,
      machineIdentifier: server.machineIdentifier,
      protocol: url.protocol.slice(0, -1),
      address: url.hostname,
      port: url.port || (url.protocol === 'https:' ? '443' : '80'),
      ...params,
      token,
      'X-Plex-Token': server.token,
    });
  }
}
