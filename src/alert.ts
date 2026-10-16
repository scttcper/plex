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
    // Dropped once the socket closes so a stale socket can't call back into the listener.
    const listeners = new AbortController();
    const { signal } = listeners;
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    socket.addEventListener(
      'message',
      event => {
        try {
          const data: unknown = JSON.parse(String(event.data));
          if (!isNotificationEnvelope(data)) {
            throw new TypeError('Invalid Plex notification envelope.');
          }
          this.callback(data.NotificationContainer as AlertTypes);
        } catch (error) {
          this.options.onError?.(error);
        }
      },
      { signal },
    );
    socket.addEventListener('open', () => resolve(), { signal });
    socket.addEventListener(
      'error',
      event => {
        const error = new Error(`Plex alert connection to ${this.server.baseurl} failed.`, {
          cause: event,
        });
        if (this._ws === socket) {
          this._ws = undefined;
        }
        this.options.onError?.(error);
        reject(error);
      },
      { signal },
    );
    socket.addEventListener(
      'close',
      () => {
        listeners.abort();
        if (this._ws === socket) {
          this._ws = undefined;
        }
        reject(new Error('Alert connection closed before opening.'));
      },
      { signal },
    );
    this.connecting = promise;
    try {
      await promise;
    } finally {
      this.connecting = undefined;
    }
  }

  stop(): void {
    const socket = this._ws;
    this._ws = undefined;
    socket?.close();
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
