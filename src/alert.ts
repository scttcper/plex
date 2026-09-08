import WebSocket from 'ws';

import type { AlertTypes, NotificationContainer } from './alert.types.ts';
import type { PlexServer } from './server.ts';

export interface AlertListenerOptions {
  onError?: (error: unknown) => void;
}

export class AlertListener {
  key = '/:/websockets/notifications';
  declare _ws?: WebSocket;
  private readonly server: PlexServer;
  private readonly options: AlertListenerOptions;
  private connecting?: Promise<void>;
  callback: (data: AlertTypes) => void;

  constructor(
    server: PlexServer,
    callback: (data: AlertTypes) => void,
    options: AlertListenerOptions = {},
  ) {
    this.server = server;
    this.callback = callback;
    this.options = options;
  }

  async run(): Promise<void> {
    if (this._ws?.readyState === WebSocket.OPEN) {
      return;
    }
    if (this.connecting) {
      return this.connecting;
    }
    const url = this.server.url(this.key, { includeToken: true });
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(url);
    this._ws = socket;
    socket.on('message', message => {
      try {
        const data: NotificationContainer<AlertTypes> = JSON.parse(message.toString());
        this.callback(data.NotificationContainer);
      } catch (error) {
        this.options.onError?.(error);
      }
    });
    this.connecting = new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.on('error', error => {
        this.options.onError?.(error);
        reject(error);
      });
      socket.once('close', () => reject(new Error('Alert connection closed before opening.')));
    });
    try {
      await this.connecting;
    } finally {
      this.connecting = undefined;
    }
  }

  stop(): void {
    this._ws?.close();
  }
}
