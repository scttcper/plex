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
        const data: unknown = JSON.parse(message.toString());
        if (!isNotificationEnvelope(data)) {
          throw new TypeError('Invalid Plex notification envelope.');
        }
        this.callback(data.NotificationContainer as AlertTypes);
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
      socket.once('close', () => {
        socket.removeAllListeners('message');
        if (this._ws === socket) {
          this._ws = undefined;
        }
        reject(new Error('Alert connection closed before opening.'));
      });
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

/** Check the envelope before passing the server-defined notification payload to callers. */
function isNotificationEnvelope(
  value: unknown,
): value is NotificationContainer<{ type: string; size: number }> {
  if (value === null || typeof value !== 'object' || !('NotificationContainer' in value)) {
    return false;
  }
  const container = value.NotificationContainer;
  return (
    container !== null &&
    typeof container === 'object' &&
    'type' in container &&
    typeof container.type === 'string' &&
    'size' in container &&
    typeof container.size === 'number'
  );
}
