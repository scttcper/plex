import WebSocket from 'ws';

import type { AlertTypes, NotificationContainer } from './alert.types.ts';
import type { PlexServer } from './server.ts';

export class AlertListener {
  key = '/:/websockets/notifications';

  declare _ws?: WebSocket;
  private readonly server: PlexServer;
  callback: (data: AlertTypes) => void;

  constructor(server: PlexServer, callback: (data: AlertTypes) => void) {
    this.server = server;
    this.callback = callback;
  }

  async run(): Promise<void> {
    const url = this.server.url(this.key, { includeToken: true }).toString().replace('http', 'ws');
    this._ws = new WebSocket(url);

    this._ws.on('message', message => {
      try {
        const data: NotificationContainer<AlertTypes> = JSON.parse(message.toString());
        this.callback(data.NotificationContainer);
      } catch (err) {
        console.error(err);
      }
    });

    return new Promise(resolve => {
      this._ws.on('open', () => {
        resolve();
      });
    });
  }

  stop() {
    this._ws?.close();
  }
}
